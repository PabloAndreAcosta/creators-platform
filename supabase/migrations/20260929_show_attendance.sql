-- "Visa att jag kommer" — köparens eget val att synas bland deltagarna.
--
-- Tröskeln på en danskväll är sällan priset. Den är att gå in ensam. Att se
-- vilka som kommer svarar på det, och frågan ställs på biljettsidan, inte på
-- Facebook. Facebook lämnar inte ut sina svar till tredje part, så det här är
-- något vi äger själva eller inte alls.
--
-- OPT-IN, ALDRIG AUTOMATISKT. Kolumnen är false som standard. Att köpa en
-- biljett är inte ett samtycke till att synas — den som inte kryssar räknas i
-- siffran men visas inte. Gäster utan konto lagrar vi aldrig ett ja för: de
-- har ingen profil att visa, och ett kryss vore ett löfte vi inte kan hålla.

alter table bookings
  add column if not exists show_attendance boolean not null default false;

comment on column bookings.show_attendance is
  'Köparen har aktivt valt att synas bland deltagarna på eventsidan. Default false — köp är inget samtycke.';

-- Visningen är avstängd tills den är byggd, och tänds sedan först när det finns
-- nog med svar. "3 personer kommer" säljer sämre än ingenting alls, och de
-- första kvällarna har låga tal. Samma grind som /kalender har på utbud.
insert into app_config (key, value)
values
  ('attendees_display_enabled', 'false'),
  ('attendees_min_display', '5')
on conflict (key) do nothing;
