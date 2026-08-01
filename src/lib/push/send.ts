import { createAdminClient } from "@/lib/supabase/admin";
import { getWebPush } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  /** Where the notification opens when tapped. */
  url?: string;
  /** Collapse key so repeat notes for the same thing replace each other. */
  tag?: string;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Best-effort Web Push to every device a user has registered. Silently no-ops
 * when push isn't configured or the user has no subscriptions, and prunes
 * subscriptions the push service reports as gone (404/410). Never throws —
 * notification delivery must not break the flow that triggered it.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const wp = getWebPush();
  if (!wp || !userId) return;

  try {
    const admin = createAdminClient();
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/app/notifications",
      tag: payload.tag,
    });

    await Promise.all(
      (subs as SubRow[]).map(async (s) => {
        try {
          await wp.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // 404/410 = the subscription expired or was revoked → drop it.
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error("Push send failed:", status ?? err);
          }
        }
      })
    );
  } catch (err) {
    console.error("sendPushToUser error:", err);
  }
}
