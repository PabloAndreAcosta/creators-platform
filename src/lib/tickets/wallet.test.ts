import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  appleWalletConfigured,
  googleWalletConfigured,
  googleWalletSaveUrl,
  type WalletTicket,
} from "./wallet";

const TICKET: WalletTicket = {
  bookingId: "abcdef12-3456-7890-abcd-ef1234567890",
  attendeeId: null,
  code: "USH-ABCDEF12",
  verifyUrl: "https://usha.se/api/tickets/verify?code=USH-ABCDEF12&id=abcdef12-3456-7890-abcd-ef1234567890",
  title: "The Kiz Lab",
  dateLabel: "1 augusti 2026",
  timeLabel: "20:00",
  location: "Malmö",
  attendeeLabel: null,
};

describe("wallet gating", () => {
  const keep = { ...process.env };
  afterEach(() => {
    process.env = { ...keep };
  });

  it("is off when no credentials are set", () => {
    delete process.env.APPLE_PASS_CERT;
    delete process.env.GOOGLE_WALLET_ISSUER_ID;
    expect(appleWalletConfigured()).toBe(false);
    expect(googleWalletConfigured()).toBe(false);
  });

  it("google is on only when all three vars are present", () => {
    process.env.GOOGLE_WALLET_ISSUER_ID = "123";
    process.env.GOOGLE_WALLET_SA_EMAIL = "sa@x.iam.gserviceaccount.com";
    delete process.env.GOOGLE_WALLET_SA_PRIVATE_KEY;
    expect(googleWalletConfigured()).toBe(false);
    process.env.GOOGLE_WALLET_SA_PRIVATE_KEY = "key";
    expect(googleWalletConfigured()).toBe(true);
  });
});

describe("googleWalletSaveUrl", () => {
  const keep = { ...process.env };
  let publicKey: string;

  beforeEach(() => {
    const { privateKey, publicKey: pub } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    publicKey = pub;
    process.env.GOOGLE_WALLET_ISSUER_ID = "3388000000022222228";
    process.env.GOOGLE_WALLET_SA_EMAIL = "sa@x.iam.gserviceaccount.com";
    // Emulate how Vercel stores multi-line PEM (with literal \n).
    process.env.GOOGLE_WALLET_SA_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");
  });
  afterEach(() => {
    process.env = { ...keep };
  });

  it("produces a save link with a valid, verifiable RS256 JWT", () => {
    const url = googleWalletSaveUrl(TICKET);
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);

    const jwt = url.replace("https://pay.google.com/gp/v/save/", "");
    const [h, p, s] = jwt.split(".");
    expect(h && p && s).toBeTruthy();

    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(header.alg).toBe("RS256");
    expect(payload.aud).toBe("google");
    expect(payload.typ).toBe("savetowallet");
    expect(payload.payload.eventTicketObjects[0].barcode.value).toBe(TICKET.verifyUrl);

    // Signature verifies against the public key.
    const ok = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${h}.${p}`),
      publicKey,
      Buffer.from(s, "base64url")
    );
    expect(ok).toBe(true);
  });
});
