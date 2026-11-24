const crypto = require("crypto");
const { config } = require("../config");

// Same scheme as the backend's src/utils/encDec.utils.ts: AES-256-CBC, hex output
const ALGO = "aes-256-cbc";
const keyBuf = () => Buffer.from(config.secretKey, "base64");
const ivBuf = () => Buffer.from(config.iv, "hex");

function encrypt(text) {
  const cipher = crypto.createCipheriv(ALGO, keyBuf(), ivBuf());
  return Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("hex");
}

function decrypt(hex) {
  const decipher = crypto.createDecipheriv(ALGO, keyBuf(), ivBuf());
  return Buffer.concat([decipher.update(Buffer.from(hex, "hex")), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
