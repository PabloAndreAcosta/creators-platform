import webpush from "web-push";

// Web Push is only active once the VAPID keypair is configured in the
// environment. Until then getWebPush() returns null and every send is a no-op,
// so the feature ships dark and turns on the moment the keys land in Vercel.
let configured = false;
let available = false;

export function getWebPush(): typeof webpush | null {
  if (!configured) {
    configured = true;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (publicKey && privateKey) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:pablo.acosta@usha.se",
        publicKey,
        privateKey
      );
      available = true;
    }
  }
  return available ? webpush : null;
}

/** True when the server can send pushes (keys present). */
export function pushConfigured(): boolean {
  return getWebPush() !== null;
}
