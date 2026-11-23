-- Sluta göra varje aktiv rabattkod publikt läsbar.
--
-- Policyn "Active promo codes are readable" gällde rollen public med enda
-- villkoret is_active = true, och anon har tabellbred SELECT på promo_codes.
-- Alltså kunde vem som helst — utloggad — läsa ut code, discount_type,
-- discount_value, scope, max_uses och allowed_plans för samtliga aktiva koder
-- med anon-nyckeln som ligger i JS-bundlen.
--
-- Inlösen är inte bunden till mottagaren (validatePromoCode kollar bara kodens
-- giltighet och användningsgränser), så en främling kunde både använda
-- partner-/kampanjkoder och bränna andras engångskoder VÄLKOMMEN-*.
--
-- Ingen kod läcker i skrivande stund, eftersom det råkar finnas noll aktiva
-- koder. Hålet är alltså latent: det öppnar sig i samma stund som en kampanj
-- skapas.
--
-- Validering sker numera med service-role i src/lib/promo/validate.ts, så
-- ingen behöver längre kunna läsa koder under RLS för att lösa in dem. Kvar
-- är bara det legitima fallet: att se sin EGEN kod, vilket referral-sidan gör
-- när den visar användarens VÄLKOMMEN-kod.

drop policy if exists "Active promo codes are readable" on public.promo_codes;

create policy "Users can read their own promo codes"
  on public.promo_codes
  for select
  using (is_active = true and created_by = (select auth.uid()));

comment on table public.promo_codes is
  'Rabattkoder. Läsbara under RLS endast för sin egen skapare; inlösen och validering går via service-role i src/lib/promo/validate.ts.';
