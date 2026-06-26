/**
 * FinSight AI — Financial Statement Analyzer
 * Client-side PDF parsing, financial data extraction, ratio computation,
 * risk assessment, and insight generation.
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
};

// ===== View Switcher =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  showView('landing-view');
  dom.fileInput.value = '';
});

// ===== Process Uploaded File =====
async function processFile(file) {
  showView('loading-view');
  updateLoaderStep(1, 'Extracting text from document...', 10);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      updateLoaderStep(1, `Extracting text... Page ${i}/${totalPages}`, 10 + (30 * i / totalPages));
    }

    updateLoaderStep(2, 'Recognizing financial data...', 45);
    await delay(500);

    updateLoaderStep(3, 'Computing financial ratios...', 60);
    await delay(400);

    const financials = extractFinancials(fullText);

    updateLoaderStep(4, 'Assessing risks...', 75);
    await delay(400);

    const analysis = analyzeFinancials(financials, fullText);

    updateLoaderStep(5, 'Generating report...', 90);
    await delay(500);

    updateLoaderStep(5, 'Complete!', 100);
    await delay(300);

    renderDashboard(analysis, file.name);
  } catch (err) {
    console.error('Processing error:', err);
    dom.loaderStatus.textContent = 'Error processing file. Please try another PDF.';
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

// ===== Financial Data Extraction =====
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
      /profit\s+after\s+tax\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
      /PAT\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalAssets: [
      /total\s+assets\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalLiabilities: [
      /total\s+liabilities\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalEquity: [
      /(?:total\s+)?(?:shareholders?\s*['']?s?\s+)?equity\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
      /(?:total\s+)?(?:stockholders?\s*['']?s?\s+)?equity\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    currentAssets: [
      /current\s+assets\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    currentLiabilities: [
      /current\s+liabilities\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    operatingIncome: [
      /operating\s+(?:income|profit)\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
      /EBIT\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    ebitda: [
      /EBITDA\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    grossProfit: [
      /gross\s+profit\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
    ],
    totalDebt: [
      /total\s+(?:long[\s-]term\s+)?debt\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
      /borrowings?\s*[\$₹€£]?\s*(\d+[\.\d]*)\s*(billion|million|crore|lakh|mn|bn|cr|m|b)?/i,
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

  // Derive equity if not found
  if (!data.totalEquity && data.totalAssets && data.totalLiabilities) {
    data.totalEquity = data.totalAssets - data.totalLiabilities;
  }

  // Try to extract company name
  const nameMatch = text.match(/(?:annual\s+report\s+(?:of\s+)?|welcome\s+to\s+)([A-Z][A-Za-z\s&.,]+?)(?:\s+(?:Ltd|Inc|Corp|Limited|PLC|LLC|Co\.))/i);
  data.companyName = nameMatch ? nameMatch[1].trim() : null;

  // Try to extract year
  const yearMatch = text.match(/(?:FY|fiscal\s+year|annual\s+report)\s*['"]?\s*(20[0-9]{2})/i) || text.match(/(20[2-9][0-9])/);
  data.reportYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  return data;
}

// ===== Financial Analysis Engine =====
function analyzeFinancials(data, rawText) {
  const ratios = {};
  const risks = [];
  const insights = [];

  // ----- Compute Ratios -----
  if (data.netIncome && data.totalEquity && data.totalEquity > 0) {
    ratios.roe = {
      name: 'Return on Equity (ROE)',
      value: (data.netIncome / data.totalEquity * 100).toFixed(2) + '%',
      rawValue: data.netIncome / data.totalEquity * 100,
      barPercent: Math.min((data.netIncome / data.totalEquity * 100) / 30 * 100, 100),
      status: data.netIncome / data.totalEquity > 0.15 ? 'good' : data.netIncome / data.totalEquity > 0.08 ? 'fair' : 'poor',
      interpretation: data.netIncome / data.totalEquity > 0.15 ? 'Strong — generating excellent returns for shareholders' : data.netIncome / data.totalEquity > 0.08 ? 'Adequate — returns are reasonable' : 'Weak — below-average returns on shareholder investment',
    };
  }
  if (data.netIncome && data.totalAssets && data.totalAssets > 0) {
    ratios.roa = {
      name: 'Return on Assets (ROA)',
      value: (data.netIncome / data.totalAssets * 100).toFixed(2) + '%',
      rawValue: data.netIncome / data.totalAssets * 100,
      barPercent: Math.min((data.netIncome / data.totalAssets * 100) / 15 * 100, 100),
      status: data.netIncome / data.totalAssets > 0.08 ? 'good' : data.netIncome / data.totalAssets > 0.03 ? 'fair' : 'poor',
      interpretation: data.netIncome / data.totalAssets > 0.08 ? 'Efficient asset utilization driving strong profitability' : 'Assets are being utilized at an average efficiency level',
    };
  }
  if (data.totalLiabilities && data.totalEquity && data.totalEquity > 0) {
    const de = data.totalLiabilities / data.totalEquity;
    ratios.debtToEquity = {
      name: 'Debt-to-Equity Ratio',
      value: de.toFixed(2) + 'x',
      rawValue: de,
      barPercent: Math.min(de / 3 * 100, 100),
      status: de < 1 ? 'good' : de < 2 ? 'fair' : 'poor',
      interpretation: de < 1 ? 'Conservative leverage — well-balanced capital structure' : de < 2 ? 'Moderate leverage — manageable but warrants monitoring' : 'High leverage — potential financial stress risk',
    };
    if (de >= 2) risks.push({ severity: 'high', title: 'High Leverage', desc: `Debt-to-Equity ratio of ${de.toFixed(2)}x indicates the company is heavily reliant on debt financing, which could amplify losses during downturns.` });
    else if (de >= 1.5) risks.push({ severity: 'medium', title: 'Elevated Debt Levels', desc: `Debt-to-Equity ratio of ${de.toFixed(2)}x is above the comfortable range. Monitor interest coverage closely.` });
  }
  if (data.currentAssets && data.currentLiabilities && data.currentLiabilities > 0) {
    const cr = data.currentAssets / data.currentLiabilities;
    ratios.currentRatio = {
      name: 'Current Ratio',
      value: cr.toFixed(2) + 'x',
      rawValue: cr,
      barPercent: Math.min(cr / 3 * 100, 100),
      status: cr >= 1.5 ? 'good' : cr >= 1 ? 'fair' : 'poor',
      interpretation: cr >= 1.5 ? 'Healthy liquidity — strong ability to meet short-term obligations' : cr >= 1 ? 'Adequate liquidity — just able to cover current liabilities' : 'Poor liquidity — may struggle to meet short-term obligations',
    };
    if (cr < 1) risks.push({ severity: 'high', title: 'Liquidity Concern', desc: `Current ratio of ${cr.toFixed(2)}x is below 1, indicating the company may not have enough liquid assets to cover short-term obligations.` });
    else if (cr < 1.2) risks.push({ severity: 'medium', title: 'Tight Liquidity', desc: `Current ratio of ${cr.toFixed(2)}x is barely above 1. Short-term cash management requires careful attention.` });
  }
  if (data.netIncome && data.revenue && data.revenue > 0) {
    const npm = data.netIncome / data.revenue * 100;
    ratios.netProfitMargin = {
      name: 'Net Profit Margin',
      value: npm.toFixed(2) + '%',
      rawValue: npm,
      barPercent: Math.min(npm / 25 * 100, 100),
      status: npm > 15 ? 'good' : npm > 5 ? 'fair' : 'poor',
      interpretation: npm > 15 ? 'Excellent margins reflecting strong cost control and pricing power' : npm > 5 ? 'Moderate margins — room for operational efficiency improvements' : 'Thin margins — vulnerable to cost increases',
    };
    if (npm < 3) risks.push({ severity: 'high', title: 'Razor-Thin Margins', desc: `Net profit margin of only ${npm.toFixed(1)}% leaves little buffer against cost increases or revenue declines.` });
  }
  if (data.grossProfit && data.revenue && data.revenue > 0) {
    const gpm = data.grossProfit / data.revenue * 100;
    ratios.grossProfitMargin = {
      name: 'Gross Profit Margin',
      value: gpm.toFixed(2) + '%',
      rawValue: gpm,
      barPercent: Math.min(gpm / 60 * 100, 100),
      status: gpm > 40 ? 'good' : gpm > 20 ? 'fair' : 'poor',
      interpretation: gpm > 40 ? 'Strong gross margins indicative of pricing power or efficient production' : 'Moderate gross margins — common in competitive or capital-intensive industries',
    };
  }
  if (data.operatingIncome && data.revenue && data.revenue > 0) {
    const opm = data.operatingIncome / data.revenue * 100;
    ratios.operatingMargin = {
      name: 'Operating Margin',
      value: opm.toFixed(2) + '%',
      rawValue: opm,
      barPercent: Math.min(opm / 30 * 100, 100),
      status: opm > 15 ? 'good' : opm > 5 ? 'fair' : 'poor',
      interpretation: opm > 15 ? 'Healthy operating efficiency with strong core business performance' : 'Moderate operating performance — operational improvements could boost margins',
    };
  }
  if (data.totalDebt && data.totalEquity && data.totalEquity > 0) {
    const dte = data.totalDebt / data.totalEquity;
    if (!ratios.debtToEquity) {
      ratios.debtToEquity = {
        name: 'Debt-to-Equity Ratio',
        value: dte.toFixed(2) + 'x',
        rawValue: dte,
        barPercent: Math.min(dte / 3 * 100, 100),
        status: dte < 1 ? 'good' : dte < 2 ? 'fair' : 'poor',
        interpretation: dte < 1 ? 'Conservative leverage' : 'Elevated leverage levels',
      };
    }
  }

  // ----- Generate Insights -----
  if (data.revenue) {
    insights.push({ type: 'neutral', icon: '📊', text: `<strong>Revenue</strong> stands at ${formatCurrency(data.revenue)}, representing the company's top-line performance from core business operations.` });
  }
  if (data.netIncome && data.revenue) {
    const margin = (data.netIncome / data.revenue * 100).toFixed(1);
    const type = margin > 10 ? 'positive' : margin > 0 ? 'neutral' : 'negative';
    insights.push({ type, icon: type === 'positive' ? '✅' : type === 'negative' ? '🔻' : '📈', text: `<strong>Profitability:</strong> The company retains ${margin}% of revenue as net profit. ${margin > 10 ? 'This indicates strong pricing power and operational efficiency.' : margin > 0 ? 'Moderate profitability with room for improvement.' : 'The company is currently unprofitable — immediate attention needed.'}` });
  }
  if (data.totalAssets && data.totalLiabilities) {
    const assetCoverage = ((data.totalAssets - data.totalLiabilities) / data.totalAssets * 100).toFixed(1);
    insights.push({ type: assetCoverage > 40 ? 'positive' : 'neutral', icon: assetCoverage > 40 ? '🏛️' : '📋', text: `<strong>Balance Sheet Health:</strong> ${assetCoverage}% of total assets are funded by equity, indicating a ${assetCoverage > 40 ? 'strong' : 'moderate'} financial foundation.` });
  }
  if (data.ebitda && data.revenue) {
    const ebitdaMargin = (data.ebitda / data.revenue * 100).toFixed(1);
    insights.push({ type: ebitdaMargin > 20 ? 'positive' : 'neutral', icon: '⚡', text: `<strong>EBITDA Margin:</strong> ${ebitdaMargin}% — measures core operational cash generation before financing and accounting decisions.` });
  }
  if (data.cashFlow) {
    insights.push({ type: data.cashFlow > 0 ? 'positive' : 'negative', icon: data.cashFlow > 0 ? '💵' : '🔻', text: `<strong>Operating Cash Flow:</strong> ${formatCurrency(data.cashFlow)} — ${data.cashFlow > 0 ? 'positive cash generation supports business sustainability and growth investments' : 'negative operating cash flow raises concerns about business sustainability'}.` });
  }
  if (data.eps) {
    insights.push({ type: data.eps > 0 ? 'positive' : 'negative', icon: '📈', text: `<strong>Earnings Per Share:</strong> $${data.eps.toFixed(2)} — ${data.eps > 0 ? 'the company is generating positive per-share returns' : 'negative EPS indicates losses being passed to shareholders'}.` });
  }

  // Additional text-based risk detection
  const riskKeywords = [
    { pattern: /going concern/i, title: 'Going Concern Warning', desc: 'The report mentions "going concern" language, suggesting auditors have flagged doubts about the company\'s ability to continue operating.', severity: 'high' },
    { pattern: /material weakness/i, title: 'Internal Control Weakness', desc: 'A "material weakness" in internal controls has been identified, indicating significant risk of financial misstatement.', severity: 'high' },
    { pattern: /litigation|lawsuit|legal proceedings/i, title: 'Pending Litigation', desc: 'The report references ongoing legal proceedings that could result in material financial impact.', severity: 'medium' },
    { pattern: /regulatory\s+risk|compliance\s+risk/i, title: 'Regulatory Risk', desc: 'Regulatory and compliance risks are mentioned, which could affect operations and profitability.', severity: 'medium' },
    { pattern: /foreign\s+(?:currency|exchange)\s+risk/i, title: 'Currency Risk', desc: 'Exposure to foreign exchange fluctuations could impact reported earnings and asset values.', severity: 'low' },
    { pattern: /supply\s+chain\s+(?:disruption|risk)/i, title: 'Supply Chain Risk', desc: 'Supply chain vulnerabilities are identified that could affect production and revenue.', severity: 'medium' },
    { pattern: /climate\s+risk|environmental\s+risk/i, title: 'Environmental Risk', desc: 'Climate and environmental risks could lead to regulatory costs, asset impairments, or operational disruptions.', severity: 'low' },
    { pattern: /cybersecurity|data\s+breach/i, title: 'Cybersecurity Risk', desc: 'Cybersecurity threats are acknowledged, with potential for data breaches and associated costs.', severity: 'medium' },
  ];
  riskKeywords.forEach(rk => {
    if (rk.pattern.test(rawText)) {
      risks.push({ severity: rk.severity, title: rk.title, desc: rk.desc });
    }
  });

  if (risks.length === 0) {
    risks.push({ severity: 'low', title: 'No Major Red Flags Detected', desc: 'The AI analysis did not detect critical risk indicators in the document text. However, always cross-reference with professional due diligence.' });
  }

  // Health score
  let healthScore = 0;
  let healthFactors = 0;
  if (ratios.roe) { healthScore += ratios.roe.status === 'good' ? 3 : ratios.roe.status === 'fair' ? 2 : 1; healthFactors++; }
  if (ratios.currentRatio) { healthScore += ratios.currentRatio.status === 'good' ? 3 : ratios.currentRatio.status === 'fair' ? 2 : 1; healthFactors++; }
  if (ratios.debtToEquity) { healthScore += ratios.debtToEquity.status === 'good' ? 3 : ratios.debtToEquity.status === 'fair' ? 2 : 1; healthFactors++; }
  if (ratios.netProfitMargin) { healthScore += ratios.netProfitMargin.status === 'good' ? 3 : ratios.netProfitMargin.status === 'fair' ? 2 : 1; healthFactors++; }

  const avgHealth = healthFactors > 0 ? healthScore / healthFactors : 2;
  const healthStatus = avgHealth >= 2.5 ? 'good' : avgHealth >= 1.8 ? 'fair' : 'poor';
  const healthLabelText = avgHealth >= 2.5 ? 'Strong Financial Health' : avgHealth >= 1.8 ? 'Fair Financial Health' : 'Weak Financial Health';

  // Executive summary
  let summary = `Based on AI analysis of the uploaded annual report`;
  if (data.companyName) summary += ` of ${data.companyName}`;
  summary += ` (${data.reportYear}), `;

  if (data.revenue) summary += `the company generated revenue of ${formatCurrency(data.revenue)}`;
  if (data.netIncome) summary += ` with a net income of ${formatCurrency(data.netIncome)}`;
  summary += '. ';

  if (ratios.netProfitMargin) summary += `Net profit margin is ${ratios.netProfitMargin.value}. `;
  if (ratios.roe) summary += `Return on equity stands at ${ratios.roe.value}, which is ${ratios.roe.status === 'good' ? 'above industry average' : 'within normal range'}. `;
  if (ratios.debtToEquity) summary += `The debt-to-equity ratio of ${ratios.debtToEquity.value} indicates ${ratios.debtToEquity.status === 'good' ? 'conservative' : ratios.debtToEquity.status === 'fair' ? 'moderate' : 'aggressive'} use of leverage. `;
  if (ratios.currentRatio) summary += `Liquidity position (current ratio: ${ratios.currentRatio.value}) is ${ratios.currentRatio.status === 'good' ? 'healthy' : 'manageable'}. `;

  const highRisks = risks.filter(r => r.severity === 'high').length;
  if (highRisks > 0) summary += `⚠️ ${highRisks} high-severity risk factor(s) were identified that warrant immediate attention.`;
  else summary += 'No critical red flags were detected in this analysis.';

  return {
    data,
    ratios,
    risks,
    insights,
    healthStatus,
    healthLabel: healthLabelText,
    summary,
  };
}

// ===== Render Dashboard =====
function renderDashboard(analysis, fileName) {
  const { data, ratios, risks, insights, healthStatus, healthLabel, summary } = analysis;

  // Company info
  dom.companyName.textContent = data.companyName || fileName.replace('.pdf', '').replace(/[_-]/g, ' ');
  dom.reportPeriod.textContent = `Annual Report ${data.reportYear}`;
  dom.healthBadge.className = `health-badge ${healthStatus}`;
  dom.healthLabel.textContent = healthLabel;
  dom.analysisDate.textContent = `Analyzed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  dom.execSummary.textContent = summary;

  // KPIs
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

  // Ratios
  const ratioEntries = Object.values(ratios);
  dom.ratiosGrid.innerHTML = ratioEntries.map(r => `
    <div class="ratio-item">
      <div class="ratio-header">
        <span class="ratio-name">${r.name}</span>
        <span class="ratio-value">${r.value}</span>
      </div>
      <div class="ratio-bar-bg">
        <div class="ratio-bar ${r.status === 'poor' ? 'danger' : r.status === 'fair' ? 'warning' : ''}" style="width: ${r.barPercent}%"></div>
      </div>
      <span class="ratio-interpretation">${r.interpretation}</span>
    </div>
  `).join('');

  // Risks
  risks.sort((a, b) => { const order = { high: 0, medium: 1, low: 2 }; return order[a.severity] - order[b.severity]; });
  dom.riskList.innerHTML = risks.map(r => `
    <div class="risk-item ${r.severity}">
      <span class="risk-severity">${r.severity}</span>
      <div class="risk-content">
        <h4>${r.title}</h4>
        <p>${r.desc}</p>
      </div>
    </div>
  `).join('');

  // Insights
  dom.insightsGrid.innerHTML = insights.map(i => `
    <div class="insight-item">
      <div class="insight-icon ${i.type}">${i.icon}</div>
      <div class="insight-text">${i.text}</div>
    </div>
  `).join('');

  // Data table
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

  // Charts
  renderCharts(data);

  showView('dashboard-view');
}

// ===== Charts =====
let chartInstances = [];

function renderCharts(data) {
  // Destroy previous charts
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  const chartColors = {
    green: '#34d399',
    cyan: '#06b6d4',
    purple: '#818cf8',
    pink: '#f472b6',
    orange: '#f59e0b',
    greenBg: 'rgba(52,211,153,0.15)',
    cyanBg: 'rgba(6,182,212,0.15)',
  };

  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(148,163,184,0.08)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Revenue vs Expenses bar chart
  const revenueCtx = document.getElementById('chart-revenue');
  if (data.revenue || data.netIncome) {
    const labels = [];
    const revenueData = [];
    const expenseData = [];

    if (data.revenue) {
      labels.push('Revenue');
      revenueData.push(data.revenue / 1e6);
      expenseData.push(data.revenue && data.netIncome ? (data.revenue - data.netIncome) / 1e6 : 0);
    }
    if (data.grossProfit) {
      labels.push('Gross Profit');
      revenueData.push(data.grossProfit / 1e6);
      expenseData.push(data.revenue ? (data.revenue - data.grossProfit) / 1e6 : 0);
    }
    if (data.operatingIncome) {
      labels.push('Operating Income');
      revenueData.push(data.operatingIncome / 1e6);
      expenseData.push(0);
    }
    if (data.ebitda) {
      labels.push('EBITDA');
      revenueData.push(data.ebitda / 1e6);
      expenseData.push(0);
    }
    if (data.netIncome) {
      labels.push('Net Income');
      revenueData.push(data.netIncome / 1e6);
      expenseData.push(0);
    }

    const c1 = new Chart(revenueCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Amount ($M)',
          data: revenueData,
          backgroundColor: [chartColors.green, chartColors.cyan, chartColors.purple, chartColors.orange, chartColors.pink],
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(52,211,153,0.2)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: ctx => `$${ctx.parsed.y.toFixed(1)}M` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.06)' },
            ticks: { callback: v => `$${v}M` },
          },
          x: { grid: { display: false } },
        },
      },
    });
    chartInstances.push(c1);
  }

  // Asset composition doughnut
  const assetsCtx = document.getElementById('chart-assets');
  if (data.totalAssets) {
    const pieLabels = [];
    const pieData = [];
    const pieColors = [];

    if (data.currentAssets) {
      pieLabels.push('Current Assets');
      pieData.push(data.currentAssets);
      pieColors.push(chartColors.green);
    }
    if (data.totalAssets && data.currentAssets) {
      pieLabels.push('Non-Current Assets');
      pieData.push(data.totalAssets - data.currentAssets);
      pieColors.push(chartColors.cyan);
    }
    if (data.totalLiabilities) {
      if (data.currentLiabilities) {
        pieLabels.push('Current Liabilities');
        pieData.push(data.currentLiabilities);
        pieColors.push(chartColors.orange);
        pieLabels.push('Non-Current Liabilities');
        pieData.push(data.totalLiabilities - data.currentLiabilities);
        pieColors.push(chartColors.pink);
      } else {
        pieLabels.push('Total Liabilities');
        pieData.push(data.totalLiabilities);
        pieColors.push(chartColors.orange);
      }
    }
    if (data.totalEquity) {
      pieLabels.push("Shareholders' Equity");
      pieData.push(data.totalEquity);
      pieColors.push(chartColors.purple);
    }

    if (pieData.length === 0 && data.totalAssets) {
      // Fallback: just show total assets as a single item
      pieLabels.push('Total Assets');
      pieData.push(data.totalAssets);
      pieColors.push(chartColors.green);
    }

    const c2 = new Chart(assetsCtx, {
      type: 'doughnut',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: pieColors,
          borderColor: 'rgba(10,14,23,0.8)',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(52,211,153,0.2)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: ctx => `${ctx.label}: ${formatCurrencyShort(ctx.parsed)}` },
          },
        },
      },
    });
    chartInstances.push(c2);
  }
}

// ===== Formatting Utilities =====
function formatCurrency(num) {
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + ' Trillion';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + ' Billion';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + ' Million';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
  return '$' + num.toFixed(2);
}

function formatCurrencyShort(num) {
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
  return '$' + num.toFixed(0);
}

// ===== Demo Data =====
function runDemoAnalysis() {
  showView('loading-view');
  updateLoaderStep(1, 'Loading sample annual report...', 10);

  const demoData = {
    companyName: 'Nextera Technologies Inc.',
    reportYear: '2024',
    revenue: 48200000000,
    netIncome: 7840000000,
    grossProfit: 21690000000,
    operatingIncome: 12050000000,
    ebitda: 15700000000,
    totalAssets: 132500000000,
    totalLiabilities: 85200000000,
    totalEquity: 47300000000,
    currentAssets: 24800000000,
    currentLiabilities: 18600000000,
    totalDebt: 42100000000,
    cashFlow: 11200000000,
    eps: 15.82,
  };

  const demoRawText = 'annual report of Nextera Technologies Inc. FY 2024 revenue net sales total assets total liabilities shareholders equity current assets current liabilities operating income EBITDA net income earnings per share operating cash flow total debt regulatory risk foreign currency risk litigation supply chain risk';

  setTimeout(() => {
    updateLoaderStep(2, 'Recognizing financial data...', 35);
    setTimeout(() => {
      updateLoaderStep(3, 'Computing financial ratios...', 55);
      setTimeout(() => {
        updateLoaderStep(4, 'Assessing risks...', 75);
        setTimeout(() => {
          updateLoaderStep(5, 'Generating report...', 95);
          const analysis = analyzeFinancials(demoData, demoRawText);
          setTimeout(() => {
            updateLoaderStep(5, 'Complete!', 100);
            setTimeout(() => renderDashboard(analysis, 'Nextera Technologies Annual Report 2024.pdf'), 300);
          }, 400);
        }, 500);
      }, 400);
    }, 500);
  }, 600);
}
