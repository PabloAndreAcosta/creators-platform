-- Capability unlocks: which creator tools a profile has unlocked with "nycklar".
-- An unlock represents a capability (e.g. the event pack) for a scope: a single
-- event (listing_id, locked_active = never revoked mid-event) or a time period
-- (expires_at). Access = tier grants it OR an active unlock exists.

create table if not exists public.capability_unlocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null,                 -- e.g. 'event_pack'
  scope text not null default 'event',      -- 'event' | 'period'
  listing_id uuid references public.listings(id) on delete cascade,
  expires_at timestamptz,                   -- for period scope
  locked_active boolean not null default true,
  source text not null default 'token',     -- 'token' | 'tier'
  created_at timestamptz not null default now()
);
create index if not exists capability_unlocks_profile_idx on public.capability_unlocks (profile_id);
create index if not exists capability_unlocks_listing_idx on public.capability_unlocks (listing_id);

alter table public.capability_unlocks enable row level security;
-- Owners read their own unlocks; writes happen only via the SECURITY DEFINER
-- function below (service_role), so no write policy is exposed.
drop policy if exists "own unlocks read" on public.capability_unlocks;
create policy "own unlocks read" on public.capability_unlocks
  for select using (auth.uid() = profile_id);

-- Atomically: idempotency check, balance check, debit ledger, create unlock.
create or replace function public.unlock_capability(
  p_profile uuid, p_capability text, p_listing uuid, p_cost int
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_balance int; v_existing int;
begin
  select count(*) into v_existing from public.capability_unlocks
   where profile_id = p_profile and capability = p_capability
     and listing_id is not distinct from p_listing;
  if v_existing > 0 then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select coalesce(sum(delta), 0) into v_balance
    from public.token_ledger where profile_id = p_profile;
  if v_balance < p_cost then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', v_balance);
  end if;

  insert into public.token_ledger (profile_id, delta, reason, ref)
    values (p_profile, -p_cost, 'unlock:' || p_capability, gen_random_uuid()::text);
  insert into public.capability_unlocks (profile_id, capability, scope, listing_id, locked_active, source)
    values (p_profile, p_capability, 'event', p_listing, true, 'token');

  return jsonb_build_object('ok', true, 'balance', v_balance - p_cost);
end $$;

-- Server-only: called from /api/tokens/unlock via the service-role client.
revoke all on function public.unlock_capability(uuid, text, uuid, int) from public, anon, authenticated;

-- Enforcement flag — false = open during beta (gates don't block); flip to true
-- (no deploy) to start enforcing tier/token gating. Mirrors matching_access.
insert into public.app_config (key, value)
values ('capabilities_enforced', 'false'::jsonb)
on conflict (key) do nothing;

-- ── ROLLBACK ──
--   drop function if exists public.unlock_capability(uuid, text, uuid, int);
--   drop table if exists public.capability_unlocks;
