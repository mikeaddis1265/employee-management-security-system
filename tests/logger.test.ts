process.env.ENCRYPT_KEY = "0123456789abcdef0123456789abcdef";

import crypto from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptLog, decryptLog } from "../lib/logger";

test("encryptLog/decryptLog round-trip using AES-256-GCM", () => {
  const plaintext = JSON.stringify({ action: "login", ip: "127.0.0.1" });
  const encrypted = encryptLog(plaintext);

  assert.notEqual(encrypted, plaintext);
  assert.equal(encrypted.split(":").length, 3); // iv:authTag:ciphertext
  assert.equal(decryptLog(encrypted), plaintext);
});

test("decryptLog rejects a tampered ciphertext instead of returning garbage", () => {
  const encrypted = encryptLog("sensitive detail");
  const [iv, authTag, ciphertext] = encrypted.split(":");
  const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;

  // GCM's auth tag check fails on tampering; decryptLog catches it and
  // returns the input unchanged rather than silently "decrypting" to noise.
  assert.equal(decryptLog(tampered), tampered);
});

test("decryptLog still reads legacy AES-256-CBC entries (iv:ciphertext)", () => {
  const key = Buffer.from(
    "0123456789abcdef0123456789abcdef".substring(0, 32).padEnd(32, "0"),
    "utf8"
  );
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update("legacy message", "utf8", "hex");
  encrypted += cipher.final("hex");
  const legacyFormatted = `${iv.toString("hex")}:${encrypted}`;

  assert.equal(decryptLog(legacyFormatted), "legacy message");
});

test("decryptLog returns plain (non-encrypted) text unchanged", () => {
  assert.equal(decryptLog("plain text"), "plain text");
});
