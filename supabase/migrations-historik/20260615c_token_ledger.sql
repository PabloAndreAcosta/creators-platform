-- "Nycklar" wallet — append-only token ledger. Balance = sum(delta).
-- Tokens unlock creator tools per use/period (a low-key alternative to the
-- subscription tiers). This slice only sets up the wallet + purchase; no gating
-- yet, so it's safe to ship on its own.
--
-- Append-only for a full audit trail. RLS: owners read their own ledger; only
-- service_role writes (credited by the Stripe webhook, debited by the unlock
-- endpoint in a later slice). Reversible: drop the table.

create table if not exists public.token_ledger (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,            -- + on purchase / grant, - on spend
  reason text not null,              -- 'purchase' | 'unlock:<cap>' | 'tier_grant' | 'adjustment'
  ref text,                          -- stripe payment_intent / unlock id (idempotency)
  created_at timestamptz not null default now()
);

create index if not exists token_ledger_profile_idx on public.token_ledger (profile_id);
create index if not exists token_ledger_ref_idx on public.token_ledger (ref);

alter table public.token_ledger enable row level security;

-- Owner can read their own ledger; writes are service_role only (no write policy).
drop policy if exists "own ledger read" on public.token_ledger;
create policy "own ledger read" on public.token_ledger
  for select using (auth.uid() = profile_id);

-- ── ROLLBACK ──
--   drop table if exists public.token_ledger;
