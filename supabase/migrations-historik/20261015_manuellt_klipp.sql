-- Manuellt klipp på klippkort: en efterregistrering vid sidan av dörren.
--
-- Bakgrund: ett klipp som hör till en redan avräknad och utbetald kväll kan
-- inte nå partnern längre — den kvällens pengar är borta ur systemet. Det enda
-- stället klippet fortfarande kan göra ekonomisk nytta är en kväll som ännu
-- inte avräknats. Då måste två klipp kunna ligga på samma kväll.
--
-- Unika nyckeln (booking_id, listing_id) var spärren mot dubbelskanning i
-- dörren, och den ska vara kvar. Lösningen är att skilja på de två sorternas
-- rader: dörren skriver alltid is_manual = false och träffar spärren som förr,
-- medan en medveten efterregistrering skrivs med is_manual = true och ligger
-- utanför den.
alter table pass_redemptions
  add column if not exists is_manual boolean not null default false;

comment on column pass_redemptions.is_manual is
  'true = efterregistrerat klipp, inte skannat i dörren. Ligger utanför spärren mot dubbelskanning.';

alter table pass_redemptions
  drop constraint if exists pass_redemptions_booking_id_listing_id_key;

-- Partiellt index: ett SKANNAT klipp per kort och kväll, hur många telefoner
-- som än står i dörren. Manuella rader räknas inte in och spärrar ingenting.
create unique index if not exists pass_redemptions_ett_skannat_klipp_per_kvall
  on pass_redemptions (booking_id, listing_id)
  where not is_manual;
