const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const env = (k, d = "") => (process.env[k] ?? d).trim();

const config = {
  port: Number(env("PORT", "3000")),
  backendBaseUrl: env("BACKEND_BASE_URL", "http://localhost:8000").replace(/\/+$/, ""),
  payuPaymentUrl: env("PAYU_PAYMENT_URL", "https://secure.payu.in/_payment"),
  secretKey: env("SECRET_KEY"),
  iv: env("IV"),
  headers: {
    project: env("PROJECT", "jojo"),
    devicetype: env("DEVICE_TYPE", "H0t30u"), // Android
    deviceversion: env("DEVICE_VERSION", "1.0.0"),
    deviceid: env("DEVICE_ID", "web-test-device-001")
  },
  // Pre-filled form values only: nothing secret
  defaults: {
    userIp: env("DEFAULT_USER_IP"),
    userAgent: env("DEFAULT_USER_AGENT", "JojoAndroid/1.0 (Android 14; Test)"),
    providerSkuId: env("DEFAULT_PROVIDER_SKU_ID"),
    userId: env("DEFAULT_USER_ID"),
    username: env("DEFAULT_USERNAME", "Test User"),
    email: env("DEFAULT_EMAIL", "test@example.com"),
    phone: env("DEFAULT_PHONE", "9999999999"),
    state: env("DEFAULT_STATE", "Gujarat"),
    city: env("DEFAULT_CITY", "Surat")
  }
};

// Fail fast with a readable message instead of a cryptic OpenSSL error on the first request
function assertConfig() {
  const problems = [];
  if (Buffer.from(config.secretKey, "base64").length !== 32) problems.push("SECRET_KEY must be base64 and decode to 32 bytes");
  if (!/^[0-9a-fA-F]{32}$/.test(config.iv)) problems.push("IV must be 32 hex characters (16 bytes)");
  if (!/^https:\/\/(secure|test)\.payu\.in\/_payment$/.test(config.payuPaymentUrl)) problems.push("PAYU_PAYMENT_URL must be https://secure.payu.in/_payment or https://test.payu.in/_payment");
  if (problems.length) {
    console.error("Invalid .env:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}

module.exports = { config, assertConfig };
