/**
 * Felrapporten: vad som skickas till Sentry och när.
 *
 * Med följer: beskrivningen, sidans adress utan frågesträng (där kan det stå
 * koder och biljett-id), språket, skal (app/webb) och id för senaste felet om
 * det finns. Användar-id följer bara med när användaren är inloggad OCH har
 * kryssat i rutan. Ingen e-post, inget namn, ingen skärmdump, ingen Replay.
 *
 * Sentry hålls bakom ett litet gränssnitt så att logiken kan testas utan SDK:n.
 */

export const MAX_MESSAGE_LENGTH = 2000;

export type FeedbackSource = "felknapp" | "felsida";

export type FeedbackInput = {
  message: string;
  /** window.location.href; frågesträng och # tas bort här. */
  href: string;
  locale: string;
  /** Taggarna från appSkalTaggar (skal, ev. plattform). */
  shellTags: Record<string, string>;
  source: FeedbackSource;
  /** Sentrys event-id för felet som rapporten gäller, om det finns. */
  associatedEventId?: string;
  /** Next.js error.digest på felsidorna. */
  digest?: string;
  /** Inloggad användares id, eller undefined. */
  userId?: string;
  /** Rutan "skicka med mitt användar-id". Av som standard. */
  shareUserId: boolean;
};

export type SentryLike = {
  hasClient: () => boolean;
  /** Skickar inom ett eget scope; user sätts bara där, aldrig globalt. */
  capture: (
    params: {
      message: string;
      url: string;
      source: string;
      associatedEventId?: string;
      tags: Record<string, string>;
    },
    user: { id: string } | undefined,
  ) => string;
  flush: (timeoutMs: number) => Promise<boolean>;
};

export type SendResult = "sent" | "empty" | "unavailable" | "failed";

export function stripUrl(href: string): string {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}`;
  } catch {
    return href.split(/[?#]/)[0];
  }
}

/** Sentrys event-id är 32 hex-tecken. Allt annat skickas inte som koppling. */
export function isSentryEventId(id: string | undefined): id is string {
  return !!id && /^[0-9a-f]{32}$/i.test(id);
}

export function buildFeedback(input: FeedbackInput) {
  const message = input.message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const tags: Record<string, string> = { ...input.shellTags, locale: input.locale, kalla: input.source };
  if (input.digest) tags.error_digest = input.digest.slice(0, 64);
  const params = {
    message,
    url: stripUrl(input.href),
    source: input.source,
    ...(isSentryEventId(input.associatedEventId) ? { associatedEventId: input.associatedEventId } : {}),
    tags,
  };
  const user = input.shareUserId && input.userId ? { id: input.userId } : undefined;
  return { params, user };
}

export async function sendFeedback(input: FeedbackInput, sentry: SentryLike, timeoutMs = 8000): Promise<SendResult> {
  const { params, user } = buildFeedback(input);
  if (!params.message) return "empty";
  if (!sentry.hasClient()) return "unavailable";
  try {
    sentry.capture(params, user);
    const ok = await sentry.flush(timeoutMs);
    return ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
