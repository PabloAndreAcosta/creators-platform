import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PKPass } from "passkit-generator";

// ---------------------------------------------------------------------------
// Apple Wallet (.pkpass) + Google Wallet ("Save to Google Wallet") passes for a
// ticket. Both are GATED on their credentials being present — the buttons never
// render and the routes 404 until the env is configured. See WALLET_SETUP.md for
// exactly which credentials each provider needs.
// ---------------------------------------------------------------------------

export type WalletTicket = {
  bookingId: string;
  attendeeId?: string | null;
  code: string; // USH-XXXXXXXX
  verifyUrl: string; // the QR payload (verify URL)
  title: string;
  dateLabel: string;
  timeLabel?: string | null;
  location?: string | null;
  attendeeLabel?: string | null; // "Gäst 2 av 4" or the attendee's name
};

const BRAND = "#c8a445";

export function appleWalletConfigured(): boolean {
  return !!(
    process.env.APPLE_PASS_CERT &&
    process.env.APPLE_PASS_KEY &&
    process.env.APPLE_WWDR_CERT &&
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID
  );
}

export function googleWalletConfigured(): boolean {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SA_EMAIL &&
    process.env.GOOGLE_WALLET_SA_PRIVATE_KEY
  );
}

export function anyWalletConfigured(): boolean {
  return appleWalletConfigured() || googleWalletConfigured();
}

const b64url = (buf: Buffer | string) =>
  (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const pemFromEnv = (v: string | undefined) => (v || "").replace(/\\n/g, "\n");
const sanitizeId = (s: string) => s.replace(/[^\w.-]/g, "");

// --- Google Wallet: a signed JWT that produces a "Save to Google Wallet" link.
// The class + object are embedded so Google upserts them on save.
export function googleWalletSaveUrl(ticket: WalletTicket): string {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL!;
  const privateKey = pemFromEnv(process.env.GOOGLE_WALLET_SA_PRIVATE_KEY);

  const classId = `${issuerId}.usha_event_ticket`;
  const objectId = `${issuerId}.${sanitizeId(ticket.bookingId)}${ticket.attendeeId ? "_" + sanitizeId(ticket.attendeeId) : ""}`;

  const eventClass = {
    id: classId,
    issuerName: "Usha",
    reviewStatus: "UNDER_REVIEW",
    eventName: { defaultValue: { language: "sv", value: "Usha" } },
  };

  const eventObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    barcode: { type: "QR_CODE", value: ticket.verifyUrl, alternateText: ticket.code },
    ticketHolderName: ticket.attendeeLabel || undefined,
    ticketNumber: ticket.code,
    eventName: { defaultValue: { language: "sv", value: ticket.title } },
    textModulesData: [
      { id: "date", header: "Datum", body: [ticket.dateLabel, ticket.timeLabel].filter(Boolean).join(" · ") },
      ...(ticket.location ? [{ id: "loc", header: "Plats", body: ticket.location }] : []),
    ],
    hexBackgroundColor: BRAND,
  };

  const claims = {
    iss: saEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { eventTicketClasses: [eventClass], eventTicketObjects: [eventObject] },
  };

  const header = { alg: "RS256", typ: "JWT" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  const jwt = `${signingInput}.${b64url(signature)}`;
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// --- Apple Wallet: build and sign a .pkpass buffer.
export async function buildApplePass(ticket: WalletTicket): Promise<Buffer> {
  const icon = fs.readFileSync(path.join(process.cwd(), "public", "icon-512.png"));

  const pass = new PKPass(
    { "icon.png": icon, "icon@2x.png": icon, "logo.png": icon },
    {
      wwdr: pemFromEnv(process.env.APPLE_WWDR_CERT),
      signerCert: pemFromEnv(process.env.APPLE_PASS_CERT),
      signerKey: pemFromEnv(process.env.APPLE_PASS_KEY),
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      organizationName: "Usha",
      serialNumber: `${ticket.bookingId}${ticket.attendeeId ? "-" + ticket.attendeeId : ""}`,
      description: ticket.title,
      foregroundColor: "rgb(255,255,255)",
      backgroundColor: "rgb(17,17,17)",
      labelColor: "rgb(200,164,69)",
    }
  );

  pass.type = "eventTicket";
  pass.setBarcodes({ message: ticket.verifyUrl, format: "PKBarcodeFormatQR", altText: ticket.code });
  pass.primaryFields.push({ key: "event", label: "EVENT", value: ticket.title });
  pass.secondaryFields.push({
    key: "date",
    label: "DATUM",
    value: [ticket.dateLabel, ticket.timeLabel].filter(Boolean).join(" · "),
  });
  if (ticket.attendeeLabel) {
    pass.auxiliaryFields.push({ key: "guest", label: "GÄST", value: ticket.attendeeLabel });
  }
  if (ticket.location) {
    pass.auxiliaryFields.push({ key: "loc", label: "PLATS", value: ticket.location });
  }

  return pass.getAsBuffer();
}
