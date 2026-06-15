-- Monthly nyckel (token) allowance per subscription tier. Paid tiers get a
-- bonus pot of nycklar each month to spend on token-gated extras; gratis/silver
-- get none (they buy nycklar — the token path). Credited lazily on balance read
-- (and before an unlock), so no cron is required. The commission split needs no
-- change: the token path always lands on a non-discount tier, which already pays
-- the base 15% in src/lib/stripe/commission.ts.

-- One allowance grant per profile per period (e.g. '2026-06'). The unique index
-- on the allowance ref makes the lazy crediting race-safe and idempotent.
create unique index if not exists token_ledger_allowance_uq
  on public.token_ledger (ref) where reason = 'allowance';

-- Atomically grant this period's allowance once. Re-runs (concurrent reads, the
-- same month) are no-ops via the unique ref. Never debits; amount<=0 is a no-op.
create or replace function public.grant_monthly_allowance(
  p_profile uuid, p_amount int, p_period text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_balance int;
begin
  if p_amount > 0 then
    begin
      insert into public.token_ledger (profile_id, delta, reason, ref)
        values (p_profile, p_amount, 'allowance', 'allowance:' || p_period || ':' || p_profile::text);
    exception when unique_violation then
      null; -- already granted this period
    end;
  end if;

  select coalesce(sum(delta), 0) into v_balance
    from public.token_ledger where profile_id = p_profile;
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

-- Server-only: called via the service-role client from the balance/unlock routes.
revoke all on function public.grant_monthly_allowance(uuid, int, text) from public, anon, authenticated;

-- ── ROLLBACK ──
--   drop function if exists public.grant_monthly_allowance(uuid, int, text);
--   drop index if exists token_ledger_allowance_uq;
