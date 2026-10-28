-- Klippets värde fryses när klippet tas.
--
-- Avräkningen räknade varje klipp som 1/N av kortet, med N = kortets antal
-- klipp just nu. Det håller bara så länge N aldrig ändras. När The Labs
-- torsdagar gick från 200 kr (hela kvällen) till 100 kr (practica) fick de som
-- köpt kort före bytet dubbelt så många klipp kvar — och med N ändrat hade
-- redan avräknade kvällar räknats om till halva värdet, så att kompletterings-
-- jobbet larmat om överbetalning till lokalen.
--
-- Nu bär varje rad sin egen andel av kortet. Nya klipp får (pengar kvar) /
-- (klipp kvar), så summan blir exakt kortets pris hur antalet klipp än ändras.
-- Befintliga rader fylls i med 1/N enligt dagens N, alltså exakt det värde
-- de redan avräknats med.
alter table pass_redemptions
  add column if not exists amount_paid_ore integer,
  add column if not exists platform_fee_ore integer,
  add column if not exists credit_ore integer;

comment on column pass_redemptions.amount_paid_ore is
  'Klippets andel av kortets pris, fryst när klippet togs. Null = äldre rad, räknas som 1/N.';
comment on column pass_redemptions.platform_fee_ore is
  'Klippets andel av plattformsavgiften, fryst när klippet togs.';
comment on column pass_redemptions.credit_ore is
  'Klippets andel av välkomstavdraget, fryst när klippet togs.';

update pass_redemptions r set
  amount_paid_ore  = round(coalesce(b.amount_paid, 0)::numeric / greatest(1, coalesce(b.sessions_total, 1))),
  platform_fee_ore = case when b.platform_fee_amount is null then null
                          else round(b.platform_fee_amount::numeric / greatest(1, coalesce(b.sessions_total, 1))) end,
  credit_ore       = round(coalesce(b.credit_applied_ore, 0)::numeric / greatest(1, coalesce(b.sessions_total, 1)))
from bookings b
where b.id = r.booking_id and r.amount_paid_ore is null;
