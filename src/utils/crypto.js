import crypto from "crypto";
import env from "../config/env.js";

const ALGO = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_HEX_LENGTH = 64;

function getKey() {
  const keyHex = env.CRYPTO_KEY;

  if (!keyHex) {
    throw new Error("Missing required env variable: CRYPTO_KEY");
  }

  if (typeof keyHex !== "string" || keyHex.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error("CRYPTO_KEY must be a 64-character hexadecimal string");
  }

  return Buffer.from(keyHex, "hex");
}

export function encrypt(text) {
  if (!text) throw new Error("Text is required");

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(hash) {
  if (!hash) throw new Error("Hash is required");

  const [ivHex, encryptedText] = hash.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
