// Pre-calculate Benford's Law expected proportions and percentages for digits 1 through 9
const BENFORD_PROPS = {};
const BENFORD_PCTS = {};
for (let d = 1; d <= 9; d++) {
  const prop = Math.log10(1 + 1 / d);
  BENFORD_PROPS[d] = prop;
  BENFORD_PCTS[d] = prop * 100;
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || tab.url.startsWith('chrome://')) {
    document.getElementById('status').innerText = "Cannot analyze system pages.";
    return;
  }

  // Inject a script into the active tab to retrieve visible text
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText
  }, (results) => {
    if (!results || !results[0]) {
      document.getElementById('status').innerText = "Failed to parse page content.";
      return;
    }

    const pageText = results[0].result;
    analyzeText(pageText);
  });
});

function analyzeText(text) {
  // Regex matches digit sequences accounting for standard punctuation formatting
  const numRegex = /\b\d[\d,.]*\b/g;
  const matches = text.match(numRegex) || [];
  
  const counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0};
  let totalValidNumbers = 0;

  for (const numStr of matches) {
    // Isolate the first non-zero character that is an actual digit
    for (const char of numStr) {
      if (char >= '1' && char <= '9') {
        counts[char]++;
        totalValidNumbers++;
        break; // Stop checking this number sequence once the leading digit is logged
      }
      if (char === '0') {
        break; // Leading zeros (e.g. 0.05) do not qualify for Benford's baseline
      }
    }
  }

  const statusEl = document.getElementById('status');
  if (totalValidNumbers === 0) {
    statusEl.innerText = "No qualifying numbers found on this page.";
    return;
  }

  statusEl.innerText = `Analyzed ${totalValidNumbers.toLocaleString()} numbers found on page.`;
  
  // Perform statistical tests
  const stats = calculateStatistics(counts, totalValidNumbers);
  
  // Render results
  renderResults(counts, totalValidNumbers, stats);
}

function calculateStatistics(counts, n) {
  let chiSquare = 0.0;
  let totalAbsDev = 0.0;
  const digitAnalyses = [];

  const zCritical = 1.96; // alpha = 0.05, two-tailed

  for (let d = 1; d <= 9; d++) {
    const obsCount = counts[d];
    const obsProp = obsCount / n;
    const expProp = BENFORD_PROPS[d];
    const expCount = expProp * n;

    // Chi-Square contribution: (O - E)^2 / E
    const diff = obsCount - expCount;
    chiSquare += (diff * diff) / expCount;

    // MAD contribution: |observed_prop - expected_prop|
    totalAbsDev += Math.abs(obsProp - expProp);

    // Z-score calculation with continuity correction (1 / 2n)
    const stdDev = Math.sqrt((expProp * (1 - expProp)) / n);
    const continuityCorrection = 0.5 / n;
    
    let zScore = 0.0;
    if (stdDev > 0) {
      const numerator = Math.abs(obsProp - expProp) - continuityCorrection;
      if (numerator > 0) {
        zScore = (numerator / stdDev) * Math.sign(obsProp - expProp);
      }
    }

    const flagged = Math.abs(zScore) > zCritical;

    digitAnalyses.push({
      digit: d,
      observedCount: obsCount,
      observedPct: obsProp * 100,
      expectedCount: expCount,
      expectedPct: expProp * 100,
      zScore: zScore,
      flagged: flagged
    });
  }

  const mad = totalAbsDev / 9.0;

  // Sort Z-scores from highest absolute deviation to lowest
  digitAnalyses.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));

  return {
    chiSquare,
    mad,
    digitAnalyses
  };
}

function getMadConformity(mad) {
  if (mad <= 0.006) return "Close Conformity";
  if (mad <= 0.012) return "Acceptable Conformity";
  if (mad <= 0.015) return "Marginally Non-Conforming";
  return "Non-Conforming";
}

function renderResults(counts, total, stats) {
  const chartContainer = document.getElementById('chart');
  chartContainer.innerHTML = '';

  // 1. Summary Metrics Section (MAD & Chi-Square)
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'summary-section';
  
  const chiExceeded = stats.chiSquare > 15.51;
  const madConformity = getMadConformity(stats.mad);

  summaryDiv.innerHTML = `
    <div class="summary-card">
      <strong>Chi-Square ($\chi^2$):</strong> ${stats.chiSquare.toFixed(2)} 
      <span class="${chiExceeded ? 'flagged-text' : 'ok-text'}">
        (${chiExceeded ? 'Exceeds 15.51 threshold' : 'Passes threshold'})
      </span>
    </div>
    <div class="summary-card">
      <strong>MAD Score:</strong> ${stats.mad.toFixed(5)} (${madConformity})
    </div>
  `;
  chartContainer.appendChild(summaryDiv);

  // 2. Original Bar Chart Section
  const chartTitle = document.createElement('h3');
  chartTitle.innerText = "Distribution Breakdown";
  chartContainer.appendChild(chartTitle);

  for (let d = 1; d <= 9; d++) {
    const observedCount = counts[d];
    const observedPct = (observedCount / total) * 100;
    const benfordPct = BENFORD_PCTS[d];

    const row = document.createElement('div');
    row.className = 'chart-row';

    row.innerHTML = `
      <div class="digit-label">Digit ${d}</div>
      <div class="bar-container">
        <div class="bar-wrapper">
          <div class="bar observed" style="width: ${Math.max(observedPct * 3, 2)}px;"></div>
          <div class="bar-text">${observedPct.toFixed(1)}% (${observedCount})</div>
        </div>
        <div class="bar-wrapper">
          <div class="bar benford" style="width: ${benfordPct * 3}px;"></div>
          <div class="bar-text">${benfordPct.toFixed(1)}% (Expected)</div>
        </div>
      </div>
    `;
    chartContainer.appendChild(row);
  }

  // 3. Z-Score Analysis Table Section
  const zTableTitle = document.createElement('h3');
  zTableTitle.innerText = "Z-Score Analysis (Sorted by Deviation)";
  chartContainer.appendChild(zTableTitle);

  const table = document.createElement('table');
  table.className = 'z-score-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Digit</th>
        <th>Obs %</th>
        <th>Exp %</th>
        <th>Z-Score</th>
        <th>Flagged</th>
      </tr>
    </thead>
    <tbody>
      ${stats.digitAnalyses.map(a => `
        <tr class="${a.flagged ? 'row-flagged' : ''}">
          <td><strong>${a.digit}</strong></td>
          <td>${a.observedPct.toFixed(1)}%</td>
          <td>${a.expectedPct.toFixed(1)}%</td>
          <td>${a.zScore > 0 ? '+' : ''}${a.zScore.toFixed(2)}</td>
          <td>${a.flagged ? '<span class="badge-flag">FLAGGED</span>' : 'No'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  chartContainer.appendChild(table);
}
