-- Utbetalningsflaggan från Stripe Connect.
--
-- Avräkningen kontrollerade att partnerns konto kan TA EMOT pengar
-- (charges_enabled) men inte att det kan BETALA UT dem. En överföring lyckas
-- och markeras betald även när mottagaren saknar bankkonto eller har
-- utbetalningar spärrade — pengarna ligger då kvar i deras Stripe-saldo och
-- når aldrig banken. Tyst, och upptäckt först när partnern hör av sig.
--
-- Null = vi vet inte ännu (kontot har inte synkats). Avräkningen behandlar
-- null som "inte verifierad" och blockerar hellre än gissar.
alter table public.profiles
  add column if not exists stripe_payouts_enabled boolean;

comment on column public.profiles.stripe_payouts_enabled is
  'Stripe Connect payouts_enabled. Null = osynkat. Sätts av connect-sync, account.updated-webhooken och /api/stripe/connect/status.';

-- Triggern skrivs om I SIN HELHET. Den listar varje skyddad kolumn explicit,
-- så en ny kolumn måste läggas till här — annars kan vem som helst med en
-- vanlig session sätta sin egen utbetalningsflagga och låsa upp avräkningen.
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
