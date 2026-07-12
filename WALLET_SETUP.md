# Wallet passes (Apple Wallet + Google Wallet)

Ticket QR codes can be added to Apple Wallet and Google Wallet. The code is built
and **gated on credentials** — the buttons on `/biljett/[id]` stay hidden and the
`/api/tickets/wallet` route returns 404 until the env vars below are set. Set one
provider, both, or neither. After adding the env in Vercel, redeploy.

The pass encodes the same verify URL as the QR, so scanning a wallet pass at the
door works exactly like scanning the on-screen QR (multi-ticket orders get one
pass per attendee).

---

## Apple Wallet — what Pablo needs to provide

Requires an **Apple Developer account** ($99/yr). Steps:

1. **Pass Type ID** — Apple Developer → Certificates, IDs & Profiles → Identifiers
   → new **Pass Type ID** (e.g. `pass.se.usha.ticket`). → `APPLE_PASS_TYPE_ID`.
2. **Team ID** — top-right of the developer portal (10 chars). → `APPLE_TEAM_ID`.
3. **Pass signing certificate** — create a certificate for that Pass Type ID,
   download the `.cer`, import into Keychain, then export the cert + private key.
   Convert to PEM:
   ```
   # cert (public):
   openssl x509 -inform der -in pass.cer -out APPLE_PASS_CERT.pem
   # private key (from the .p12 you export from Keychain):
   openssl pkcs12 -in pass.p12 -nocerts -out APPLE_PASS_KEY.pem -nodes   # (or keep a passphrase)
   ```
   → `APPLE_PASS_CERT` = cert PEM, `APPLE_PASS_KEY` = key PEM,
   `APPLE_PASS_KEY_PASSPHRASE` = the key passphrase (leave blank if none).
4. **Apple WWDR intermediate certificate** — download "Worldwide Developer
   Relations" cert from https://www.apple.com/certificateauthority/ , convert to
   PEM the same way. → `APPLE_WWDR_CERT`.

When pasting PEM into Vercel env, keep newlines as literal `\n` (the code
un-escapes `\n` at runtime).

## Google Wallet — what Pablo needs to provide

Requires the **Google Wallet API** enabled + a **Wallet issuer account**. Steps:

1. Google Pay & Wallet Console (https://pay.google.com/business/console) → get your
   **Issuer ID**. → `GOOGLE_WALLET_ISSUER_ID`.
2. Google Cloud → create a **service account**, enable the *Google Wallet API*,
   and grant the service account access in the Wallet console. Download its JSON
   key. → `GOOGLE_WALLET_SA_EMAIL` = `client_email`,
   `GOOGLE_WALLET_SA_PRIVATE_KEY` = `private_key` (keep the `\n`s).
3. Event ticket classes need Google review for production; the issuer's own test
   accounts work while `UNDER_REVIEW`. The class is created automatically on first
   save (embedded in the JWT).

---

## Verifying after credentials are added

- Apple: open a ticket on an iPhone/Safari → "Lägg till i Apple Wallet" → the
  `.pkpass` should open and add. If it errors, the cert/key/WWDR PEM is usually
  the culprit.
- Google: "Spara i Google Wallet" → redirects to `pay.google.com/gp/v/save/…` →
  should offer to save. A 401 there means the JWT signing key/issuer is off.

Env template lives in `.env.local.example` under "Wallet passes".
