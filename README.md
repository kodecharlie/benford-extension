# Fraud detection: use Benford for basic sanity check against fraud
This Chrome extension is intended to help analysts -- anyone looking at a lot of numbers -- to run a simple sanity-check to gauge whether there might be fraudulent numbers in some web page under review.  The source of numbers could be anything -- share prices for stocks, corporate budget numbers, whatever.  The wider the distribution of numbers, the better the analysis.

DISCLAIMER: this is not a bulletproof way of detecting fraudulent numbers.  It merely is one way to note what might be aberrant numbers in some distribution.

# Benford's Law
See the [wikipedia article](https://en.wikipedia.org/wiki/Benford's_law) for learning more about the calculations we do in this extension.


# How to Load and Run the Extension in Chrome
Open your Google Chrome browser.

1. In the URL bar, navigate to chrome://extensions/.
1. In the top-right corner of the Extensions management screen, click the toggle switch to turn on Developer mode.
1. In the top-left corner, click the Load unpacked button.

Select the benford-extension folder containing your three files.

The extension icon will appear in your extensions list. Navigate to an information-dense webpage containing public statistics, economic financial tables, or population data, click the extension icon in your upper-right toolbar, and it will immediately generate your color-coded comparative chart.
