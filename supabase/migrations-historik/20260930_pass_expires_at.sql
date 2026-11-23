-- Giltighetstid på klippkort: lika många månader som klipp.
--
-- Saknades tidigare med flit. Ändrat 2026-09-30, och skälet är inte att pressa
-- någon: ett förskottsbetalt kort som aldrig kan förfalla är en skuld utan
-- slutdatum i bokföringen, och lokalens andel av ett oanvänt klipp blir aldrig
-- utbetald. Med ett datum går båda att redovisa.
--
-- Takten blir en kväll i månaden, långsammare än The Labs veckotakt, så den
-- som köper kortet för att gå regelbundet märker aldrig gränsen.
--
-- Null betyder "gäller tills vidare" och gäller kort som såldes före
-- ändringen. De får inte förfalla i efterhand — villkoret de köptes på var
-- ingen giltighetstid.

alter table bookings
  add column if not exists pass_expires_at timestamptz;

comment on column bookings.pass_expires_at is
  'Sista dag klippen får lösas in. Sätts vid köp till köpdatum + lika många månader som klipp. Null = kort sålt innan giltighetstiden infördes, gäller tills vidare.';
