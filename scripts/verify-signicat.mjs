#!/usr/bin/env node
// Verify Signicat credentials end-to-end before pasting them into Vercel.
//
// Usage:
//   SIGNICAT_CLIENT_ID=... \
//   SIGNICAT_CLIENT_SECRET=... \
//   SIGNICAT_ACCOUNT_ID=... \
//   [SIGNICAT_API_BASE=https://api.signicat.com] \
//   [APP_URL=https://usha.se] \
//   node scripts/verify-signicat.mjs
//
// Steps:
//   1. Token request (Basic auth, client_credentials).
//   2. Create a real BankID session (flow=redirect, providers=sbid).
//   3. Print the authenticationUrl + session id so you can either open it
//      manually for a real BankID test, or just confirm the API answered 200.
//
// Safe to run repeatedly — sessions auto-expire and aren't billed if abandoned.

const required = ["SIGNICAT_CLIENT_ID", "SIGNICAT_CLIENT_SECRET", "SIGNICAT_ACCOUNT_ID"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`✗ Missing env: ${missing.join(", ")}`);
  process.exit(1);
}

const CLIENT_ID = process.env.SIGNICAT_CLIENT_ID;
const CLIENT_SECRET = process.env.SIGNICAT_CLIENT_SECRET;
const ACCOUNT_ID = process.env.SIGNICAT_ACCOUNT_ID;
const API_BASE = process.env.SIGNICAT_API_BASE || "https://api.signicat.com";
const APP_URL = process.env.APP_URL || "https://usha.se";

console.log(`→ API base: ${API_BASE}`);
console.log(`→ account:  ${ACCOUNT_ID}`);
console.log(`→ client:   ${CLIENT_ID.slice(0, 6)}…`);

const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

const tokenRes = await fetch(`${API_BASE}/auth/open/connect/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials&scope=signicat-api",
});

if (!tokenRes.ok) {
  const body = await tokenRes.text();
  console.error(`✗ Token request failed: ${tokenRes.status}`);
  console.error(body);
  process.exit(1);
}

const tokenJson = await tokenRes.json();
console.log(`✓ Token OK (expires_in=${tokenJson.expires_in}s)`);

const sessionRes = await fetch(
  `${API_BASE}/auth/rest/sessions?signicat-accountId=${ACCOUNT_ID}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      flow: "redirect",
      allowedProviders: ["sbid"],
      requestedAttributes: ["name", "firstName", "lastName", "dateOfBirth", "nin"],
      callbackUrls: {
        success: `${APP_URL}/api/auth/bankid/callback?status=success`,
        abort: `${APP_URL}/api/auth/bankid/callback?status=abort`,
        error: `${APP_URL}/api/auth/bankid/callback?status=error`,
      },
    }),
  }
);

if (!sessionRes.ok) {
  const body = await sessionRes.text();
  console.error(`✗ Session creation failed: ${sessionRes.status}`);
  console.error(body);
  console.error("");
  console.error("Common causes:");
  console.error("  - account_id doesn't match the credentials");
  console.error("  - sbid provider not enabled on this account (ask Moumy)");
  console.error("  - callback URLs not whitelisted in Signicat dashboard");
  process.exit(1);
}

const session = await sessionRes.json();
console.log(`✓ Session created: ${session.id}`);
console.log(`  authenticationUrl: ${session.authenticationUrl}`);
console.log("");
console.log("Open the URL above in a browser to do a real BankID test, or stop here");
console.log("if you just wanted to confirm credentials + provider scope work.");
