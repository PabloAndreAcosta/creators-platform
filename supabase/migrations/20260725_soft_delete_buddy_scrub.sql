-- Extend soft_delete_account to also remove the user from the training-buddy
-- pool. Previously deletion only touched profiles + listings, so a "deleted"
-- account stayed a live, matchable in-person buddy candidate (its buddy row kept
-- lat/lon/bio/is_active) and lingered on other people's Matches tab — a GDPR
-- erasure gap and a real safety issue for a meet-in-person feature.
--
-- Financial data (bookings, payments, guest PII) is deliberately retained for
-- accounting/legal per the original function; message-content scrubbing is a
-- separate retention decision and intentionally not done here.
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
    full_name              = null,
    avatar_url             = null,
    bio                    = null,
    slug                   = null,
    email                  = 'deleted+' || p_user_id::text || '@deleted.usha.se',
    contact_email          = null,
    contact_phone          = null,
    social_instagram       = null,
    social_x               = null,
    social_facebook        = null,
    website                = null,
    websites               = '{}',
    bankid_personal_number = null,
    bankid_verified_at     = null,
    bankid_name            = null
  where id = p_user_id;

  update public.listings set
    is_active = false,
    is_public = false
  where user_id = p_user_id;

  -- Leave the training-buddy pool: deactivate + strip location/bio so the account
  -- is no longer a live in-person match candidate, and drop likes/matches so it
  -- disappears from everyone's Matches tab.
  update public.training_buddy_profiles set
    is_active = false,
    lat       = null,
    lon       = null,
    city      = null,
    bio       = null
  where profile_id = p_user_id;

  delete from public.buddy_likes   where from_user = p_user_id or to_user = p_user_id;
  delete from public.buddy_matches where user_a   = p_user_id or user_b  = p_user_id;
end;
$$;

revoke all on function public.soft_delete_account(uuid, text) from public, anon, authenticated;
