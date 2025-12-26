import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkMAC,
  checkABAC,
  checkRuBAC,
  type AccessContext,
} from "../lib/access-control";

function baseContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: "u1",
    username: "demo",
    role: "EMPLOYEE",
    department: "Engineering",
    securityLevel: "PUBLIC",
    ...overrides,
  };
}

test("checkMAC allows access when user level >= resource level", () => {
  assert.equal(checkMAC("CONFIDENTIAL", "INTERNAL").allowed, true);
  assert.equal(checkMAC("INTERNAL", "INTERNAL").allowed, true);
});

test("checkMAC denies access when user level < resource level", () => {
  const result = checkMAC("PUBLIC", "CONFIDENTIAL");
  assert.equal(result.allowed, false);
  assert.equal(result.deniedBy, "MAC");
});

test("checkABAC payroll_access allows HR department", () => {
  const context = baseContext({ department: "HR" });
  assert.equal(checkABAC(context, "payroll_access").allowed, true);
});

test("checkABAC payroll_access denies non-HR/Finance employees", () => {
  const context = baseContext({ department: "Engineering", role: "EMPLOYEE" });
  const result = checkABAC(context, "payroll_access");
  assert.equal(result.allowed, false);
  assert.equal(result.deniedBy, "ABAC");
});

test("checkABAC falls back to deny for an unknown policy name", () => {
  const context = baseContext({ role: "ADMIN" });
  const result = checkABAC(context, "does_not_exist");
  assert.equal(result.allowed, false);
});

test("checkRuBAC allows access inside the explicit allowed window", async () => {
  const ts = new Date("2026-01-05T10:00:00");
  const context = baseContext({ timestamp: ts });
  const result = await checkRuBAC(context, {
    allowedHours: { start: ts.getHours(), end: ts.getHours() + 1 },
    allowedDays: [ts.getDay()],
  });
  assert.equal(result.allowed, true);
});

test("checkRuBAC denies access outside the explicit allowed hours", async () => {
  const ts = new Date("2026-01-05T22:00:00");
  const context = baseContext({ timestamp: ts });
  const result = await checkRuBAC(context, {
    allowedHours: { start: 9, end: 17 },
    allowedDays: [ts.getDay()],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.deniedBy, "RuBAC");
});

test("checkRuBAC denies a blocked IP even within allowed hours", async () => {
  const context = baseContext({ ip: "10.0.0.5" });
  const result = await checkRuBAC(context, { blockedIPs: ["10.0.0.5"] });
  assert.equal(result.allowed, false);
  assert.equal(result.deniedBy, "RuBAC");
});
