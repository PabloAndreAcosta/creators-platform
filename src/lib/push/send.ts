import { createAdminClient } from "@/lib/supabase/admin";
import { getServerTranslator } from "@/lib/i18n/server";
import { NOTIFICATION_NS, renderNotification, type NotificationParams } from "@/lib/notifications/text";
import { locales, type Locale } from "@/i18n/config";
import { getWebPush } from "./vapid";

/**
 * A button on the notification itself (Android/Chrome; iOS ignores them and
 * only the tap on the notification counts). The button never does anything
 * on its own — it only opens `url`, a page behind login that does the work.
 * Never put a secret in `url` that would let it act without a session.
 */
export interface PushAction {
  /** Identifier the service worker sees in notificationclick. */
  action: string;
  /** Key under `serverNotifications`, rendered per device language. */
  titleKey: string;
  url: string;
}

export interface PushPayload {
  /** Pre-rendered text, used when there is no key or the device has no locale. */
  title: string;
  body: string;
  /**
   * Keys under `serverNotifications`. Push is composed on the server, so unlike
   * the in-app list it cannot ask the reader's UI what language to use — it
   * renders per device instead, from the language that device subscribed in.
   */
  titleKey?: string;
  bodyKey?: string;
  params?: NotificationParams;
  /** Where the notification opens when tapped. */
  url?: string;
  /** Collapse key so repeat notes for the same thing replace each other. */
  tag?: string;
  actions?: PushAction[];
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
}

function asLocale(value: string | null): Locale | null {
  return value && (locales as readonly string[]).includes(value) ? (value as Locale) : null;
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
      .select("id, endpoint, p256dh, auth, locale")
      .eq("user_id", userId);

    if (!subs?.length) return;

    // Antal olästa följer med pushen så att siffran på appikonen blir rätt även
    // när appen är stängd — service workern kan inte fråga sessionen själv.
    // Misslyckas räkningen skickas pushen utan siffra hellre än inte alls.
    let badge: number | undefined;
    try {
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (typeof count === "number") badge = count;
    } catch {
      badge = undefined;
    }

    // One render per distinct language, not per device — a user with three
    // phones on the same language shouldn't cost three formatter runs.
    const bodyByLocale = new Map<string, string>();
    async function bodyFor(locale: Locale | null): Promise<string> {
      const cacheKey = locale ?? "-";
      const cached = bodyByLocale.get(cacheKey);
      if (cached) return cached;

      const t = payload.actions?.length || locale ? await getServerTranslator(NOTIFICATION_NS, locale ?? "en") : null;
      const { title, body } = locale && t
        ? await (async () => {
            const r = renderNotification(
              {
                title: payload.title,
                message: payload.body,
                title_key: payload.titleKey ?? null,
                body_key: payload.bodyKey ?? null,
                params: payload.params ?? null,
              },
              t
            );
            return { title: r.title, body: r.message };
          })()
        : { title: payload.title, body: payload.body };

      const json = JSON.stringify({
        title,
        body,
        url: payload.url ?? "/app/notifications",
        tag: payload.tag,
        badge,
        ...(payload.actions?.length && t
          ? {
              actions: payload.actions.map((a) => ({
                action: a.action,
                title: t.has(a.titleKey) ? t(a.titleKey) : a.action,
                url: a.url,
              })),
            }
          : {}),
      });
      bodyByLocale.set(cacheKey, json);
      return json;
    }

    await Promise.all(
      (subs as SubRow[]).map(async (s) => {
        try {
          await wp.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            await bodyFor(asLocale(s.locale))
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
