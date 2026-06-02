// Pre-calculate Benford's Law percentages for digits 1 through 9
const BENFORD_PCTS = {};
for (let d = 1; d <= 9; d++) {
  BENFORD_PCTS[d] = Math.log10(1 + 1 / d) * 100;
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
  renderChart(counts, totalValidNumbers);
}

function renderChart(counts, total) {
  const chartContainer = document.getElementById('chart');
  chartContainer.innerHTML = '';

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
}
