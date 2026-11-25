const { config } = require("../config");
const { postEncrypted } = require("../services/backend.client");

const str = v => (typeof v === "string" ? v.trim() : "");

function bad(res, message) {
  return res.status(400).json({ ok: false, error: message });
}

/** Browser -> here (plain JSON) -> backend /user/initiate-factory-payment (encrypted). */
async function initiate(req, res) {
  const b = req.body || {};
  const method = str(b.sPaymentMethod);
  if (!str(b.iProviderSkuId)) return bad(res, "iProviderSkuId (the PAYU_V2 provider SKU's sUniqueSkuId) is required");
  if (str(b.sUserId).length < 4) return bad(res, "sUserId is required (min 4 characters)");
  if (!["UPI_INTENT", "UPI_QR", "UPI_VPA"].includes(method)) return bad(res, "sPaymentMethod must be UPI_INTENT, UPI_QR or UPI_VPA");

  const body = {
    iProviderSkuId: str(b.iProviderSkuId),
    sPaymentMethod: method,
    // The hidden VPA field keeps its last value; only UPI_VPA should send it (the backend validates any sVpa it gets)
    ...(method === "UPI_VPA" ? { sVpa: str(b.sVpa) } : {}),
    sCountryCode2: str(b.sCountryCode2) || "IN",
    sCurrencyCode: str(b.sCurrencyCode) || "INR",
    nAmount: Number(b.nAmount) || 0, // the backend ignores it for PAYU_V2 and uses the DB price
    sUserId: str(b.sUserId),
    sUsername: str(b.sUsername) || "Test User",
    sEmail: str(b.sEmail),
    sPhoneCode: str(b.sPhoneCode) || "+91",
    sPhoneNumber: str(b.sPhoneNumber),
    sState: str(b.sState),
    sCity: str(b.sCity)
  };
  const headers = {
    ...(str(b.userIp) ? { "user-ip": str(b.userIp) } : {}),
    ...(str(b.userAgent) ? { "user-agent": str(b.userAgent) } : {})
  };

  const out = await postEncrypted("/user/initiate-factory-payment", body, headers);
  return res.json({ ...out, sent: { path: "/user/initiate-factory-payment", headers: { ...config.headers, ...headers }, body } });
}

/** Browser -> here -> backend /user/verify-payment (encrypted). */
async function verify(req, res) {
  const b = req.body || {};
  if (!str(b.sToken)) return bad(res, "sToken is required (from the initiate response)");
  if (str(b.sUserId).length < 4) return bad(res, "sUserId is required (the same one used to initiate)");

  const txnid = str(b.sProviderToken);
  const body = { ePaymentProvider: "PAYU_V2", sToken: str(b.sToken), sUserId: str(b.sUserId), sOrderId: txnid, sProviderToken: txnid };

  const out = await postEncrypted("/user/verify-payment", body);
  return res.json({ ...out, sent: { path: "/user/verify-payment", headers: { ...config.headers }, body } });
}

module.exports = { initiate, verify };
