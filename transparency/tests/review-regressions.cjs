// Regression assertions are shared with the end-to-end playtest probe.
process.argv.push('--regressions');
require('./playtest-browser.cjs');
