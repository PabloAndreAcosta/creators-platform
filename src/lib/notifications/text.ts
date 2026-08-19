import type { Translate, TranslationParams } from '@/lib/i18n/server';

/** Namespace every notification message key lives under. */
export const NOTIFICATION_NS = 'serverNotifications';

/**
 * A value interpolated into a notification message. Usually the raw thing that
 * happened — an event title, an amount, a person's name. `{ key: '…' }` marks a
 * value that is itself a phrase and must be translated with the rest of the
 * sentence: the stand-in when a name or title is missing ("the event",
 * "a booking"), or a role word inside an invite.
 */
export type NotificationParamValue = string | number | { key: string };
export type NotificationParams = Record<string, NotificationParamValue>;

/** A notification as stored — old rows carry only the frozen title/message. */
export interface NotificationTextRow {
  title: string;
  message: string;
  title_key?: string | null;
  body_key?: string | null;
  params?: NotificationParams | null;
}

export function resolveParams(
  params: NotificationParams | null | undefined,
  t: Translate
): TranslationParams {
  const out: TranslationParams = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    out[name] =
      value !== null && typeof value === 'object' && 'key' in value ? t(value.key) : value;
  }
  return out;
}

/**
 * The words a reader actually sees. Rows written with keys are rendered in the
 * language `t` was built for; rows without (a chat preview, an ops note, or
 * anything written before notifications carried keys) keep their stored text.
 * An unknown key also falls back to the stored text rather than rendering the
 * key itself — a client can be older than the row it is showing.
 */
export function renderNotification(
  row: NotificationTextRow,
  t: Translate
): { title: string; message: string } {
  const values = resolveParams(row.params, t);
  return {
    title: row.title_key && t.has(row.title_key) ? t(row.title_key, values) : row.title,
    message: row.body_key && t.has(row.body_key) ? t(row.body_key, values) : row.message,
  };
}
