-- Notifications used to store finished sentences, so every row was frozen in
-- whatever language the writing code happened to be typed in — a Spanish user
-- ended up with a Swedish "Bokning avbokad" next to an English "Booking
-- refunded". Store what happened (a message key plus its values) instead, and
-- let the reader's UI language decide the words at render time.
--
-- title/message stay: rows written before this migration keep their frozen text,
-- and free-text notifications (a chat preview, an ops note pushed in from the
-- shop) have no key to translate.
alter table public.notifications
  add column if not exists title_key text,
  add column if not exists body_key text,
  add column if not exists params jsonb;

comment on column public.notifications.title_key is
  'i18n key under serverNotifications for the heading; null = use the frozen title.';
comment on column public.notifications.body_key is
  'i18n key under serverNotifications for the body; null = use the frozen message.';
comment on column public.notifications.params is
  'Values interpolated into title_key/body_key, e.g. {"service":"Salsa 101"}.';

-- Web Push renders on the server at send time, so it cannot ask the reader's UI
-- what language to use. Each device records the language it subscribed in.
alter table public.push_subscriptions
  add column if not exists locale text;

comment on column public.push_subscriptions.locale is
  'UI language this device subscribed in (sv|en|es); null = fall back to English.';
