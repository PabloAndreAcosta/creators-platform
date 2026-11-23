-- Serviceavgiften för köparen blir verklig 2026-11-13 (2 % + 2,50 kr per
-- köp, arrangörens val). Fram till nu var den avstängd, och formulärets
-- standard var 'buyer' — 18 kvällar bär därför värdet utan att någon valt
-- det. Innan avgiften slås på nollställs de till 'absorb' (ingen avgift),
-- och kolumnens standard byts så att nya rader utan uttryckligt val aldrig
-- tar betalt av köparen av misstag.
--
-- Körs FÖRE deployen av #586. Reversibel: värdet går att sätta tillbaka per
-- rad i eventformuläret.

update public.listings
set service_fee_mode = 'absorb'
where service_fee_mode = 'buyer';

alter table public.listings
  alter column service_fee_mode set default 'absorb';
