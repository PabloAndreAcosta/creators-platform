-- SECURITY DEFINER-funktioner som anon (och authenticated) kunde anropa.
--
-- Supabase-linten (0028/0029) flaggade has_stripe_connect, inherit_listing_vat_rate
-- och is_bankid_cleared som körbara för anon via /rest/v1/rpc/<namn>. Varje
-- funktion är kontrollerad mot appkoden (.rpc-anrop), pg_policies, vyer,
-- triggrar och andra funktioners källkod i prod 2026-11-21.
--
-- PUBLIC-fällan (se 20260913_revoke_public_rpc_execute.sql): anon och
-- authenticated ärver PUBLIC, så en revoke från bara anon är verkningslös om
-- PUBLIC har EXECUTE. PUBLIC tas därför alltid bort, och de roller som behöver
-- funktionen får en uttrycklig grant tillbaka.

-- ---------------------------------------------------------------------------
-- 1. inherit_listing_vat_rate() — triggerfunktion, ingen behöver EXECUTE.
--
-- Används bara av triggern trg_inherit_listing_vat_rate på listings. En trigger
-- körs av systemet och kontrollerar inte EXECUTE hos den som skriver raden, så
-- att dra in rättigheten påverkar inte inserts/updates. Som RPC går den ändå
-- inte att köra ("trigger functions can only be called as triggers").
-- Samma behandling som protect_stripe_account_rebind fick i 20260913.
-- Före: {=X, anon=X, authenticated=X, service_role=X}. Efter: postgres + service_role.
-- ---------------------------------------------------------------------------
revoke execute on function public.inherit_listing_vat_rate() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. is_bankid_cleared(uuid) — MÅSTE förbli körbar för anon och authenticated.
--
-- Används i fyra RLS-policies med roll public (listings "Cleared sellers manage
-- own listings" [ALL], gigs "Cleared arranger manages own gigs" [ALL],
-- gig_applications och event_instructors [INSERT]). Postgres kan evaluera en
-- ALL-policys USING även för anons SELECT på listings; utan EXECUTE får
-- utloggade "permission denied for function" och hela sajten slutar visa
-- evenemang (hände 2026-05-22, se 20260522_grant_anon_is_bankid_cleared.sql).
--
-- I stället görs den ofarlig: alla policyer anropar den med (select auth.uid()),
-- och inget i appen anropar den som RPC. Den svarar nu bara för den inloggade
-- själv. Tidigare kunde vem som helst fråga om ett godtyckligt användar-id var
-- BankID-verifierat eller kund. För anon är auth.uid() null → alltid false,
-- vilket är samma utfall policyerna redan gav (auth.uid() = user_id är aldrig
-- sant för anon).
-- ---------------------------------------------------------------------------
create or replace function public.is_bankid_cleared(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and uid = (select auth.uid())
      and (
        p.role = 'customer'
        or p.bankid_verified_at is not null
        or p.bankid_grandfathered_at is not null
      )
  );
$$;

revoke execute on function public.is_bankid_cleared(uuid) from public;
grant execute on function public.is_bankid_cleared(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. has_stripe_connect(uuid) — lämnas MEDVETET körbar för anon.
--
-- Anropas med användarklienten på /creators/[id] och /listing/[id] (två ställen),
-- som är publika sidor; en utloggad besökare är anon. Funktionen är redan
-- avgränsad: den svarar bara true för profiler med is_public = true och
-- returnerar ett boolean, aldrig stripe_account_id (som är kolumnlåst). Det
-- är exakt den yta sidan visar ("kan ta betalt"). Bara PUBLIC-granten städas,
-- för konsekvens.
-- ---------------------------------------------------------------------------
revoke execute on function public.has_stripe_connect(uuid) from public;
grant execute on function public.has_stripe_connect(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. materialize_series_access_codes(uuid, text) — bort från authenticated.
--
-- Flaggad av 0029. 20261012b_kod_fallback_serieniva.sql menade service_role
-- ensam ("revoke ... from public, anon; grant ... to service_role"), men
-- Supabase ger authenticated EXECUTE via default privileges, så den grant:en
-- låg kvar. Appen anropar den bara med adminklienten (app/events/[id]/codes och
-- api/events/[id]/redeem-code), och redeem_access_code anropar den inifrån som
-- ägaren (security definer). Som RPC lät den vilken inloggad som helst skriva
-- rader i event_access_codes för valfri kväll och, via returvärdet, pröva om
-- en gissad seriekod finns.
-- ---------------------------------------------------------------------------
revoke execute on function public.materialize_series_access_codes(uuid, text) from public, anon, authenticated;
grant execute on function public.materialize_series_access_codes(uuid, text) to service_role;
