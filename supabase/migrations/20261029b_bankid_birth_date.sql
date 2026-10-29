-- Födelsedatum från BankID, för åldersgränser (taxipass: 18 år).
--
-- Personnumret sparas bara som hash (bankid_personal_number), så åldern gick
-- inte att läsa ut. BankID skickar födelsedatumet separat; det sparas här när
-- någon verifierar sig. Kolumnen är skyddad som de andra BankID-fälten — bara
-- service-role (BankID-callbacken) får skriva den.
--
-- Skyddsfunktionen skrivs om i sin HELHET: 21 kolumner i produktion
-- 2026-10-29 (kontrollerat med pg_get_functiondef) + bankid_birth_date = 22.

alter table public.profiles add column if not exists bankid_birth_date date;

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  new.tier := old.tier;
  new.role := old.role;
  new.is_admin := old.is_admin;
  new.creator_subcategory := old.creator_subcategory;
  new.stripe_account_id := old.stripe_account_id;
  new.bankid_verified_at := old.bankid_verified_at;
  new.bankid_personal_number := old.bankid_personal_number;
  new.bankid_name := old.bankid_name;
  new.bankid_grandfathered_at := old.bankid_grandfathered_at;
  new.bankid_birth_date := old.bankid_birth_date;
  new.stripe_card_payments_enabled := old.stripe_card_payments_enabled;
  new.stripe_charges_enabled := old.stripe_charges_enabled;
  new.stripe_payouts_enabled := old.stripe_payouts_enabled;
  new.stripe_details_submitted := old.stripe_details_submitted;
  new.is_usha_owned_seller := old.is_usha_owned_seller;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.referred_at := old.referred_at;
  new.founding_partner_since := old.founding_partner_since;
  new.founding_partner_until := old.founding_partner_until;
  new.share_token := old.share_token;
  new.share_token_created_at := old.share_token_created_at;

  return new;
end;
$function$;

-- Ingen läsrättighet ges: profiles har bara kolumnvisa SELECT-grants för anon
-- och authenticated (kontrollerat 2026-10-29), så en ny kolumn är osynlig för
-- webbläsaren tills någon uttryckligen grantar den. Bara servern läser den.
