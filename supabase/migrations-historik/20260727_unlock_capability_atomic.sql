-- Harden capability unlocks against a concurrency double-debit.
--
-- unlock_capability previously did `SELECT count(*)` for idempotency and then a
-- separate INSERT. Two truly-concurrent unlock calls could both see count=0,
-- both debit the token ledger, and both insert an unlock (double charge). Make
-- it atomic: a unique index turns the idempotency into a hard constraint, and
-- the function INSERTs first with ON CONFLICT DO NOTHING — only a freshly
-- created unlock debits tokens; a losing concurrent call debits nothing.
--
-- NULLS NOT DISTINCT (PG15+) so period-scope unlocks (listing_id IS NULL) also
-- dedupe, matching the old `is not distinct from` check.

CREATE UNIQUE INDEX IF NOT EXISTS capability_unlocks_uniq
  ON public.capability_unlocks (profile_id, capability, listing_id)
  NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.unlock_capability(
  p_profile uuid, p_capability text, p_listing uuid, p_cost int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
declare v_balance int; v_new_id uuid;
begin
  -- Atomic create-or-detect. ON CONFLICT DO NOTHING returns no row when the
  -- unlock already exists (or a concurrent call just created it) → we debit
  -- nothing. 'already' takes precedence over balance, matching prior behaviour.
  insert into public.capability_unlocks (profile_id, capability, scope, listing_id, locked_active, source)
    values (p_profile, p_capability, 'event', p_listing, true, 'token')
    on conflict (profile_id, capability, listing_id) do nothing
    returning id into v_new_id;

  if v_new_id is null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- Fresh unlock created in this transaction; require sufficient balance.
  select coalesce(sum(delta), 0) into v_balance
    from public.token_ledger where profile_id = p_profile;
  if v_balance < p_cost then
    -- Undo the unlock we just created (same transaction — externally invisible).
    delete from public.capability_unlocks where id = v_new_id;
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', v_balance);
  end if;

  insert into public.token_ledger (profile_id, delta, reason, ref)
    values (p_profile, -p_cost, 'unlock:' || p_capability, gen_random_uuid()::text);

  return jsonb_build_object('ok', true, 'balance', v_balance - p_cost);
end $$;

REVOKE ALL ON FUNCTION public.unlock_capability(uuid, text, uuid, int) FROM public, anon, authenticated;
