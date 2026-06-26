/**
 * FinSight AI — Financial Statement Analyzer
 * Features: Client-side PDF parsing, Gemini AI Integration, Firebase Auth & Sync,
 * URL-based Zero-Backend Sharing (lz-string), and Chart.js visualizations.
 */

// ===== PDF.js Worker Setup =====
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ===== DOM References =====
const dom = {
  landingView: document.getElementById('landing-view'),
  loadingView: document.getElementById('loading-view'),
  dashboardView: document.getElementById('dashboard-view'),
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('file-input'),
  browseBtn: document.getElementById('browse-btn'),
  demoBtn: document.getElementById('demo-btn'),
  loaderStatus: document.getElementById('loader-status'),
  loaderBar: document.getElementById('loader-bar'),
  newAnalysisBtn: document.getElementById('new-analysis-btn'),
  companyName: document.getElementById('company-name'),
  reportPeriod: document.getElementById('report-period'),
  healthBadge: document.getElementById('health-badge'),
  healthLabel: document.getElementById('health-label'),
  analysisDate: document.getElementById('analysis-date'),
  execSummary: document.getElementById('exec-summary'),
  kpiGrid: document.getElementById('kpi-grid'),
  ratiosGrid: document.getElementById('ratios-grid'),
  riskList: document.getElementById('risk-list'),
  insightsGrid: document.getElementById('insights-grid'),
  dataTbody: document.getElementById('data-tbody'),
  // Navigation & Settings
  navSettings: document.getElementById('nav-settings'),
  navHistory: document.getElementById('nav-history'),
  settingsModal: document.getElementById('settings-modal'),
  closeSettings: document.getElementById('close-settings'),
  geminiApiKey: document.getElementById('gemini-api-key'),
  firebaseConfig: document.getElementById('firebase-config'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  toastContainer: document.getElementById('toast-container'),
  shareBtn: document.getElementById('share-btn'),
  historySection: document.getElementById('history-section'),
  historyList: document.getElementById('history-list'),
  // Auth DOM
  navLoginBtn: document.getElementById('nav-login-btn'),
  navProfileMenu: document.getElementById('nav-profile-menu'),
  userAvatar: document.getElementById('user-avatar'),
  logoutBtn: document.getElementById('logout-btn'),
  authModal: document.getElementById('auth-modal'),
  closeAuth: document.getElementById('close-auth'),
  tabLogin: document.getElementById('tab-login'),
  tabSignup: document.getElementById('tab-signup'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authGoogleBtn: document.getElementById('auth-google-btn'),
  authTitle: document.getElementById('auth-title')
};

// Global state
let currentAnalysis = null;
let db = null;
let auth = null;
let currentUser = null;
let authMode = 'login'; // 'login' or 'signup'

// ===== View Switcher =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? '✅' : '⚠️'}</div>
    <div class="toast-message">${message}</div>
  `;
  dom.toastContainer.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Settings & Config =====
function loadSettings() {
  const apiKey = localStorage.getItem('geminiApiKey') || '';
  const fbConfig = localStorage.getItem('firebaseConfig') || '';
  dom.geminiApiKey.value = apiKey;
  dom.firebaseConfig.value = fbConfig;
  initFirebase();
}

dom.navSettings.addEventListener('click', (e) => {
  e.preventDefault();
  loadSettings();
  dom.settingsModal.classList.add('active');
});

dom.closeSettings.addEventListener('click', () => {
  dom.settingsModal.classList.remove('active');
});

dom.saveSettingsBtn.addEventListener('click', () => {
  localStorage.setItem('geminiApiKey', dom.geminiApiKey.value.trim());
  localStorage.setItem('firebaseConfig', dom.firebaseConfig.value.trim());
  dom.settingsModal.classList.remove('active');
  showToast('Settings saved successfully!');
  initFirebase();
});

// ===== Firebase Init =====
function initFirebase() {
  const configStr = localStorage.getItem('firebaseConfig');
  if (!configStr) {
    // Revert to local-only history if no config
    db = null;
    auth = null;
    updateAuthUI(null);
    loadHistory();
    return;
  }
  
  try {
    const firebaseConfig = JSON.parse(configStr);
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    
    // Listen for auth state
    auth.onAuthStateChanged(user => {
      currentUser = user;
      updateAuthUI(user);
      loadHistory(); // Load cloud history if logged in, else local
    });
  } catch (err) {
    console.error('Firebase init error:', err);
    showToast('Invalid Firebase config JSON', 'error');
  }
}

// ===== Authentication UI & Logic =====
function updateAuthUI(user) {
  if (user) {
    dom.navLoginBtn.classList.add('hidden');
    dom.navProfileMenu.classList.remove('hidden');
    dom.userAvatar.textContent = user.email ? user.email[0].toUpperCase() : 'U';
  } else {
    dom.navLoginBtn.classList.remove('hidden');
    dom.navProfileMenu.classList.add('hidden');
    // Also show sign in button only if Firebase is configured
    if (!localStorage.getItem('firebaseConfig')) {
      dom.navLoginBtn.classList.add('hidden');
    }
  }
}

dom.navLoginBtn.addEventListener('click', () => {
  if (!auth) {
    showToast('Configure Firebase Settings first', 'warning');
    return;
  }
  dom.authModal.classList.add('active');
});

dom.closeAuth.addEventListener('click', () => {
  dom.authModal.classList.remove('active');
});

dom.tabLogin.addEventListener('click', () => {
  authMode = 'login';
  dom.tabLogin.classList.add('active');
  dom.tabSignup.classList.remove('active');
  dom.authSubmitBtn.textContent = 'Sign In';
  dom.authTitle.textContent = 'Sign In';
});

dom.tabSignup.addEventListener('click', () => {
  authMode = 'signup';
  dom.tabSignup.classList.add('active');
  dom.tabLogin.classList.remove('active');
  dom.authSubmitBtn.textContent = 'Sign Up';
  dom.authTitle.textContent = 'Create Account';
});

dom.authSubmitBtn.addEventListener('click', async () => {
  const email = dom.authEmail.value;
  const pass = dom.authPassword.value;
  if (!email || !pass) return showToast('Please enter email and password', 'error');
  
  dom.authSubmitBtn.textContent = 'Loading...';
  try {
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, pass);
      showToast('Logged in successfully!');
    } else {
      await auth.createUserWithEmailAndPassword(email, pass);
      showToast('Account created successfully!');
    }
    dom.authModal.classList.remove('active');
    dom.authEmail.value = '';
    dom.authPassword.value = '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    dom.authSubmitBtn.textContent = authMode === 'login' ? 'Sign In' : 'Sign Up';
  }
});

dom.authGoogleBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    showToast('Logged in with Google!');
    dom.authModal.classList.remove('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

dom.logoutBtn.addEventListener('click', async () => {
  if (auth) {
    await auth.signOut();
    showToast('Signed out successfully');
  }
});

// ===== History Logic (Local vs Cloud) =====
async function saveToHistory(analysis) {
  if (currentUser && db) {
    // Cloud Save
    try {
      await db.collection('users').doc(currentUser.uid).collection('analyses').add({
        analysis: analysis,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      loadHistory(); // Refresh list
    } catch (err) {
      console.error('Cloud save failed', err);
    }
  } else {
    // Local Save
    try {
      let history = JSON.parse(localStorage.getItem('finsight_history') || '[]');
      history.unshift({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        analysis: analysis
      });
      history = history.slice(0, 10);
      localStorage.setItem('finsight_history', JSON.stringify(history));
      loadHistory();
    } catch (err) {
      console.error('Local save failed', err);
    }
  }
}

async function loadHistory() {
  dom.historyList.innerHTML = '';
  
  if (currentUser && db) {
    // Load Cloud History
    try {
      const snapshot = await db.collection('users').doc(currentUser.uid)
        .collection('analyses').orderBy('createdAt', 'desc').limit(10).get();
        
      if (snapshot.empty) {
        dom.historySection.style.display = 'none';
        return;
      }
      
      dom.historySection.style.display = 'block';
      
      snapshot.forEach(doc => {
        const data = doc.data().analysis;
        const dateObj = doc.data().createdAt ? doc.data().createdAt.toDate() : new Date();
        renderHistoryItem(data, dateObj, true);
      });
    } catch (err) {
      console.error('Error loading cloud history', err);
    }
  } else {
    // Load Local History
    try {
      let historyStr = localStorage.getItem('finsight_history');
      let history = historyStr ? JSON.parse(historyStr) : [];
      
      if (history.length === 0) {
        // Pre-populate with demos for new unauthenticated users
        const demos = getDemos();
        const t = Date.now();
        history = [
          { id: (t).toString(), date: new Date(t).toISOString(), analysis: demos['tech'] },
          { id: (t-1000).toString(), date: new Date(t-1000).toISOString(), analysis: demos['retail'] },
          { id: (t-2000).toString(), date: new Date(t-2000).toISOString(), analysis: demos['energy'] }
        ];
        localStorage.setItem('finsight_history', JSON.stringify(history));
      }
      
      dom.historySection.style.display = 'block';
      history.forEach(item => {
        renderHistoryItem(item.analysis, new Date(item.date), false);
      });
    } catch (err) {
      console.error('Error loading local history:', err);
    }
  }
}

function renderHistoryItem(data, dateObj, isCloud) {
  const dateStr = dateObj.toLocaleDateString();
  const el = document.createElement('a');
  el.className = 'history-item';
  
  // Compress for URL hash
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
  el.href = `#data=${compressed}`;
  
  el.innerHTML = `
    <div class="history-item-left">
      <div class="history-title">${data.data.companyName || 'Unknown Company'} ${isCloud ? '☁️' : ''}</div>
      <div class="history-meta">FY ${data.data.reportYear || 'Unknown'} • Analyzed on ${dateStr}</div>
    </div>
    <div class="history-status" style="background: var(--${data.healthStatus === 'good' ? 'success' : data.healthStatus === 'fair' ? 'warning' : 'danger'}-bg); color: var(--${data.healthStatus === 'good' ? 'accent-1' : data.healthStatus === 'fair' ? 'warning' : 'danger'})">
      ${data.healthLabel}
    </div>
  `;
  
  el.addEventListener('click', (e) => {
    setTimeout(() => loadFromHash(), 100);
  });
  
  dom.historyList.appendChild(el);
}

dom.navHistory.addEventListener('click', (e) => {
  e.preventDefault();
  dom.historySection.scrollIntoView({ behavior: 'smooth' });
});

// ===== Zero-Backend Sharing Logic =====
dom.shareBtn.addEventListener('click', async () => {
  if (!currentAnalysis) return;
  
  const originalText = dom.shareBtn.innerHTML;
  dom.shareBtn.innerHTML = 'Creating Link...';
  
  try {
    const compressedData = LZString.compressToEncodedURIComponent(JSON.stringify(currentAnalysis));
    window.history.replaceState(null, null, `#data=${compressedData}`);
    await navigator.clipboard.writeText(window.location.href);
    showToast('Share link copied to clipboard!');
  } catch (err) {
    console.error('Share error:', err);
    showToast('Failed to create share link', 'error');
  } finally {
    dom.shareBtn.innerHTML = originalText;
  }
});

// ===== App Initialization =====
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadFromHash();
});

window.addEventListener('hashchange', () => {
  loadFromHash();
});

function loadFromHash() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#data=')) {
    const compressedData = hash.substring(6);
    showView('loading-view');
    updateLoaderStep(1, 'Decompressing shared analysis...', 50);
    
    try {
      const jsonStr = LZString.decompressFromEncodedURIComponent(compressedData);
      if (jsonStr) {
        updateLoaderStep(5, 'Complete!', 100);
        setTimeout(() => {
          currentAnalysis = JSON.parse(jsonStr);
          renderDashboard(currentAnalysis, 'Shared Report');
        }, 300);
      } else {
        throw new Error("Decompression returned null");
      }
    } catch (err) {
      console.error('Load error:', err);
      showToast('Error loading shared analysis link. It may be corrupted.', 'error');
      window.history.replaceState(null, null, window.location.pathname);
      showView('landing-view');
    }
  }
}

// ===== Upload / Drag & Drop =====
['dragenter', 'dragover'].forEach(evt =>
  dom.uploadZone.addEventListener(evt, e => {
    e.preventDefault();
    dom.uploadZone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach(evt =>
  dom.uploadZone.addEventListener(evt, e => {
    e.preventDefault();
    dom.uploadZone.classList.remove('drag-over');
  })
);
dom.uploadZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') processFile(file);
});
dom.fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) processFile(file);
});
dom.demoBtn.addEventListener('click', () => runDemoAnalysis());
dom.newAnalysisBtn.addEventListener('click', () => {
  window.history.pushState(null, null, window.location.pathname);
  showView('landing-view');
  dom.fileInput.value = '';
});

// ===== Process Uploaded File =====
async function processFile(file) {
  window.history.replaceState(null, null, window.location.pathname);
  showView('loading-view');
  updateLoaderStep(1, 'Extracting text from document...', 10);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;
    const pagesToRead = Math.min(totalPages, 20);

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      updateLoaderStep(1, `Extracting text... Page ${i}/${pagesToRead}`, 10 + (30 * i / pagesToRead));
    }

    updateLoaderStep(2, 'Analyzing with AI...', 45);
    
    const apiKey = localStorage.getItem('geminiApiKey');
    let analysis;
    
    if (apiKey) {
      try {
        analysis = await analyzeWithGemini(fullText, apiKey, file.name);
      } catch (err) {
        console.error('Gemini API error, falling back to regex:', err);
        showToast('AI analysis failed. Using offline regex fallback.', 'warning');
        const data = extractFinancials(fullText);
        analysis = analyzeFinancials(data, fullText, file.name);
      }
    } else {
      showToast('No Gemini API key found. Using offline regex fallback.', 'warning');
      const data = extractFinancials(fullText);
      analysis = analyzeFinancials(data, fullText, file.name);
    }
    
    updateLoaderStep(5, 'Generating report...', 90);
    await delay(300);

    updateLoaderStep(5, 'Complete!', 100);
    await delay(300);

    currentAnalysis = analysis;
    saveToHistory(analysis); 
    
    renderDashboard(analysis, file.name);
  } catch (err) {
    console.error('Processing error:', err);
    dom.loaderStatus.textContent = 'Error processing file. Please try another PDF.';
  }
}

// ===== Gemini AI Integration =====
async function analyzeWithGemini(text, apiKey, fileName) {
  const truncatedText = text.substring(0, 30000);
  const systemPrompt = `You are an expert financial analyst AI. Extract financial data, compute key ratios, identify risks, and generate insights from the provided annual report text. Return ONLY a valid JSON object matching the exact structure requested, with no markdown formatting or markdown code blocks (do not wrap in \`\`\`json).`;
  
  const userPrompt = `
  Analyze this financial report text:
  ---
  ${truncatedText}
  ---
  
  Extract the following and return ONLY a raw JSON object (do not wrap in markdown):
  {
    "data": {
      "companyName": "extracted or guess from filename ${fileName}",
      "reportYear": "e.g., 2024",
      "revenue": numeric_value_in_absolute_dollars_or_null,
      "netIncome": numeric_or_null,
      "grossProfit": numeric_or_null,
      "operatingIncome": numeric_or_null,
      "ebitda": numeric_or_null,
      "totalAssets": numeric_or_null,
      "totalLiabilities": numeric_or_null,
      "totalEquity": numeric_or_null,
      "currentAssets": numeric_or_null,
      "currentLiabilities": numeric_or_null,
      "totalDebt": numeric_or_null,
      "cashFlow": numeric_or_null,
      "eps": numeric_or_null
    },
    "ratios": {
      "roe": { "name": "Return on Equity (ROE)", "value": "12.5%", "rawValue": 12.5, "barPercent": 40, "status": "good/fair/poor", "interpretation": "short sentence" },
      "roa": { "name": "Return on Assets (ROA)", "value": "5.2%", "rawValue": 5.2, "barPercent": 35, "status": "good/fair/poor", "interpretation": "short sentence" },
      "debtToEquity": { "name": "Debt-to-Equity Ratio", "value": "1.2x", "rawValue": 1.2, "barPercent": 40, "status": "good/fair/poor", "interpretation": "short sentence" },
      "currentRatio": { "name": "Current Ratio", "value": "1.5x", "rawValue": 1.5, "barPercent": 50, "status": "good/fair/poor", "interpretation": "short sentence" },
      "netProfitMargin": { "name": "Net Profit Margin", "value": "8.4%", "rawValue": 8.4, "barPercent": 33, "status": "good/fair/poor", "interpretation": "short sentence" }
    },
    "risks": [
      { "severity": "high/medium/low", "title": "Risk Title", "desc": "Short description" }
    ],
    "insights": [
      { "type": "positive/negative/neutral", "icon": "emoji", "text": "<strong>Topic:</strong> Insight description." }
    ],
    "healthStatus": "good/fair/poor",
    "healthLabel": "Strong/Fair/Weak Financial Health",
    "summary": "Executive summary paragraph."
  }
  
  Notes:
  - If a metric is completely absent, omit it from "data".
  - Compute ratios based on extracted data. For barPercent, 0-100 scale representing how good the metric is relative to standard benchmarks.
  - Extract 2-4 key risks from text (e.g. liquidity, litigation, macro conditions).
  - Provide 4-5 key insights highlighting strengths or weaknesses.
  `;

  updateLoaderStep(3, 'Gemini AI is analyzing financials...', 60);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const rawResponse = result.candidates[0].content.parts[0].text;
  
  updateLoaderStep(4, 'Formatting AI insights...', 80);
  
  try {
    return JSON.parse(rawResponse);
  } catch (e) {
    const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// ===== Loader Step Updater =====
function updateLoaderStep(step, status, progress) {
  dom.loaderStatus.textContent = status;
  dom.loaderBar.style.width = progress + '%';

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`ls-${i}`);
    el.classList.remove('active', 'done');
    if (i < step) el.classList.add('done');
    else if (i === step) el.classList.add('active');
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Offline Regex Fallback Extraction =====
function extractFinancials(text) {
  const t = text.replace(/,/g, '').replace(/\s+/g, ' ');
  const data = {};

  const patterns = {
    revenue: [
      /(?:total\s+)?(?:net\s+)?revenue[s]?\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
      /(?:total\s+)?(?:net\s+)?sales\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
      /turnover\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    netIncome: [
      /net\s+(?:income|profit|earnings)\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalAssets: [
      /total\s+assets\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalLiabilities: [
      /total\s+liabilities\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalEquity: [
      /(?:total\s+)?(?:shareholders?\s*['']?s?\s+)?equity\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    currentAssets: [
      /current\s+assets\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    currentLiabilities: [
      /current\s+liabilities\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    operatingIncome: [
      /operating\s+(?:income|profit)\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    ebitda: [
      /EBITDA\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    grossProfit: [
      /gross\s+profit\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalDebt: [
      /total\s+(?:long[\s-]term\s+)?debt\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    cashFlow: [
      /(?:net\s+)?cash\s+(?:from|provided\s+by)\s+operat(?:ing|ions)\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    eps: [
      /(?:basic\s+)?(?:diluted\s+)?(?:earnings?\s+per\s+share|EPS)\s*[\$₹€£]?\s*(\d+[\.\d]*)/i,
    ],
  };

  const unitMultiplier = (unit) => {
    if (!unit) return 1;
    switch (unit.toLowerCase()) {
      case 'billion': case 'bn': case 'b': return 1e9;
      case 'million': case 'mn': case 'm': return 1e6;
      case 'crore': case 'cr': return 1e7;
      case 'lakh': return 1e5;
      default: return 1;
    }
  };

  for (const [key, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const match = t.match(regex);
      if (match) {
        const val = parseFloat(match[1]);
        const mult = unitMultiplier(match[2]);
        data[key] = val * mult;
        break;
      }
    }
  }

  if (!data.totalEquity && data.totalAssets && data.totalLiabilities) {
    data.totalEquity = data.totalAssets - data.totalLiabilities;
  }
  
  const nameMatch = text.match(/(?:annual\s+report\s+(?:of\s+)?|welcome\s+to\s+)([A-Z][A-Za-z\s&.,]+?)(?:\s+(?:Ltd|Inc|Corp|Limited|PLC|LLC|Co\.))/i);
  data.companyName = nameMatch ? nameMatch[1].trim() : null;
  
  const yearMatch = text.match(/(?:FY|fiscal\s+year|annual\s+report)\s*['"]?\s*(20[0-9]{2})/i) || text.match(/(20[2-9][0-9])/);
  data.reportYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  return data;
}

function analyzeFinancials(data, rawText, fileName) {
  if (!data.companyName && fileName) data.companyName = fileName.replace('.pdf', '');
  
  const ratios = {};
  const risks = [];
  const insights = [];

  if (data.netIncome && data.totalEquity && data.totalEquity > 0) {
    ratios.roe = {
      name: 'Return on Equity (ROE)', value: (data.netIncome / data.totalEquity * 100).toFixed(2) + '%',
      rawValue: data.netIncome / data.totalEquity * 100, barPercent: Math.min((data.netIncome / data.totalEquity * 100) / 30 * 100, 100),
      status: data.netIncome / data.totalEquity > 0.15 ? 'good' : data.netIncome / data.totalEquity > 0.08 ? 'fair' : 'poor',
      interpretation: data.netIncome / data.totalEquity > 0.15 ? 'Strong returns for shareholders' : 'Adequate returns',
    };
  }
  if (data.totalLiabilities && data.totalEquity && data.totalEquity > 0) {
    const de = data.totalLiabilities / data.totalEquity;
    ratios.debtToEquity = {
      name: 'Debt-to-Equity Ratio', value: de.toFixed(2) + 'x', rawValue: de, barPercent: Math.min(de / 3 * 100, 100),
      status: de < 1 ? 'good' : de < 2 ? 'fair' : 'poor', interpretation: de < 1 ? 'Conservative leverage' : de < 2 ? 'Moderate leverage' : 'High leverage risk',
    };
  }
  if (data.currentAssets && data.currentLiabilities && data.currentLiabilities > 0) {
    const cr = data.currentAssets / data.currentLiabilities;
    ratios.currentRatio = {
      name: 'Current Ratio', value: cr.toFixed(2) + 'x', rawValue: cr, barPercent: Math.min(cr / 3 * 100, 100),
      status: cr >= 1.5 ? 'good' : cr >= 1 ? 'fair' : 'poor', interpretation: cr >= 1.5 ? 'Healthy short-term liquidity' : 'Tight liquidity',
    };
  }
  if (data.netIncome && data.revenue && data.revenue > 0) {
    const npm = data.netIncome / data.revenue * 100;
    ratios.netProfitMargin = {
      name: 'Net Profit Margin', value: npm.toFixed(2) + '%', rawValue: npm, barPercent: Math.min(npm / 25 * 100, 100),
      status: npm > 15 ? 'good' : npm > 5 ? 'fair' : 'poor', interpretation: npm > 15 ? 'Excellent margins' : 'Moderate margins',
    };
  }

  if (data.revenue) insights.push({ type: 'neutral', icon: '📊', text: `<strong>Revenue</strong> is ${formatCurrency(data.revenue)}.` });
  if (data.netIncome && data.revenue) insights.push({ type: data.netIncome > 0 ? 'positive' : 'negative', icon: data.netIncome > 0 ? '✅' : '🔻', text: `<strong>Profitability:</strong> Retains ${(data.netIncome / data.revenue * 100).toFixed(1)}% of revenue as profit.` });

  if (data.totalLiabilities && data.totalEquity && data.totalLiabilities / data.totalEquity >= 2) {
    risks.push({ severity: 'high', title: 'High Leverage', desc: 'Debt-to-Equity ratio indicates heavy reliance on debt financing.' });
  }
  if (data.currentAssets && data.currentLiabilities && data.currentAssets / data.currentLiabilities < 1) {
    risks.push({ severity: 'high', title: 'Liquidity Concern', desc: 'Current ratio is below 1, indicating potential struggle with short-term obligations.' });
  }
  if (risks.length === 0) risks.push({ severity: 'low', title: 'No Major Quantitative Risks Detected', desc: 'Financial ratios appear within acceptable bounds.' });

  let healthScore = 0, healthFactors = 0;
  if (ratios.roe) { healthScore += ratios.roe.status === 'good' ? 3 : ratios.roe.status === 'fair' ? 2 : 1; healthFactors++; }
  if (ratios.currentRatio) { healthScore += ratios.currentRatio.status === 'good' ? 3 : ratios.currentRatio.status === 'fair' ? 2 : 1; healthFactors++; }
  
  const avgHealth = healthFactors > 0 ? healthScore / healthFactors : 2;
  const healthStatus = avgHealth >= 2.5 ? 'good' : avgHealth >= 1.8 ? 'fair' : 'poor';
  
  return {
    data, ratios, risks, insights, healthStatus,
    healthLabel: avgHealth >= 2.5 ? 'Strong Financial Health' : avgHealth >= 1.8 ? 'Fair Financial Health' : 'Weak Financial Health',
    summary: `Based on offline regex analysis of ${data.companyName || 'the company'} (${data.reportYear}), revenue is ${data.revenue ? formatCurrency(data.revenue) : 'unknown'} with net income of ${data.netIncome ? formatCurrency(data.netIncome) : 'unknown'}. For more accurate insights, please configure the Gemini API in Settings.`
  };
}

// ===== Render Dashboard =====
function renderDashboard(analysis, fileName) {
  const { data, ratios, risks, insights, healthStatus, healthLabel, summary } = analysis;

  dom.companyName.textContent = data.companyName || fileName.replace('.pdf', '').replace(/[_-]/g, ' ');
  dom.reportPeriod.textContent = `Annual Report ${data.reportYear || new Date().getFullYear()}`;
  dom.healthBadge.className = `health-badge ${healthStatus}`;
  dom.healthLabel.textContent = healthLabel;
  dom.analysisDate.textContent = `Analyzed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  dom.execSummary.textContent = summary;

  const kpis = [];
  if (data.revenue) kpis.push({ label: 'Revenue', value: formatCurrencyShort(data.revenue), sub: `FY ${data.reportYear}`, trend: 'neutral' });
  if (data.netIncome) kpis.push({ label: 'Net Income', value: formatCurrencyShort(data.netIncome), sub: data.revenue ? `${(data.netIncome / data.revenue * 100).toFixed(1)}% margin` : '', trend: data.netIncome > 0 ? 'up' : 'down' });
  if (data.totalAssets) kpis.push({ label: 'Total Assets', value: formatCurrencyShort(data.totalAssets), sub: 'Balance Sheet', trend: 'neutral' });
  if (data.totalEquity) kpis.push({ label: "Shareholders' Equity", value: formatCurrencyShort(data.totalEquity), sub: data.totalAssets ? `${(data.totalEquity / data.totalAssets * 100).toFixed(0)}% of assets` : '', trend: 'neutral' });
  if (data.ebitda) kpis.push({ label: 'EBITDA', value: formatCurrencyShort(data.ebitda), sub: data.revenue ? `${(data.ebitda / data.revenue * 100).toFixed(1)}% margin` : '', trend: 'up' });
  if (data.cashFlow) kpis.push({ label: 'Operating Cash Flow', value: formatCurrencyShort(data.cashFlow), sub: '', trend: data.cashFlow > 0 ? 'up' : 'down' });
  if (data.eps) kpis.push({ label: 'EPS', value: `$${data.eps.toFixed(2)}`, sub: 'Earnings Per Share', trend: data.eps > 0 ? 'up' : 'down' });
  if (data.totalDebt) kpis.push({ label: 'Total Debt', value: formatCurrencyShort(data.totalDebt), sub: '', trend: 'down' });

  dom.kpiGrid.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
      <div class="kpi-trend ${k.trend}">
        ${k.trend === 'up' ? '▲' : k.trend === 'down' ? '▼' : '●'} ${k.trend === 'up' ? 'Positive' : k.trend === 'down' ? 'Watch' : 'Tracked'}
      </div>
    </div>
  `).join('');

  const ratioEntries = Object.values(ratios || {});
  dom.ratiosGrid.innerHTML = ratioEntries.map(r => `
    <div class="ratio-item">
      <div class="ratio-header">
        <span class="ratio-name">${r.name}</span>
        <span class="ratio-value">${r.value}</span>
      </div>
      <div class="ratio-bar-bg">
        <div class="ratio-bar ${r.status === 'poor' ? 'danger' : r.status === 'fair' ? 'warning' : ''}" style="width: ${r.barPercent || 50}%"></div>
      </div>
      <span class="ratio-interpretation">${r.interpretation}</span>
    </div>
  `).join('');

  (risks || []).sort((a, b) => { const order = { high: 0, medium: 1, low: 2 }; return order[a.severity] - order[b.severity]; });
  dom.riskList.innerHTML = (risks || []).map(r => `
    <div class="risk-item ${r.severity}">
      <span class="risk-severity">${r.severity}</span>
      <div class="risk-content">
        <h4>${r.title}</h4>
        <p>${r.desc}</p>
      </div>
    </div>
  `).join('');

  dom.insightsGrid.innerHTML = (insights || []).map(i => `
    <div class="insight-item">
      <div class="insight-icon ${i.type}">${i.icon}</div>
      <div class="insight-text">${i.text}</div>
    </div>
  `).join('');

  const tableData = [];
  if (data.revenue) tableData.push(['Revenue', formatCurrency(data.revenue), 'Total sales/turnover from operations']);
  if (data.netIncome) tableData.push(['Net Income', formatCurrency(data.netIncome), 'Bottom-line profit after all expenses and taxes']);
  if (data.grossProfit) tableData.push(['Gross Profit', formatCurrency(data.grossProfit), 'Revenue minus cost of goods sold']);
  if (data.operatingIncome) tableData.push(['Operating Income', formatCurrency(data.operatingIncome), 'Profit from core business operations']);
  if (data.ebitda) tableData.push(['EBITDA', formatCurrency(data.ebitda), 'Earnings before interest, taxes, depreciation & amortization']);
  if (data.totalAssets) tableData.push(['Total Assets', formatCurrency(data.totalAssets), 'All economic resources owned by the company']);
  if (data.totalLiabilities) tableData.push(['Total Liabilities', formatCurrency(data.totalLiabilities), 'All financial obligations and debts']);
  if (data.totalEquity) tableData.push(["Shareholders' Equity", formatCurrency(data.totalEquity), 'Net worth belonging to shareholders']);
  if (data.currentAssets) tableData.push(['Current Assets', formatCurrency(data.currentAssets), 'Assets convertible to cash within one year']);
  if (data.currentLiabilities) tableData.push(['Current Liabilities', formatCurrency(data.currentLiabilities), 'Obligations due within one year']);
  if (data.totalDebt) tableData.push(['Total Debt', formatCurrency(data.totalDebt), 'Outstanding borrowings and debt instruments']);
  if (data.cashFlow) tableData.push(['Operating Cash Flow', formatCurrency(data.cashFlow), 'Cash generated from core business operations']);
  if (data.eps) tableData.push(['Earnings Per Share', `$${data.eps.toFixed(2)}`, 'Net earnings attributable to each common share']);

  dom.dataTbody.innerHTML = tableData.map(([metric, value, interp]) => `
    <tr><td>${metric}</td><td>${value}</td><td>${interp}</td></tr>
  `).join('');

  renderCharts(data);
  showView('dashboard-view');
}

// ===== Charts =====
let chartInstances = [];
function renderCharts(data) {
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  const chartColors = { green: '#34d399', cyan: '#06b6d4', purple: '#818cf8', pink: '#f472b6', orange: '#f59e0b' };
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(148,163,184,0.08)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const revenueCtx = document.getElementById('chart-revenue');
  if (data.revenue || data.netIncome) {
    const labels = [], revenueData = [];
    if (data.revenue) { labels.push('Revenue'); revenueData.push(data.revenue / 1e6); }
    if (data.grossProfit) { labels.push('Gross Profit'); revenueData.push(data.grossProfit / 1e6); }
    if (data.ebitda) { labels.push('EBITDA'); revenueData.push(data.ebitda / 1e6); }
    if (data.operatingIncome) { labels.push('Operating Income'); revenueData.push(data.operatingIncome / 1e6); }
    if (data.netIncome) { labels.push('Net Income'); revenueData.push(data.netIncome / 1e6); }

    chartInstances.push(new Chart(revenueCtx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Amount ($M)', data: revenueData, backgroundColor: [chartColors.green, chartColors.cyan, chartColors.purple, chartColors.orange, chartColors.pink], borderRadius: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(17,24,39,0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(52,211,153,0.2)', borderWidth: 1, padding: 12, cornerRadius: 10, callbacks: { label: ctx => `$${ctx.parsed.y.toFixed(1)}M` } },
        },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { callback: v => `$${v}M` } }, x: { grid: { display: false } } },
      },
    }));
  }

  const assetsCtx = document.getElementById('chart-assets');
  if (data.totalAssets || data.totalLiabilities) {
    const pieLabels = [], pieData = [], pieColors = [];
    if (data.totalAssets) { pieLabels.push('Total Assets'); pieData.push(data.totalAssets); pieColors.push(chartColors.green); }
    if (data.totalLiabilities) { pieLabels.push('Total Liabilities'); pieData.push(data.totalLiabilities); pieColors.push(chartColors.orange); }
    if (data.totalEquity) { pieLabels.push("Shareholders' Equity"); pieData.push(data.totalEquity); pieColors.push(chartColors.purple); }

    chartInstances.push(new Chart(assetsCtx, {
      type: 'doughnut',
      data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: 'rgba(10,14,23,0.8)', borderWidth: 3, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } },
          tooltip: { backgroundColor: 'rgba(17,24,39,0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(52,211,153,0.2)', borderWidth: 1, padding: 12, cornerRadius: 10, callbacks: { label: ctx => `${ctx.label}: ${formatCurrencyShort(ctx.parsed)}` } },
        },
      },
    }));
  }
}

function formatCurrency(num) {
  if (typeof num !== 'number') return num;
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + ' Trillion';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + ' Billion';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + ' Million';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
  return '$' + num.toFixed(2);
}

function formatCurrencyShort(num) {
  if (typeof num !== 'number') return num;
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
  return '$' + num.toFixed(0);
}

// ===== Demo Data =====
function getDemos() {
  return {
    'tech': {
      "data": { "companyName": "Nextera Technologies Inc.", "reportYear": "2024", "revenue": 48200000000, "netIncome": 7840000000, "grossProfit": 21690000000, "operatingIncome": 12050000000, "ebitda": 15700000000, "totalAssets": 132500000000, "totalLiabilities": 85200000000, "totalEquity": 47300000000, "currentAssets": 24800000000, "currentLiabilities": 18600000000, "totalDebt": 42100000000, "cashFlow": 11200000000, "eps": 15.82 },
      "ratios": {
        "roe": { "name": "Return on Equity (ROE)", "value": "16.58%", "rawValue": 16.58, "barPercent": 55, "status": "good", "interpretation": "Strong returns for shareholders." },
        "debtToEquity": { "name": "Debt-to-Equity Ratio", "value": "1.80x", "rawValue": 1.8, "barPercent": 60, "status": "fair", "interpretation": "Moderate leverage." },
        "currentRatio": { "name": "Current Ratio", "value": "1.33x", "rawValue": 1.33, "barPercent": 44, "status": "fair", "interpretation": "Adequate short-term liquidity." },
        "netProfitMargin": { "name": "Net Profit Margin", "value": "16.27%", "rawValue": 16.27, "barPercent": 65, "status": "good", "interpretation": "Excellent profitability margins." }
      },
      "risks": [
        { "severity": "medium", "title": "Supply Chain Vulnerability", "desc": "Dependency on key semiconductor suppliers." }
      ],
      "insights": [
        { "type": "positive", "icon": "🚀", "text": "<strong>Revenue Growth:</strong> Top-line performance is exceptional." }
      ],
      "healthStatus": "good", "healthLabel": "Strong Financial Health", "summary": "Nextera Technologies Inc. (2024) demonstrates robust financial health with $48.2 Billion in revenue."
    },
    'retail': {
      "data": { "companyName": "OmniMart Corp", "reportYear": "2024", "revenue": 142000000000, "netIncome": 1200000000, "grossProfit": 35000000000, "operatingIncome": 3100000000, "ebitda": 5800000000, "totalAssets": 89000000000, "totalLiabilities": 75000000000, "totalEquity": 14000000000, "currentAssets": 21000000000, "currentLiabilities": 26000000000, "totalDebt": 45000000000, "cashFlow": 4200000000, "eps": 1.45 },
      "ratios": {
        "roe": { "name": "Return on Equity (ROE)", "value": "8.57%", "rawValue": 8.57, "barPercent": 28, "status": "fair", "interpretation": "Moderate returns on a thin equity base." },
        "debtToEquity": { "name": "Debt-to-Equity Ratio", "value": "5.36x", "rawValue": 5.36, "barPercent": 100, "status": "poor", "interpretation": "Highly leveraged capital structure." },
        "currentRatio": { "name": "Current Ratio", "value": "0.81x", "rawValue": 0.81, "barPercent": 27, "status": "poor", "interpretation": "Working capital deficit indicates liquidity pressure." },
        "netProfitMargin": { "name": "Net Profit Margin", "value": "0.85%", "rawValue": 0.85, "barPercent": 3, "status": "poor", "interpretation": "Razor-thin margins typical of discount retail." }
      },
      "risks": [
        { "severity": "high", "title": "Liquidity Risk", "desc": "Current liabilities exceed current assets by $5B." },
        { "severity": "high", "title": "High Leverage", "desc": "Significant debt burden relative to equity." }
      ],
      "insights": [
        { "type": "negative", "icon": "⚠️", "text": "<strong>Margin Compression:</strong> Net margins have fallen below 1%." }
      ],
      "healthStatus": "poor", "healthLabel": "Weak Financial Health", "summary": "OmniMart Corp is struggling with significant debt and liquidity constraints, despite massive $142B top-line revenue."
    },
    'energy': {
      "data": { "companyName": "EcoPower Utilities", "reportYear": "2024", "revenue": 18500000000, "netIncome": 2100000000, "grossProfit": 8500000000, "operatingIncome": 3800000000, "ebitda": 6200000000, "totalAssets": 95000000000, "totalLiabilities": 62000000000, "totalEquity": 33000000000, "currentAssets": 8500000000, "currentLiabilities": 9200000000, "totalDebt": 48000000000, "cashFlow": 5500000000, "eps": 4.20 },
      "ratios": {
        "roe": { "name": "Return on Equity (ROE)", "value": "6.36%", "rawValue": 6.36, "barPercent": 21, "status": "fair", "interpretation": "Stable, regulated utility returns." },
        "debtToEquity": { "name": "Debt-to-Equity Ratio", "value": "1.88x", "rawValue": 1.88, "barPercent": 62, "status": "fair", "interpretation": "Standard leverage for asset-heavy utility." },
        "currentRatio": { "name": "Current Ratio", "value": "0.92x", "rawValue": 0.92, "barPercent": 30, "status": "fair", "interpretation": "Slightly tight liquidity, normal for sector." },
        "netProfitMargin": { "name": "Net Profit Margin", "value": "11.35%", "rawValue": 11.35, "barPercent": 45, "status": "good", "interpretation": "Solid profitability on recurring revenue." }
      },
      "risks": [
        { "severity": "medium", "title": "Regulatory Policy", "desc": "Potential impacts from new clean energy mandates." }
      ],
      "insights": [
        { "type": "positive", "icon": "💧", "text": "<strong>Cash Generation:</strong> Strong operating cash flow supports dividend." }
      ],
      "healthStatus": "fair", "healthLabel": "Fair Financial Health", "summary": "EcoPower Utilities remains stable with consistent 11% margins and strong cash flow, offset by significant structural debt."
    }
  };
}

function runDemoAnalysis(type = 'tech') {
  const demos = getDemos();
  const demoData = demos[type] || demos['tech'];
  
  currentAnalysis = demoData;
  saveToHistory(demoData);
  renderDashboard(demoData, 'Demo Report');
}
