import * as Sentry from "@sentry/nextjs";
import type { SentryLike } from "./send";

/** Den riktiga Sentry-kopplingen bakom SentryLike. Utan DSN finns ingen klient. */
export const sentryAdapter: SentryLike = {
  hasClient: () => !!Sentry.getClient(),
  capture: (params, user, attachments) =>
    Sentry.withScope((scope) => {
      if (user) scope.setUser(user);
      return Sentry.captureFeedback(params, attachments ? { attachments } : {}, scope);
    }),
  flush: (timeoutMs) => Sentry.flush(timeoutMs),
};

export function lastSentryEventId(): string | undefined {
  try {
    return Sentry.lastEventId();
  } catch {
    return undefined;
  }
}
