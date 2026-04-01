import type { SignicatSession, SignicatSessionResult } from "@/types/bankid";

const CLIENT_ID = process.env.SIGNICAT_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SIGNICAT_CLIENT_SECRET || "";
const ACCOUNT_ID = process.env.SIGNICAT_ACCOUNT_ID || "";
const API_BASE = process.env.SIGNICAT_API_BASE || "https://api.signicat.com";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    "base64"
  );

  const res = await fetch(`${API_BASE}/oauth/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=signicat-api",
  });

  if (!res.ok) {
    throw new Error(`Signicat token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh 60 seconds before expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

export async function createBankIdSession(
  callbackBaseUrl: string
): Promise<SignicatSession> {
  const token = await getAccessToken();

  const res = await fetch(
    `${API_BASE}/auth/rest/sessions?signicat-accountId=${ACCOUNT_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        flow: "redirect",
        allowedProviders: ["sbid"],
        requestedAttributes: [
          "name",
          "firstName",
          "lastName",
          "dateOfBirth",
          "nin",
        ],
        callbackUrls: {
          success: `${callbackBaseUrl}/api/auth/bankid/callback?status=success`,
          abort: `${callbackBaseUrl}/api/auth/bankid/callback?status=abort`,
          error: `${callbackBaseUrl}/api/auth/bankid/callback?status=error`,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Signicat session creation failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getBankIdSessionResult(
  sessionId: string
): Promise<SignicatSessionResult> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}/auth/rest/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Signicat session fetch failed: ${res.status}`);
  }

  return res.json();
}
