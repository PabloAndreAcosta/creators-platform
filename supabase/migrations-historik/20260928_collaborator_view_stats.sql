-- Läsbehörighet för statistik, utan administrationsrätt.
--
-- Fram tills nu fanns bara can_manage. Den som skulle få se hur många biljetter
-- som sålts fick på köpet redigera evenemanget, skicka utskick till deltagarna,
-- exportera väntelistan och skapa rabattkoder. Det är för mycket att ge någon
-- som ska följa försäljningen — en marknadsansvarig, en samarbetspartner, en
-- lokal som vill veta om kvällen bär sig.
--
-- can_view_stats ger siffrorna och ingenting annat. Deltagarlistan med namn och
-- mejladresser följer INTE med: den hör till can_manage, som är den behörighet
-- som redan innebär att man hanterar gästerna.
--
-- Rättigheterna är avsiktligt separata och inte en trappa. Den som har
-- can_manage får statistik ändå (koden prövar båda), men can_view_stats ger
-- aldrig något av det can_manage ger.

alter table listing_collaborators
  add column if not exists can_view_stats boolean not null default false;

comment on column listing_collaborators.can_view_stats is
  'Får se evenemangets siffror (sålt, incheckat, intäkt) men inte deltagarlistan och inget av det can_manage ger.';
