-- Utskick till egna följare, inte bara till ett evenemangs väntelista.
--
-- En kreatör med hundra följare kunde bara skriva till dem som ställt sig i kö
-- till en viss kväll. Följarna — som aktivt bekräftat att de vill höra från
-- just den kreatören — gick inte att nå alls.
--
-- listing_id blir nullbar: ett följarutskick hör inte till någon kväll. Loggen
-- är densamma, så historiken ligger på ett ställe.

alter table email_broadcasts alter column listing_id drop not null;

comment on column email_broadcasts.listing_id is
  'Kvällen utskicket gällde. Null för utskick till kreatörens egna följare, som inte hör till en enskild kväll.';

alter table email_broadcasts
  add column if not exists creator_id uuid references profiles(id) on delete set null;

comment on column email_broadcasts.creator_id is
  'Kreatören vars följare fick utskicket. Sätts för audience = followers; null för väntelisteutskick.';

create index if not exists email_broadcasts_creator_idx
  on email_broadcasts (creator_id, created_at desc);
