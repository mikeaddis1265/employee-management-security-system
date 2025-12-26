process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-32ch";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
} from "../lib/auth";

test("hashPassword never stores the plaintext and verifyPassword round-trips", async () => {
  const hash = await hashPassword("Sup3rSecret!");
  assert.notEqual(hash, "Sup3rSecret!");
  assert.equal(await verifyPassword("Sup3rSecret!", hash), true);
  assert.equal(await verifyPassword("WrongPassword", hash), false);
});

test("createToken/verifyToken round-trip and reject a tampered token", () => {
  const payload = {
    userId: "1",
    username: "demo",
    role: "EMPLOYEE",
    department: "Engineering",
    securityLevel: "PUBLIC",
  };
  const token = createToken(payload);
  const decoded = verifyToken(token);

  assert.equal(decoded?.username, "demo");
  assert.equal(verifyToken(`${token}tampered`), null);
});
