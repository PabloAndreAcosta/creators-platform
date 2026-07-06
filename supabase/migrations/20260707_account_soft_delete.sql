-- Account deletion: soft-delete + anonymize + release identity.
--
-- Why soft-delete instead of hard delete: a user is the counterparty on
-- bookings, payments, payouts and reviews that must survive for accounting
-- (Fortnox) and legal retention. Hard-deleting the row would either cascade
-- that financial history away or 500 on the NO-ACTION foreign keys
-- (promo_codes.created_by, profiles.referred_by, digital_purchases.creator_promo_id).
-- Instead we keep the row, strip PII, hide it from every public surface, and
-- RELEASE the login email + hashed personnummer so the person can register
-- again from scratch. Login is blocked separately by banning the auth user
-- (done in the API route via GoTrue, which SQL can't do safely).

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_reason text;

-- Anonymize the profile and hide the user's listings in one atomic call.
-- SECURITY DEFINER so it runs with the owner's rights; only ever invoked by the
-- service-role admin client (see the REVOKE below) from /api/account/delete.
create or replace function public.soft_delete_account(
  p_user_id uuid,
  p_reason text default 'user-requested'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    deleted_at             = now(),
    deleted_reason         = p_reason,
    is_public              = false,
    -- strip PII / public fields
    full_name              = null,
    avatar_url             = null,
    bio                    = null,
    slug                   = null,
    -- profiles.email is NOT NULL, so anonymize it to a placeholder rather than
    -- nulling it. It is never used as a login/identity key (that's auth.users).
    email                  = 'deleted+' || p_user_id::text || '@deleted.usha.se',
    contact_email          = null,
    contact_phone          = null,
    social_instagram       = null,
    social_x               = null,
    social_facebook        = null,
    website                = null,
    websites               = '{}',
    -- RELEASE identity so re-registration works: freeing the unique personnummer
    -- makes the BankID dup-check in /api/auth/signup/apply-verification pass again.
    bankid_personal_number = null,
    bankid_verified_at     = null,
    bankid_name            = null
  where id = p_user_id;

  -- Unpublish everything the user is selling.
  update public.listings set
    is_active = false,
    is_public = false
  where user_id = p_user_id;
end;
$$;

-- Lock the function down: only the service-role admin client should call it.
revoke all on function public.soft_delete_account(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Note for a possible future HARD-delete pass (not used by soft-delete):
-- before calling auth.admin.deleteUser(), these NO-ACTION FKs must be cleared
-- or they will block the delete with a 500:
--   update promo_codes        set created_by         = null where created_by = :id;
--   update profiles           set referred_by        = null where referred_by = :id;
--   update digital_purchases  set creator_promo_id   = null where creator_promo_id = :id;
-- Everything else referencing the user cascades on delete.
-- ---------------------------------------------------------------------------
