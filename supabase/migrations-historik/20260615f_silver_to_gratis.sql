-- Remap the legacy 'silver' tier to 'gratis'.
--
-- 'silver' predates the unified gratis/guld/premium model: it isn't in the
-- MemberTier type, nor handled in src/lib/listings/limits.ts (TIER_LIMITS) or
-- src/lib/stripe/commission.ts (COMMISSION_RATES). As a result the 13 'silver'
-- accounts hit an undefined listing limit (couldn't create listings at all) and
-- fell back to base commission. The app already treats silver as legacy/free:
-- the billing page maps silver->gratis for display and the Stripe webhook's
-- plan parser returns 'gratis' for a 'silver' plan. None of the 13 has any
-- subscription row, so this is a label fix, not a downgrade.
--
-- tier is a privileged column guarded by protect_profile_privileged_columns,
-- which only allows changes under a service_role JWT claim — set it here.
do $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles set tier = 'gratis' where tier = 'silver';
end $$;

-- ── ROLLBACK ──
--   Not reversible: 'silver' is an invalid value under the current tier model
--   (the gratis/guld/premium check constraint). The mapping is one-way by design.
