const { config } = require("../config");

const viewBase = () => ({ backendBaseUrl: config.backendBaseUrl, payuPaymentUrl: config.payuPaymentUrl, defaults: config.defaults, headers: config.headers });

function home(req, res) {
  res.render("index", viewBase());
}

/**
 * surl / furl for UPI_VPA on the web: PayU form-POSTs the result here.
 * Shown for information only: the backend's /verify-payment stays the source of truth
 * (we can't check PayU's response hash here, the salt lives only on the backend).
 */
function payuReturn(req, res) {
  const { hash, ...fields } = req.body || {};
  res.render("payu-return", { ...viewBase(), payu: fields, hasHash: Boolean(hash) });
}

module.exports = { home, payuReturn };
