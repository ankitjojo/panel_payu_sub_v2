const { config } = require("../config");
const { encrypt, decrypt } = require("./crypto.service");

/**
 * POSTs an encrypted JSON body to the backend and decrypts the answer.
 * The backend answers HTTP 200 with the real status inside `meta-data.status`.
 * Never throws: network and decrypt problems come back as `{ ok: false, error }`.
 */
async function postEncrypted(path, body, extraHeaders = {}) {
  const url = `${config.backendBaseUrl}${path}`;
  const headers = { "content-type": "application/json", ...config.headers, ...extraHeaders };

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ data: encrypt(JSON.stringify(body)) }), signal: AbortSignal.timeout(60000) });
  } catch (e) {
    return { ok: false, url, error: `Could not reach the backend at ${config.backendBaseUrl} (${e.cause?.code || e.message})` };
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, url, httpStatus: res.status, error: "Backend did not return JSON", raw: text.slice(0, 2000) };
  }

  // Normal case: { data: "<hex>" } -> { data, "meta-data": { message, status } }
  if (typeof json.data === "string") {
    try {
      const decoded = JSON.parse(decrypt(json.data));
      const meta = decoded["meta-data"] || {};
      return { ok: true, url, httpStatus: res.status, status: meta.status, message: meta.message, data: decoded.data, decoded };
    } catch (e) {
      return { ok: false, url, httpStatus: res.status, error: "Could not decrypt the backend response. Check SECRET_KEY / IV match the backend.", raw: json };
    }
  }
  // Un-encrypted answers (maintenance mode, proxy errors, ...)
  return { ok: true, url, httpStatus: res.status, status: json["meta-data"]?.status ?? json.status, message: json["meta-data"]?.message ?? json.message, data: json.data ?? null, decoded: json };
}

module.exports = { postEncrypted };
