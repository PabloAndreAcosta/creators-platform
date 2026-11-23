-- Baslinje: hela schemat public som det ser ut i produktionen.
-- Byggd av scripts/db/bygg-baslinje.mjs – redigera inte för hand.
-- Källa: sandbox-baseline.sql (2026-08-26) + produktionens 95 migrationer efter den; katalogen jämförd med produktionen 2026-11-23
-- Äldre migrationer ligger i supabase/migrations-historik/ och körs inte längre.

-- Standardrättigheterna av medan objekten skapas (se scripts/db/baslinje.mjs).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--


--
-- Name: affiliate_on_first_listing(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.affiliate_on_first_listing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_ref uuid;
  v_prior integer;
begin
  if new.is_active is distinct from true then
    return new;
  end if;
  select referred_by into v_ref from public.profiles where id = new.user_id;
  if v_ref is null then
    return new;
  end if;
  select count(*) into v_prior from public.listings
    where user_id = new.user_id and is_active and id <> new.id;
  if v_prior > 0 then
    return new;
  end if;

  insert into public.affiliate_rewards (profile_id, referred_profile_id, kind, amount_ore, premium_days, ref, note)
  values (v_ref, new.user_id, 'credit', 5000, 0, 'first_listing:' || new.user_id || ':partner', 'Värvad profil publicerade sitt första utbud')
  on conflict (ref) do nothing;

  return new;
end;
$$;


ALTER FUNCTION public.affiliate_on_first_listing() OWNER TO postgres;

--
-- Name: award_points(uuid, text, integer, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.award_points(p_user_id uuid, p_action text, p_points integer, p_source_id uuid DEFAULT NULL::uuid, p_source_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  DECLARE
    v_new_total INTEGER;
    v_old_level INTEGER;
    v_new_level INTEGER;
    v_week_start DATE := date_trunc('week', now())::date;
    v_month_start DATE := date_trunc('month', now())::date;
    v_inserted BOOLEAN;
  BEGIN
    INSERT INTO public.point_events (user_id, action, points, source_id,
  source_type)
    VALUES (p_user_id, p_action, p_points, p_source_id, p_source_type)
    ON CONFLICT (user_id, action, source_id) WHERE source_id IS NOT NULL
    DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF NOT v_inserted THEN
      RETURN jsonb_build_object('duplicate', true);
    END IF;

    INSERT INTO public.user_points (user_id, total_points, points_this_week,
  points_this_month, week_start, month_start)
    VALUES (p_user_id, p_points, p_points, p_points, v_week_start,
  v_month_start)
    ON CONFLICT (user_id) DO UPDATE SET
      total_points = user_points.total_points + p_points,
      points_this_week = CASE
        WHEN user_points.week_start = v_week_start THEN
  user_points.points_this_week + p_points
        ELSE p_points
      END,
      points_this_month = CASE
        WHEN user_points.month_start = v_month_start THEN
  user_points.points_this_month + p_points
        ELSE p_points
      END,
      week_start = v_week_start,
      month_start = v_month_start,
      updated_at = now()
    RETURNING total_points, current_level INTO v_new_total, v_old_level;

    v_new_level := CASE
      WHEN v_new_total >= 10000 THEN 9
      WHEN v_new_total >= 5000  THEN 8
      WHEN v_new_total >= 2500  THEN 7
      WHEN v_new_total >= 1200  THEN 6
      WHEN v_new_total >= 600   THEN 5
      WHEN v_new_total >= 300   THEN 4
      WHEN v_new_total >= 150   THEN 3
      WHEN v_new_total >= 50    THEN 2
      ELSE 1
    END;

    IF v_new_level != v_old_level THEN
      UPDATE public.user_points SET current_level = v_new_level WHERE user_id =
  p_user_id;
    END IF;

    RETURN jsonb_build_object(
      'total_points', v_new_total,
      'new_level', v_new_level,
      'old_level', v_old_level,
      'leveled_up', v_new_level > v_old_level
    );
  END;
  $$;


ALTER FUNCTION public.award_points(p_user_id uuid, p_action text, p_points integer, p_source_id uuid, p_source_type text) OWNER TO postgres;

--
-- Name: claim_stripe_event(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_stripe_event(p_event_id text, p_session_id text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.shop_processed_stripe_events (event_id, session_id)
  values (p_event_id, p_session_id);
  return true;
exception when unique_violation then
  return false;
end;
$$;


ALTER FUNCTION public.claim_stripe_event(p_event_id text, p_session_id text) OWNER TO postgres;

--
-- Name: confirm_venue_listing(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.confirm_venue_listing(p_listing uuid, p_confirm boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_venue uuid;
begin
  select venue_profile_id into v_venue from public.listings where id = p_listing;
  if v_venue is null then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;

  if v_venue <> auth.uid() and not exists (
    select 1 from public.venue_members m
     where m.venue_profile_id = v_venue
       and m.user_id = auth.uid()
       and m.accepted_at is not null
       and m.removed_at is null
       and 'page' = any(m.capabilities)
  ) then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;

  update public.listings
     set venue_confirmed_at = case when p_confirm then now() else null end
   where id = p_listing;
end;
$$;


ALTER FUNCTION public.confirm_venue_listing(p_listing uuid, p_confirm boolean) OWNER TO postgres;

--
-- Name: consume_access_code(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.consume_access_code(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.event_access_codes
  SET used_count = used_count + 1
  WHERE id = p_id
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses);
$$;


ALTER FUNCTION public.consume_access_code(p_id uuid) OWNER TO postgres;

--
-- Name: count_referral_click(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.count_referral_click(p_code text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  insert into public.referral_clicks (code, day, count)
  select upper(p_code), (now() at time zone 'Europe/Stockholm')::date, 1
  where exists (select 1 from public.profiles where referral_code = upper(p_code))
  on conflict (code, day) do update set count = public.referral_clicks.count + 1;
$$;


ALTER FUNCTION public.count_referral_click(p_code text) OWNER TO postgres;

--
-- Name: current_user_admin_capabilities(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_user_admin_capabilities() RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  full_admin boolean;
  caps text[];
begin
  if auth.uid() is null then
    return array[]::text[];
  end if;

  select is_admin into full_admin from public.profiles where id = auth.uid();
  if full_admin is true then
    return array['*'];
  end if;

  select coalesce(array_agg(capability order by capability), array[]::text[])
    into caps
    from public.admin_capabilities
   where user_id = auth.uid();

  return caps;
end;
$$;


ALTER FUNCTION public.current_user_admin_capabilities() OWNER TO postgres;

--
-- Name: get_creator_commission(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_creator_commission(p_creator_id uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_tier VARCHAR(20);
BEGIN
  SELECT tier INTO v_tier
  FROM public.profiles
  WHERE id = p_creator_id;

  RETURN CASE v_tier
    WHEN 'premium' THEN 0.03
    WHEN 'guld'    THEN 0.08
    ELSE 0.15   -- gratis or not found
  END;
END;
$$;


ALTER FUNCTION public.get_creator_commission(p_creator_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_creator_commission(p_creator_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_creator_commission(p_creator_id uuid) IS 'Returns commission rate (decimal) for a creator based on their tier: gratis=15%, guld=8%, premium=3%';


--
-- Name: grant_monthly_allowance(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.grant_monthly_allowance(p_profile uuid, p_amount integer, p_period text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_balance int;
begin
  if p_amount > 0 then
    begin
      insert into public.token_ledger (profile_id, delta, reason, ref)
        values (p_profile, p_amount, 'allowance', 'allowance:' || p_period || ':' || p_profile::text);
    exception when unique_violation then
      null;
    end;
  end if;

  select coalesce(sum(delta), 0) into v_balance
    from public.token_ledger where profile_id = p_profile;
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;


ALTER FUNCTION public.grant_monthly_allowance(p_profile uuid, p_amount integer, p_period text) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
  resolved_is_company BOOLEAN;
  resolved_locale TEXT;
  resolved_marketing BOOLEAN;
BEGIN
  resolved_role := CASE new.raw_user_meta_data->>'role'
    WHEN 'creator'    THEN 'creator'
    WHEN 'venue'      THEN 'venue'
    WHEN 'experience' THEN 'venue'   -- gammalt namn, se migrationsfilen
    WHEN 'customer'   THEN 'customer'
    ELSE 'customer'
  END;

  resolved_subcategory := CASE
    WHEN resolved_role = 'creator'
      AND new.raw_user_meta_data->>'creator_subcategory' IN ('general', 'taxi_dancer')
      THEN new.raw_user_meta_data->>'creator_subcategory'
    ELSE 'general'
  END;

  -- COALESCE:n är inte kosmetisk: TRUE AND NULL är NULL i SQL, och kolumnen är
  -- NOT NULL. Utan den föll varje registrering av en kreatör utan bolag.
  resolved_is_company := COALESCE(
    resolved_role = 'creator'
    AND new.raw_user_meta_data->>'is_company' = 'true',
    false
  );

  resolved_locale := CASE
    WHEN new.raw_user_meta_data->>'locale' IN ('sv', 'en', 'es')
      THEN new.raw_user_meta_data->>'locale'
    ELSE NULL
  END;

  -- Bara den exakta strängen 'true' räknas. Allt annat — saknad nyckel, tom
  -- sträng, ett OAuth-flöde som aldrig visade rutan — blir nej.
  resolved_marketing := COALESCE(
    new.raw_user_meta_data->>'marketing_consent' = 'true',
    false
  );

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, creator_subcategory, is_company, locale)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    resolved_role,
    resolved_subcategory,
    resolved_is_company,
    resolved_locale
  );

  -- Samtyckesraden. Övriga kolumner tar sina defaults.
  INSERT INTO public.user_settings (user_id, notif_marketing)
  VALUES (new.id, resolved_marketing)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_updated_at() OWNER TO postgres;

--
-- Name: has_stripe_connect(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_stripe_connect(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_id
      AND p.is_public = true
      AND p.stripe_account_id IS NOT NULL
  );
$$;


ALTER FUNCTION public.has_stripe_connect(p_id uuid) OWNER TO postgres;

--
-- Name: increment_creator_promo_uses(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_creator_promo_uses(p_code text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.creator_promo_codes
  SET times_used = times_used + 1
  WHERE code = upper(btrim(p_code))
    AND is_active = true
    AND (max_uses IS NULL OR times_used < max_uses);
END;
$$;


ALTER FUNCTION public.increment_creator_promo_uses(p_code text) OWNER TO postgres;

--
-- Name: increment_promo_uses(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_promo_uses(promo_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  BEGIN
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1
    WHERE id = promo_id;
  END;
  $$;


ALTER FUNCTION public.increment_promo_uses(promo_id uuid) OWNER TO postgres;

--
-- Name: increment_tickets_sold(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_tickets_sold(p_listing uuid, p_n integer DEFAULT 1, p_ticket_type uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_ticket_type IS NOT NULL THEN
    UPDATE public.ticket_types
      SET tickets_sold = greatest(coalesce(tickets_sold, 0) + p_n, 0)
      WHERE id = p_ticket_type;
  END IF;
  UPDATE public.listings
    SET tickets_sold = greatest(coalesce(tickets_sold, 0) + p_n, 0)
    WHERE id = p_listing;
END;
$$;


ALTER FUNCTION public.increment_tickets_sold(p_listing uuid, p_n integer, p_ticket_type uuid) OWNER TO postgres;

--
-- Name: inherit_listing_vat_rate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.inherit_listing_vat_rate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.vat_rate is null and new.series_slug is not null then
    select l.vat_rate into new.vat_rate
    from public.listings l
    where l.series_slug = new.series_slug
      and l.user_id = new.user_id
      and l.vat_rate is not null
    order by l.event_date desc nulls last, l.created_at desc
    limit 1;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.inherit_listing_vat_rate() OWNER TO postgres;

--
-- Name: inherit_standing_rules(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.inherit_standing_rules() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.event_date is not null and new.venue_profile_id is not null then
    insert into public.event_revenue_shares
      (listing_id, partner_profile_id, partner_percent, vat_rate, payout_delay_days)
    select new.id, d.venue_profile_id, d.partner_percent, coalesce(new.vat_rate, d.vat_rate), d.payout_delay_days
    from public.venue_revenue_share_defaults d
    where d.venue_profile_id = new.venue_profile_id
    on conflict (listing_id) do nothing;
  end if;

  if new.series_slug is not null then
    insert into public.event_access_codes
      (listing_id, code, label, max_uses, discount_price, is_active)
    select new.id, c.code, c.label, c.max_uses, c.discount_price, c.is_active
    from public.series_access_codes c
    where c.series_slug = new.series_slug and c.is_active
    on conflict (listing_id, code) do nothing;

    insert into public.listing_collaborators
      (listing_id, user_id, role, status, accepted_at, can_scan, can_manage, can_view_stats)
    select new.id, s.user_id, s.role, 'accepted', now(), s.can_scan, s.can_manage, s.can_view_stats
    from public.series_collaborators s
    where s.series_slug = new.series_slug
    on conflict (listing_id, user_id) do nothing;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.inherit_standing_rules() OWNER TO postgres;

--
-- Name: instructor_profile_ready(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.instructor_profile_ready(p_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_uid
      AND p.role IN ('creator', 'kreator')
      AND p.offers_coaching = true
      AND p.coaching_hourly_rate_sek IS NOT NULL
      AND p.coaching_hourly_rate_sek > 0
      AND (
        p.stripe_account_id IS NOT NULL
        OR NOT (
          COALESCE(p.is_usha_owned_seller, false)
          OR (COALESCE(p.is_company, false) AND p.company_verified_at IS NOT NULL)
        )
      )
  );
$$;


ALTER FUNCTION public.instructor_profile_ready(p_uid uuid) OWNER TO postgres;

--
-- Name: is_approved_instructor(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_approved_instructor(p_uid uuid, p_listing uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listings l
    JOIN public.volunteer_approvals a
      ON a.scope_key = CASE WHEN l.series_id IS NOT NULL
                            THEN 'series:' || l.series_id::text
                            ELSE 'host:' || l.user_id::text END
    WHERE l.id = p_listing
      AND a.volunteer_id = p_uid
      AND a.role = 'instructor'
      AND a.status = 'approved'
  );
$$;


ALTER FUNCTION public.is_approved_instructor(p_uid uuid, p_listing uuid) OWNER TO postgres;

--
-- Name: is_bankid_cleared(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_bankid_cleared(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.is_bankid_cleared(uid uuid) OWNER TO postgres;

--
-- Name: is_current_user_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_current_user_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  );
$$;


ALTER FUNCTION public.is_current_user_admin() OWNER TO postgres;

--
-- Name: materialize_series_access_codes(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.materialize_series_access_codes(p_listing uuid, p_code text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_inserted integer;
begin
  insert into public.event_access_codes
    (listing_id, code, label, max_uses, discount_price, is_active)
  select l.id, c.code, c.label, c.max_uses, c.discount_price, true
  from public.listings l
  join public.series_access_codes c on c.series_slug = l.series_slug
  where l.id = p_listing
    and c.is_active
    and (p_code is null or upper(btrim(c.code)) = upper(btrim(p_code)))
  on conflict (listing_id, code) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;


ALTER FUNCTION public.materialize_series_access_codes(p_listing uuid, p_code text) OWNER TO postgres;

--
-- Name: FUNCTION materialize_series_access_codes(p_listing uuid, p_code text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.materialize_series_access_codes(p_listing uuid, p_code text) IS 'Kopierar ner seriens aktiva koder till en kväll som saknar dem. Idempotent.';


--
-- Name: min_rate(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.min_rate(rates jsonb) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(MIN(value::int), 0) FROM jsonb_each_text(rates);
$$;


ALTER FUNCTION public.min_rate(rates jsonb) OWNER TO postgres;

--
-- Name: protect_profile_payee_columns(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.protect_profile_payee_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.company_form := NULL;
    NEW.f_tax_verified_at := NULL;
    NEW.f_tax_source := NULL;
    NEW.f_tax_checked_by := NULL;
  ELSE
    NEW.company_form := OLD.company_form;
    NEW.f_tax_verified_at := OLD.f_tax_verified_at;
    NEW.f_tax_source := OLD.f_tax_source;
    NEW.f_tax_checked_by := OLD.f_tax_checked_by;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.protect_profile_payee_columns() OWNER TO postgres;

--
-- Name: protect_profile_privileged_columns(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.protect_profile_privileged_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION public.protect_profile_privileged_columns() OWNER TO postgres;

--
-- Name: FUNCTION protect_profile_privileged_columns(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.protect_profile_privileged_columns() IS 'Defense-in-depth: prevents authenticated users from elevating tier/role/is_admin or tampering with BankID/Stripe-derived columns via direct PATCH /profiles. Service role bypasses.';


--
-- Name: protect_stripe_account_rebind(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.protect_stripe_account_rebind() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.stripe_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.stripe_account_id IS NOT DISTINCT FROM OLD.stripe_account_id THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.allow_stripe_account_rebind', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Profil % är redan kopplad till Stripe-kontot % och kan inte bytas till % utan uttryckligt medgivande.',
    OLD.id, OLD.stripe_account_id, coalesce(NEW.stripe_account_id, 'NULL')
    USING
      ERRCODE = 'raise_exception',
      HINT = 'Ett anslutet konto kan bära saldo och skulder. Kör "set local app.allow_stripe_account_rebind = ''on'';" i samma transaktion om bytet är avsiktligt.';
END;
$$;


ALTER FUNCTION public.protect_stripe_account_rebind() OWNER TO postgres;

--
-- Name: FUNCTION protect_stripe_account_rebind(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.protect_stripe_account_rebind() IS 'Blocks changing or clearing profiles.stripe_account_id once set, for every role including service_role. Orphaning a connected account can strand a real balance. Opt in per transaction with app.allow_stripe_account_rebind.';


--
-- Name: redeem_access_code(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.redeem_access_code(p_listing uuid, p_code text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.event_access_codes
    where listing_id = p_listing and code = upper(btrim(p_code))
  ) then
    perform public.materialize_series_access_codes(p_listing, p_code);
  end if;

  update public.event_access_codes
  set used_count = used_count + 1
  where listing_id = p_listing
    and code = upper(btrim(p_code))
    and is_active = true
    and (max_uses is null or used_count < max_uses)
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION public.redeem_access_code(p_listing uuid, p_code text) OWNER TO postgres;

--
-- Name: release_access_code(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.release_access_code(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.event_access_codes
  SET used_count = greatest(used_count - 1, 0)
  WHERE id = p_id;
$$;


ALTER FUNCTION public.release_access_code(p_id uuid) OWNER TO postgres;

--
-- Name: release_stripe_event(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.release_stripe_event(p_event_id text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  delete from public.shop_processed_stripe_events where event_id = p_event_id;
$$;


ALTER FUNCTION public.release_stripe_event(p_event_id text) OWNER TO postgres;

--
-- Name: require_bankid_for_public_creator(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.require_bankid_for_public_creator() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_public = true THEN
    IF NEW.role IN ('venue', 'experience', 'upplevelse') THEN
      IF NEW.bankid_verified_at IS NULL AND NEW.company_verified_at IS NULL THEN
        NEW.is_public := false;
      END IF;
    ELSIF NEW.role IN ('creator', 'kreator', 'volunteer') THEN
      IF NEW.bankid_verified_at IS NULL THEN
        NEW.is_public := false;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.require_bankid_for_public_creator() OWNER TO postgres;

--
-- Name: FUNCTION require_bankid_for_public_creator(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.require_bankid_for_public_creator() IS 'Defense-in-depth: prevents creator/experience profiles from being made public without BankID verification. Service role bypasses.';


--
-- Name: reserve_ticket(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid DEFAULT NULL::uuid, p_n integer DEFAULT 1) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  cap integer; sold integer;
  tcap integer; tsold integer;
  pool record; psold integer;
  n integer := greatest(coalesce(p_n, 1), 1);
BEGIN
  SELECT capacity, coalesce(tickets_sold, 0) INTO cap, sold
    FROM public.listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cap IS NOT NULL AND sold + n > cap THEN RETURN false; END IF;

  IF p_ticket_type IS NOT NULL THEN
    FOR pool IN
      SELECT p.id, p.capacity
        FROM public.ticket_type_pools tp
        JOIN public.ticket_pools p ON p.id = tp.pool_id
       WHERE tp.ticket_type_id = p_ticket_type
       ORDER BY p.id
       FOR UPDATE OF p
    LOOP
      IF pool.capacity IS NOT NULL THEN
        SELECT coalesce(sum(coalesce(t.tickets_sold, 0)), 0) INTO psold
          FROM public.ticket_types t
          JOIN public.ticket_type_pools tp2 ON tp2.ticket_type_id = t.id
         WHERE tp2.pool_id = pool.id;
        IF psold + n > pool.capacity THEN RETURN false; END IF;
      END IF;
    END LOOP;

    SELECT capacity, coalesce(tickets_sold, 0) INTO tcap, tsold
      FROM public.ticket_types
      WHERE id = p_ticket_type AND listing_id = p_listing FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF tcap IS NOT NULL AND tsold + n > tcap THEN RETURN false; END IF;

    UPDATE public.ticket_types
      SET tickets_sold = coalesce(tickets_sold, 0) + n
      WHERE id = p_ticket_type;
  END IF;

  UPDATE public.listings
    SET tickets_sold = coalesce(tickets_sold, 0) + n
    WHERE id = p_listing;
  RETURN true;
END;
$$;


ALTER FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer) OWNER TO postgres;

--
-- Name: security_report(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.security_report() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select jsonb_build_object(
    'generated_at', now(),
    'tables_total', (select count(*) from pg_tables where schemaname = 'public'),
    'tables_without_rls', (
      select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
      from pg_tables where schemaname = 'public' and rowsecurity = false
    ),
    'tables_rls_without_policy', (
      select coalesce(jsonb_agg(t.tablename order by t.tablename), '[]'::jsonb)
      from pg_tables t
      where t.schemaname = 'public' and t.rowsecurity = true
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
    ),
    'policies_total', (select count(*) from pg_policies where schemaname = 'public'),
    'security_definer_functions', (
      select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
    ),
    'extensions', (select coalesce(jsonb_agg(extname order by extname), '[]'::jsonb) from pg_extension),
    'anon_table_grants', (
      select coalesce(jsonb_agg(distinct table_name order by table_name), '[]'::jsonb)
      from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public'
    )
  );
$$;


ALTER FUNCTION public.security_report() OWNER TO postgres;

--
-- Name: FUNCTION security_report(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.security_report() IS 'Månadskontrollens databasdel: RLS-täckning, policies, security definer-funktioner, tillägg, anon-grants. Bara service_role.';


--
-- Name: soft_delete_account(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.soft_delete_account(p_user_id uuid, p_reason text DEFAULT 'user-requested'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.soft_delete_account(p_user_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: unlock_capability(uuid, text, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.unlock_capability(p_profile uuid, p_capability text, p_listing uuid, p_cost integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare v_balance int; v_new_id uuid;
begin
  insert into public.capability_unlocks (profile_id, capability, scope, listing_id, locked_active, source)
    values (p_profile, p_capability, 'event', p_listing, true, 'token')
    on conflict (profile_id, capability, listing_id) do nothing
    returning id into v_new_id;

  if v_new_id is null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select coalesce(sum(delta), 0) into v_balance
    from public.token_ledger where profile_id = p_profile;
  if v_balance < p_cost then
    delete from public.capability_unlocks where id = v_new_id;
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', v_balance);
  end if;

  insert into public.token_ledger (profile_id, delta, reason, ref)
    values (p_profile, -p_cost, 'unlock:' || p_capability, gen_random_uuid()::text);

  return jsonb_build_object('ok', true, 'balance', v_balance - p_cost);
end $$;


ALTER FUNCTION public.unlock_capability(p_profile uuid, p_capability text, p_listing uuid, p_cost integer) OWNER TO postgres;

--
-- Name: update_openclaw_tasks_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_openclaw_tasks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_openclaw_tasks_updated_at() OWNER TO postgres;

--
-- Name: user_storage_bytes(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_storage_bytes(p_user uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id in ('creator-media','listing-images','event-images','avatars')
    and (o.owner = p_user or o.name like p_user::text || '/%');
$$;


ALTER FUNCTION public.user_storage_bytes(p_user uuid) OWNER TO postgres;

--
-- Name: venue_consent_count(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.venue_consent_count(p_venue uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int
    from public.venue_marketing_consents
   where venue_profile_id = p_venue
     and withdrawn_at is null
     and p_venue = auth.uid();
$$;


ALTER FUNCTION public.venue_consent_count(p_venue uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_credits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_credits (
    user_id uuid NOT NULL,
    amount_ore integer NOT NULL,
    reason text DEFAULT 'signup'::text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    used_at timestamp with time zone,
    used_booking_id uuid,
    notified_at timestamp with time zone,
    CONSTRAINT account_credits_amount_ore_check CHECK ((amount_ore > 0))
);


ALTER TABLE public.account_credits OWNER TO postgres;

--
-- Name: TABLE account_credits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.account_credits IS 'Engångsavdrag per konto. Usha bär kostnaden; partnerns andel räknas på ordinarie pris via bookings.credit_applied_ore.';


--
-- Name: COLUMN account_credits.notified_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.account_credits.notified_at IS 'När mottagaren fick mejlet om avdraget. Null = inte mejlad; gör utskicket ofarligt att köra om.';


--
-- Name: admin_capabilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_capabilities (
    user_id uuid NOT NULL,
    capability text NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_capabilities_known CHECK ((capability = ANY (ARRAY['creators'::text, 'promo'::text, 'partners'::text])))
);


ALTER TABLE public.admin_capabilities OWNER TO postgres;

--
-- Name: TABLE admin_capabilities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admin_capabilities IS 'One slice of the admin surface granted to a user. is_admin=true implies all of them.';


--
-- Name: COLUMN admin_capabilities.granted_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_capabilities.granted_by IS 'Who granted it — a permission with no trail is a permission nobody owns.';


--
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    period text NOT NULL,
    amount_ore integer NOT NULL,
    status text NOT NULL,
    stripe_transfer_id text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    destination_account_id text,
    CONSTRAINT affiliate_payouts_amount_ore_check CHECK ((amount_ore >= 0)),
    CONSTRAINT affiliate_payouts_status_check CHECK ((status = ANY (ARRAY['dry_run'::text, 'paid'::text, 'credited'::text, 'failed'::text])))
);


ALTER TABLE public.affiliate_payouts OWNER TO postgres;

--
-- Name: COLUMN affiliate_payouts.destination_account_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.affiliate_payouts.destination_account_id IS 'Stripe-kontot överföringen gick till. Samma skäl som för event_settlement_payouts. NULL = rad från före 2026-10-12.';


--
-- Name: affiliate_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    referred_profile_id uuid,
    booking_id uuid,
    kind text NOT NULL,
    amount_ore integer DEFAULT 0 NOT NULL,
    premium_days integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    ref text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    payout_ref text,
    CONSTRAINT affiliate_rewards_amount_ore_check CHECK ((amount_ore >= 0)),
    CONSTRAINT affiliate_rewards_kind_check CHECK ((kind = ANY (ARRAY['credit'::text, 'premium_days'::text, 'commission_share'::text]))),
    CONSTRAINT affiliate_rewards_premium_days_check CHECK ((premium_days >= 0)),
    CONSTRAINT affiliate_rewards_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'void'::text])))
);


ALTER TABLE public.affiliate_rewards OWNER TO postgres;

--
-- Name: TABLE affiliate_rewards; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.affiliate_rewards IS 'Partnerprogrammets belöningar. En rad per händelse, idempotent via ref. status: pending → approved → paid, eller void (t.ex. återbetalning).';


--
-- Name: agreement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agreement_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agreement_id uuid NOT NULL,
    actor_id uuid,
    kind text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agreement_events_kind_check CHECK ((kind = ANY (ARRAY['created'::text, 'edited'::text, 'sent'::text, 'signed'::text, 'declined'::text, 'withdrawn'::text, 'viewed'::text])))
);


ALTER TABLE public.agreement_events OWNER TO postgres;

--
-- Name: agreements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    counterparty_id uuid NOT NULL,
    listing_id uuid,
    template_key text DEFAULT 'free'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    content_hash text,
    sent_at timestamp with time zone,
    creator_signed_at timestamp with time zone,
    creator_sign_name text,
    creator_sign_ip text,
    creator_sign_ua text,
    counterparty_signed_at timestamp with time zone,
    counterparty_sign_name text,
    counterparty_sign_ip text,
    counterparty_sign_ua text,
    declined_at timestamp with time zone,
    decline_reason text,
    withdrawn_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agreements_check CHECK ((created_by <> counterparty_id)),
    CONSTRAINT agreements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'declined'::text, 'withdrawn'::text]))),
    CONSTRAINT agreements_template_key_check CHECK ((template_key = ANY (ARRAY['cohost'::text, 'gig'::text, 'venue'::text, 'free'::text])))
);


ALTER TABLE public.agreements OWNER TO postgres;

--
-- Name: TABLE agreements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.agreements IS 'Avtal mellan två konton, signerade med enkel e-signatur (BankID-verifierat konto + logg). Skrivs bara via API:t.';


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_config OWNER TO postgres;

--
-- Name: TABLE app_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.app_config IS 'Server-side runtime config (e.g. matching_access). Read via service_role with a short in-process cache. RLS enabled with no policies => locked to service_role.';


--
-- Name: archived_deleted_rows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archived_deleted_rows (
    id bigint NOT NULL,
    table_name text NOT NULL,
    row_data jsonb NOT NULL,
    reason text,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.archived_deleted_rows OWNER TO postgres;

--
-- Name: archived_deleted_rows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.archived_deleted_rows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.archived_deleted_rows_id_seq OWNER TO postgres;

--
-- Name: archived_deleted_rows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.archived_deleted_rows_id_seq OWNED BY public.archived_deleted_rows.id;


--
-- Name: bastu_interest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bastu_interest (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_slug text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    postal_code text,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bastu_interest OWNER TO postgres;

--
-- Name: booking_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_queue (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    listing_id uuid NOT NULL,
    user_id uuid NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_booked boolean DEFAULT false NOT NULL,
    auto_booked_at timestamp with time zone
);


ALTER TABLE public.booking_queue OWNER TO postgres;

--
-- Name: TABLE booking_queue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.booking_queue IS 'Waitlist queue for fully booked events. Auto-books when spots open.';


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    listing_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    customer_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_payment_id text,
    amount_paid integer,
    booking_type text DEFAULT 'manual'::text,
    guest_count integer DEFAULT 1,
    special_requests text,
    attendees jsonb DEFAULT '[]'::jsonb,
    checked_in_at timestamp with time zone,
    guest_email text,
    guest_name text,
    sessions_total integer,
    sessions_redeemed integer DEFAULT 0 NOT NULL,
    agreed_price integer,
    reminder_sent_at timestamp with time zone,
    reminder_soon_sent_at timestamp with time zone,
    minutes_total integer,
    minutes_redeemed integer DEFAULT 0 NOT NULL,
    scanned_by uuid,
    is_free boolean DEFAULT false NOT NULL,
    refunded_at timestamp with time zone,
    refund_amount integer,
    stripe_refund_id text,
    ticket_type_id uuid,
    ticket_type_name text,
    platform_fee_amount integer,
    credit_applied_ore integer DEFAULT 0 NOT NULL,
    referred_by uuid,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    show_attendance boolean DEFAULT false NOT NULL,
    pass_expires_at timestamp with time zone,
    payment_method text,
    CONSTRAINT bookings_agreed_price_check CHECK (((agreed_price IS NULL) OR (agreed_price >= 0))),
    CONSTRAINT bookings_booking_type_check CHECK ((booking_type = ANY (ARRAY['manual'::text, 'ticket'::text, 'instructor_minutes'::text]))),
    CONSTRAINT bookings_minutes_redeemed_check CHECK ((minutes_redeemed >= 0)),
    CONSTRAINT bookings_minutes_redeemed_within_total CHECK (((minutes_total IS NULL) OR (minutes_redeemed <= minutes_total))),
    CONSTRAINT bookings_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['epassi'::text, 'swish'::text])))),
    CONSTRAINT bookings_sessions_redeemed_check CHECK ((sessions_redeemed >= 0)),
    CONSTRAINT bookings_sessions_redeemed_within_total CHECK (((sessions_total IS NULL) OR (sessions_redeemed <= sessions_total))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'canceled'::text])))
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: COLUMN bookings.sessions_total; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.sessions_total IS 'Klippkortets storlek vid köptillfället. Null = inte ett klippkort.';


--
-- Name: COLUMN bookings.sessions_redeemed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.sessions_redeemed IS 'Antal inlösta pass. Når det sessions_total markeras bokningen completed.';


--
-- Name: COLUMN bookings.platform_fee_amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.platform_fee_amount IS 'Usha application_fee for this order in öre (commission + service fee). Null/0 for free tickets. Used by the organizer settlement report.';


--
-- Name: COLUMN bookings.credit_applied_ore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.credit_applied_ore IS 'Välkomstavdrag som Usha stod för. Läggs tillbaka i underlaget före partnerdelning.';


--
-- Name: COLUMN bookings.referred_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.referred_by IS 'Partnern vars länk ledde till köpet (12-månadersfönster från registrering, eller cookie för gäster).';


--
-- Name: COLUMN bookings.utm_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.utm_source IS 'Kanalen köpet kom från (instagram, facebook, linkedin …). Fångas i middleware från adressens utm_source, bärs genom kassan i Stripe-metadata. Null = okänd kanal, inte "direkt".';


--
-- Name: COLUMN bookings.show_attendance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.show_attendance IS 'Köparen har aktivt valt att synas bland deltagarna på eventsidan. Default false — köp är inget samtycke.';


--
-- Name: COLUMN bookings.pass_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.pass_expires_at IS 'Sista dag klippen får lösas in. Sätts vid köp till köpdatum + lika många månader som klipp. Null = kort sålt innan giltighetstiden infördes, gäller tills vidare.';


--
-- Name: COLUMN bookings.payment_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bookings.payment_method IS 'Externt betalsätt. null = Stripe/gratis. ''epassi'' = friskvårdsbidrag via Epassi, bekräftas manuellt. ''swish'' = Swish Företag i dörren, registreras av entrévärden.';


--
-- Name: buddy_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buddy_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_user uuid NOT NULL,
    to_user uuid NOT NULL,
    action text DEFAULT 'like'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT buddy_likes_action_check CHECK ((action = ANY (ARRAY['like'::text, 'pass'::text]))),
    CONSTRAINT buddy_likes_check CHECK ((from_user <> to_user))
);


ALTER TABLE public.buddy_likes OWNER TO postgres;

--
-- Name: buddy_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buddy_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_a uuid NOT NULL,
    user_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT buddy_matches_check CHECK ((user_a < user_b))
);


ALTER TABLE public.buddy_matches OWNER TO postgres;

--
-- Name: calendar_import_hidden; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_import_hidden (
    user_id uuid NOT NULL,
    external_uid text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_import_hidden_external_uid_check CHECK (((char_length(external_uid) >= 1) AND (char_length(external_uid) <= 500)))
);


ALTER TABLE public.calendar_import_hidden OWNER TO postgres;

--
-- Name: capability_unlocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capability_unlocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    capability text NOT NULL,
    scope text DEFAULT 'event'::text NOT NULL,
    listing_id uuid,
    expires_at timestamp with time zone,
    locked_active boolean DEFAULT true NOT NULL,
    source text DEFAULT 'token'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.capability_unlocks OWNER TO postgres;

--
-- Name: collaborator_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collaborator_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    role text NOT NULL,
    token text NOT NULL,
    invited_email text,
    invited_phone text,
    invited_by uuid NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    accepted_user_id uuid,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_user_id uuid,
    CONSTRAINT collaborator_invites_role_check CHECK ((role = ANY (ARRAY['creator'::text, 'taxi_dancer'::text, 'volunteer'::text, 'co_host'::text]))),
    CONSTRAINT collaborator_invites_target_check CHECK (((invited_email IS NOT NULL) OR (invited_phone IS NOT NULL) OR (invited_user_id IS NOT NULL)))
);


ALTER TABLE public.collaborator_invites OWNER TO postgres;

--
-- Name: collaborator_payment_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collaborator_payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collaborator_id uuid NOT NULL,
    amount_sek integer NOT NULL,
    currency text DEFAULT 'SEK'::text NOT NULL,
    note text,
    status text DEFAULT 'requested'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decision_note text,
    paid_at timestamp with time zone,
    paid_note text,
    CONSTRAINT collaborator_payment_requests_amount_sek_check CHECK ((amount_sek >= 0)),
    CONSTRAINT collaborator_payment_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'declined'::text, 'paid'::text, 'cancelled'::text])))
);


ALTER TABLE public.collaborator_payment_requests OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    participant_a uuid NOT NULL,
    participant_b uuid NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_check CHECK ((participant_a < participant_b))
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: creator_availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    available_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    start_time time without time zone,
    end_time time without time zone,
    CONSTRAINT check_time_slot CHECK ((((start_time IS NULL) AND (end_time IS NULL)) OR ((start_time IS NOT NULL) AND (end_time IS NOT NULL) AND (end_time > start_time))))
);


ALTER TABLE public.creator_availability OWNER TO postgres;

--
-- Name: creator_commitments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_commitments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    kind text NOT NULL,
    role text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    location text,
    note text,
    purpose text,
    cost_transport_ore integer,
    cost_lodging_ore integer,
    cost_food_ore integer,
    cost_ticket_ore integer,
    cost_other_ore integer,
    income_ore integer,
    cost_note text,
    source text DEFAULT 'manual'::text NOT NULL,
    external_uid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT creator_commitments_cost_food_ore_check CHECK (((cost_food_ore IS NULL) OR ((cost_food_ore >= 0) AND (cost_food_ore <= 100000000)))),
    CONSTRAINT creator_commitments_cost_lodging_ore_check CHECK (((cost_lodging_ore IS NULL) OR ((cost_lodging_ore >= 0) AND (cost_lodging_ore <= 100000000)))),
    CONSTRAINT creator_commitments_cost_note_check CHECK (((cost_note IS NULL) OR (char_length(cost_note) <= 500))),
    CONSTRAINT creator_commitments_cost_other_ore_check CHECK (((cost_other_ore IS NULL) OR ((cost_other_ore >= 0) AND (cost_other_ore <= 100000000)))),
    CONSTRAINT creator_commitments_cost_ticket_ore_check CHECK (((cost_ticket_ore IS NULL) OR ((cost_ticket_ore >= 0) AND (cost_ticket_ore <= 100000000)))),
    CONSTRAINT creator_commitments_cost_transport_ore_check CHECK (((cost_transport_ore IS NULL) OR ((cost_transport_ore >= 0) AND (cost_transport_ore <= 100000000)))),
    CONSTRAINT creator_commitments_dates_check CHECK ((end_date >= start_date)),
    CONSTRAINT creator_commitments_external_uid_check CHECK (((external_uid IS NULL) OR (char_length(external_uid) <= 500))),
    CONSTRAINT creator_commitments_income_ore_check CHECK (((income_ore IS NULL) OR ((income_ore >= 0) AND (income_ore <= 100000000)))),
    CONSTRAINT creator_commitments_kind_check CHECK ((kind = ANY (ARRAY['festival'::text, 'jobb'::text, 'kurs'::text, 'annat'::text]))),
    CONSTRAINT creator_commitments_location_check CHECK (((location IS NULL) OR (char_length(location) <= 160))),
    CONSTRAINT creator_commitments_note_check CHECK (((note IS NULL) OR (char_length(note) <= 1000))),
    CONSTRAINT creator_commitments_purpose_check CHECK (((purpose IS NULL) OR (purpose = ANY (ARRAY['jobb'::text, 'larande'::text, 'natverk'::text, 'marknadsforing'::text, 'noje'::text, 'annat'::text])))),
    CONSTRAINT creator_commitments_role_check CHECK (((role IS NULL) OR (char_length(role) <= 60))),
    CONSTRAINT creator_commitments_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'google'::text]))),
    CONSTRAINT creator_commitments_title_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120)))
);


ALTER TABLE public.creator_commitments OWNER TO postgres;

--
-- Name: creator_debts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_debts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_profile_id uuid NOT NULL,
    listing_id uuid,
    booking_id uuid,
    amount_ore bigint NOT NULL,
    reason text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT creator_debts_reason_check CHECK ((reason = ANY (ARRAY['refund_after_payout'::text, 'offset'::text, 'manual'::text])))
);


ALTER TABLE public.creator_debts OWNER TO postgres;

--
-- Name: TABLE creator_debts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.creator_debts IS 'Skuld som uppstår när en redan utbetald andel återbetalas. Positivt belopp = partnern är skyldig Usha, negativt = kvittat. Saldo = summan per partner_profile_id.';


--
-- Name: COLUMN creator_debts.amount_ore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.creator_debts.amount_ore IS 'Ören. Positivt = ny skuld, negativt = kvittning mot ett underlag.';


--
-- Name: creator_earnings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    listing_id uuid,
    amount_ore bigint NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    paid_note text,
    CONSTRAINT creator_earnings_amount_ore_check CHECK ((amount_ore > 0))
);


ALTER TABLE public.creator_earnings OWNER TO postgres;

--
-- Name: TABLE creator_earnings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.creator_earnings IS 'Vad Usha är skyldig en kreatör för en kväll. Belopp FÖRE skatt och sociala avgifter — vad som landar på kontot beror på utbetalningsvägen och räknas inte här. paid_at sätts när ersättningen faktiskt betalats ut.';


--
-- Name: creator_media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_media (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    media_type text NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    caption text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    is_hero boolean DEFAULT false,
    section text,
    CONSTRAINT creator_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'instagram'::text, 'instagram-profile'::text, 'vimeo'::text, 'youtube'::text])))
);


ALTER TABLE public.creator_media OWNER TO postgres;

--
-- Name: creator_memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price_ore integer NOT NULL,
    "interval" text DEFAULT 'month'::text NOT NULL,
    series_ids uuid[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT creator_memberships_interval_check CHECK (("interval" = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT creator_memberships_price_ore_check CHECK ((price_ore >= 0))
);


ALTER TABLE public.creator_memberships OWNER TO postgres;

--
-- Name: TABLE creator_memberships; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.creator_memberships IS 'Medlemskap en kreatör erbjuder sina deltagare. Opt-in per kreatör; gäller bara kvällar kreatören äger själv.';


--
-- Name: creator_promo_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.creator_promo_codes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    creator_id uuid NOT NULL,
    code text NOT NULL,
    discount_percent integer DEFAULT 0,
    discount_amount integer DEFAULT 0,
    max_uses integer,
    times_used integer DEFAULT 0,
    is_active boolean DEFAULT true,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT creator_promo_codes_discount_percent_check CHECK (((discount_percent >= 0) AND (discount_percent <= 100)))
);


ALTER TABLE public.creator_promo_codes OWNER TO postgres;

--
-- Name: credit_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    delta_ore integer NOT NULL,
    reason text NOT NULL,
    ref text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.credit_ledger OWNER TO postgres;

--
-- Name: TABLE credit_ledger; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.credit_ledger IS 'Kredit i öre att handla för. Positiva rader = påfyllning, negativa = använt i kassan. ref gör varje rad idempotent.';


--
-- Name: csp_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.csp_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    document_uri text,
    referrer text,
    violated_directive text,
    effective_directive text,
    blocked_uri text,
    source_file text,
    line_number integer,
    column_number integer,
    status_code integer,
    disposition text,
    user_agent text,
    raw jsonb
);


ALTER TABLE public.csp_reports OWNER TO postgres;

--
-- Name: TABLE csp_reports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.csp_reports IS 'CSP (Content-Security-Policy) violation reports collected from the Report-Only policy. Inserted by /api/csp-report via service_role; read for analysis before promoting CSP to enforced. RLS enabled with no policies => locked to service_role only.';


--
-- Name: data_deletion_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.data_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    external_user_id text NOT NULL,
    confirmation_code text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    notes text
);


ALTER TABLE public.data_deletion_requests OWNER TO postgres;

--
-- Name: digital_product_content; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digital_product_content (
    product_id uuid NOT NULL,
    video_url text,
    file_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.digital_product_content OWNER TO postgres;

--
-- Name: digital_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digital_products (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    price integer DEFAULT 0 NOT NULL,
    product_type text NOT NULL,
    thumbnail_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT digital_products_product_type_check CHECK ((product_type = ANY (ARRAY['video'::text, 'course'::text, 'download'::text, 'other'::text])))
);


ALTER TABLE public.digital_products OWNER TO postgres;

--
-- Name: digital_purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digital_purchases (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    amount_paid integer NOT NULL,
    stripe_payment_id text,
    promo_code text,
    creator_promo_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.digital_purchases OWNER TO postgres;

--
-- Name: dj_wish_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dj_wish_votes (
    wish_id uuid NOT NULL,
    voter_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dj_wish_votes OWNER TO postgres;

--
-- Name: dj_wishes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dj_wishes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_key text NOT NULL,
    name text NOT NULL,
    link text,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dj_wishes_link_check CHECK (((link IS NULL) OR (char_length(link) <= 300))),
    CONSTRAINT dj_wishes_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80))),
    CONSTRAINT dj_wishes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'booking'::text, 'booked'::text, 'hidden'::text])))
);


ALTER TABLE public.dj_wishes OWNER TO postgres;

--
-- Name: email_broadcasts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_broadcasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    sender_id uuid NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    cta_label text,
    cta_url text,
    audience text DEFAULT 'waitlist'::text NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    creator_id uuid
);


ALTER TABLE public.email_broadcasts OWNER TO postgres;

--
-- Name: COLUMN email_broadcasts.listing_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_broadcasts.listing_id IS 'Kvällen utskicket gällde. Null för utskick till kreatörens egna följare, som inte hör till en enskild kväll.';


--
-- Name: COLUMN email_broadcasts.creator_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_broadcasts.creator_id IS 'Kreatören vars följare fick utskicket. Sätts för audience = followers; null för väntelisteutskick.';


--
-- Name: email_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_follows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    followed_id uuid NOT NULL,
    locale text,
    source text NOT NULL,
    confirm_token uuid DEFAULT gen_random_uuid() NOT NULL,
    confirmed_at timestamp with time zone,
    unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_follows_source_check CHECK ((source = ANY (ARRAY['ticket'::text, 'event_page'::text])))
);


ALTER TABLE public.email_follows OWNER TO postgres;

--
-- Name: TABLE email_follows; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_follows IS 'Följare utan konto. confirmed_at null = väntar på bekräftelse (dubbel opt-in från eventsidan); biljettköpare bekräftas direkt eftersom de agerar från sin egen biljettlänk.';


--
-- Name: event_access_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_access_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    code text NOT NULL,
    label text,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    discount_price integer,
    CONSTRAINT event_access_codes_discount_price_check CHECK (((discount_price IS NULL) OR (discount_price > 0)))
);


ALTER TABLE public.event_access_codes OWNER TO postgres;

--
-- Name: COLUMN event_access_codes.discount_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_access_codes.discount_price IS 'NULL = gratis biljett (team/VIP). Satt (kr) = betald biljett till detta slutpris via Stripe.';


--
-- Name: event_instructors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_instructors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    instructor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.event_instructors OWNER TO postgres;

--
-- Name: event_revenue_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_revenue_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    partner_profile_id uuid NOT NULL,
    partner_percent integer NOT NULL,
    vat_rate numeric(4,3) DEFAULT 0.25 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payout_delay_days integer DEFAULT 1 NOT NULL,
    CONSTRAINT event_revenue_shares_partner_percent_check CHECK (((partner_percent >= 0) AND (partner_percent <= 100))),
    CONSTRAINT event_revenue_shares_payout_delay_days_check CHECK (((payout_delay_days >= 0) AND (payout_delay_days <= 30))),
    CONSTRAINT event_revenue_shares_vat_rate_check CHECK (((vat_rate >= (0)::numeric) AND (vat_rate < (1)::numeric)))
);


ALTER TABLE public.event_revenue_shares OWNER TO postgres;

--
-- Name: TABLE event_revenue_shares; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.event_revenue_shares IS 'Avtalad intäktsdelning mellan arrangör och samarbetspartner för ett evenemang.';


--
-- Name: COLUMN event_revenue_shares.payout_delay_days; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_revenue_shares.payout_delay_days IS 'Antal hela dagar efter evenemangsdatum innan utbetalningen görs. 1 = dagen efter.';


--
-- Name: event_settlement_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_settlement_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    partner_profile_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    amount_ore integer NOT NULL,
    gross_ore integer NOT NULL,
    refunded_ore integer NOT NULL,
    vat_ore integer NOT NULL,
    basis_ore integer NOT NULL,
    partner_percent integer NOT NULL,
    vat_rate numeric(4,3) NOT NULL,
    stripe_transfer_id text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    destination_account_id text,
    CONSTRAINT event_settlement_payouts_amount_ore_check CHECK ((amount_ore >= 0)),
    CONSTRAINT event_settlement_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'dry_run'::text, 'skipped'::text])))
);


ALTER TABLE public.event_settlement_payouts OWNER TO postgres;

--
-- Name: TABLE event_settlement_payouts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.event_settlement_payouts IS 'Utbetalning av partnerns andel per kväll. UNIQUE(listing_id) hindrar dubbelbetalning.';


--
-- Name: COLUMN event_settlement_payouts.destination_account_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_settlement_payouts.destination_account_id IS 'Stripe-kontot överföringen gick till. Sätts till den avsedda mottagaren när raden skapas och skrivs över med transfer.destination när Stripe svarat. NULL = rad från före 2026-10-12, slå upp i Stripe på stripe_transfer_id.';


--
-- Name: event_settlement_supplements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_settlement_supplements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    partner_profile_id uuid NOT NULL,
    seq integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    amount_ore integer NOT NULL,
    due_ore integer NOT NULL,
    previously_paid_ore integer NOT NULL,
    gross_ore integer NOT NULL,
    refunded_ore integer DEFAULT 0 NOT NULL,
    vat_ore integer NOT NULL,
    basis_ore integer NOT NULL,
    partner_percent numeric NOT NULL,
    vat_rate numeric NOT NULL,
    destination_account_id text,
    stripe_transfer_id text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    CONSTRAINT event_settlement_supplements_amount_ore_check CHECK ((amount_ore > 0)),
    CONSTRAINT event_settlement_supplements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'dry_run'::text])))
);


ALTER TABLE public.event_settlement_supplements OWNER TO postgres;

--
-- Name: TABLE event_settlement_supplements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.event_settlement_supplements IS 'Efterbetalningar till partner för kvällar vars ursprungliga avräkning redan är betald. En rad per komplettering.';


--
-- Name: COLUMN event_settlement_supplements.seq; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_settlement_supplements.seq IS 'Löpnummer per kväll. Ger raden sin egen Stripe-grupp, skild från ursprungsavräkningens.';


--
-- Name: COLUMN event_settlement_supplements.amount_ore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_settlement_supplements.amount_ore IS 'Mellanskillnaden som förs över. Alltid > 0 — en överbetalning rättas aldrig automatiskt.';


--
-- Name: event_waitlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    name text,
    email text NOT NULL,
    source text,
    unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone,
    released_notified_at timestamp with time zone
);


ALTER TABLE public.event_waitlist OWNER TO postgres;

--
-- Name: COLUMN event_waitlist.notified_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_waitlist.notified_at IS 'When this person was emailed that a seat opened up (refund/cancel freed capacity). Null = not yet notified; used to walk the FIFO list one seat at a time.';


--
-- Name: COLUMN event_waitlist.released_notified_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_waitlist.released_notified_at IS 'When this person was emailed that tickets were released / went on sale. Null = not yet notified. Separate from notified_at (refund seat-freed flow).';


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.favorites OWNER TO postgres;

--
-- Name: TABLE favorites; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.favorites IS 'User wishlist / saved listings';


--
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid NOT NULL,
    followed_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follows OWNER TO postgres;

--
-- Name: gage_agreements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gage_agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    host_id uuid NOT NULL,
    collaborator_user_id uuid NOT NULL,
    amount_ore integer NOT NULL,
    proposed_by text NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    note text,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    stripe_transfer_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agreed_at timestamp with time zone,
    paid_at timestamp with time zone,
    canceled_at timestamp with time zone,
    CONSTRAINT gage_agreements_amount_ore_check CHECK ((amount_ore > 0)),
    CONSTRAINT gage_agreements_proposed_by_check CHECK ((proposed_by = ANY (ARRAY['host'::text, 'crew'::text]))),
    CONSTRAINT gage_agreements_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'agreed'::text, 'paid'::text, 'canceled'::text])))
);


ALTER TABLE public.gage_agreements OWNER TO postgres;

--
-- Name: gig_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gig_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gig_id uuid NOT NULL,
    applicant_id uuid NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gig_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])))
);


ALTER TABLE public.gig_applications OWNER TO postgres;

--
-- Name: gigs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gigs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    arranger_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    event_date date NOT NULL,
    event_time time without time zone,
    venue text,
    venue_address text,
    proposed_price integer NOT NULL,
    perks text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    listing_id uuid,
    pass_type text,
    event_end_time time without time zone,
    CONSTRAINT gigs_pass_type_check CHECK ((pass_type = ANY (ARRAY['taxi_dancer'::text, 'instructor'::text, 'other'::text]))),
    CONSTRAINT gigs_proposed_price_check CHECK ((proposed_price >= 0)),
    CONSTRAINT gigs_status_check CHECK ((status = ANY (ARRAY['open'::text, 'filled'::text, 'closed'::text, 'canceled'::text])))
);


ALTER TABLE public.gigs OWNER TO postgres;

--
-- Name: listen_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listen_documents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    content_length integer GENERATED ALWAYS AS (char_length(content)) STORED,
    source text DEFAULT 'paste'::text NOT NULL,
    source_url text,
    progress integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT listen_documents_content_check CHECK ((char_length(content) <= 500000)),
    CONSTRAINT listen_documents_progress_check CHECK ((progress >= 0)),
    CONSTRAINT listen_documents_source_check CHECK ((source = ANY (ARRAY['paste'::text, 'file'::text, 'url'::text, 'pdf'::text, 'epub'::text])))
);


ALTER TABLE public.listen_documents OWNER TO postgres;

--
-- Name: TABLE listen_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.listen_documents IS 'Texter sparade i uppläsaren (/app/lyssna), synkade mellan användarens enheter';


--
-- Name: listing_collaborators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'invited'::text NOT NULL,
    invited_by uuid,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    removed_at timestamp with time zone,
    can_scan boolean DEFAULT false NOT NULL,
    can_manage boolean DEFAULT false NOT NULL,
    can_view_stats boolean DEFAULT false NOT NULL,
    attending boolean DEFAULT false NOT NULL,
    CONSTRAINT listing_collaborators_role_check CHECK ((role = ANY (ARRAY['creator'::text, 'taxi_dancer'::text, 'volunteer'::text, 'co_host'::text]))),
    CONSTRAINT listing_collaborators_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'accepted'::text, 'declined'::text, 'removed'::text])))
);


ALTER TABLE public.listing_collaborators OWNER TO postgres;

--
-- Name: COLUMN listing_collaborators.can_manage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listing_collaborators.can_manage IS 'Co-organizer: may administer the event (edit/broadcast/stats/crew/codes) but never money or ownership. Granted by the owner.';


--
-- Name: COLUMN listing_collaborators.can_view_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listing_collaborators.can_view_stats IS 'Får se evenemangets siffror (sålt, incheckat, intäkt) men inte deltagarlistan och inget av det can_manage ger.';


--
-- Name: listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    price integer,
    duration_minutes integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    event_tier character varying(1) DEFAULT 'a'::character varying NOT NULL,
    release_to_gold_at timestamp with time zone,
    facebook_event_id text,
    image_url text,
    event_date date,
    event_time time without time zone,
    event_location text,
    capacity integer,
    listing_type text DEFAULT 'service'::text,
    min_guests integer DEFAULT 1,
    max_guests integer,
    experience_details jsonb DEFAULT '{}'::jsonb,
    event_lat double precision,
    event_lng double precision,
    event_place_id text,
    event_end_time time without time zone,
    is_promoted boolean DEFAULT false,
    promoted_until timestamp with time zone,
    slug text,
    session_count integer,
    followers_notified_at timestamp with time zone,
    series_id uuid,
    series_slug text,
    fb_auto_post boolean DEFAULT false NOT NULL,
    fb_reminder_posted_at timestamp with time zone,
    open_to_instructors boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archived_reason text,
    event_city text,
    event_venue text,
    is_public boolean DEFAULT true NOT NULL,
    early_bird_start timestamp with time zone,
    early_bird_end timestamp with time zone,
    early_bird_price numeric,
    public_sale_at timestamp with time zone,
    tickets_sold integer DEFAULT 0 NOT NULL,
    image_url_square text,
    content_language text,
    organizer_name text,
    service_fee_mode text DEFAULT 'buyer'::text NOT NULL,
    venue_profile_id uuid,
    venue_confirmed_at timestamp with time zone,
    created_by uuid,
    venue_followers_notified_at timestamp with time zone,
    pass_series_id uuid,
    pass_covers text,
    sort_order integer,
    pass_series_ids uuid[],
    pass_reference_price integer,
    is_wellness_eligible boolean DEFAULT false NOT NULL,
    tldr text,
    from_gig boolean DEFAULT false NOT NULL,
    is_practica boolean DEFAULT false NOT NULL,
    vat_rate numeric(4,3),
    CONSTRAINT listings_event_tier_check CHECK (((event_tier)::text = ANY (ARRAY[('a'::character varying)::text, ('b'::character varying)::text, ('c'::character varying)::text]))),
    CONSTRAINT listings_listing_type_check CHECK ((listing_type = ANY (ARRAY['service'::text, 'event'::text, 'table_reservation'::text, 'spa_treatment'::text, 'group_activity'::text, 'package'::text, 'dance_package'::text, 'coaching_session'::text, 'b2b_offering'::text]))),
    CONSTRAINT listings_service_fee_mode_check CHECK ((service_fee_mode = ANY (ARRAY['buyer'::text, 'absorb'::text]))),
    CONSTRAINT listings_session_count_check CHECK (((session_count IS NULL) OR (session_count > 0))),
    CONSTRAINT listings_vat_rate_check CHECK (((vat_rate IS NULL) OR (vat_rate = ANY (ARRAY[(0)::numeric, 0.06, 0.12, 0.25]))))
);


ALTER TABLE public.listings OWNER TO postgres;

--
-- Name: COLUMN listings.event_tier; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.event_tier IS 'Dynamic discount tier: a = full price, b = moderate discount, c = max discount';


--
-- Name: COLUMN listings.release_to_gold_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.release_to_gold_at IS 'When this listing becomes available to Guld/Premium members (early access)';


--
-- Name: COLUMN listings.capacity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.capacity IS 'Maximum number of bookings for this listing (NULL = unlimited)';


--
-- Name: COLUMN listings.session_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.session_count IS 'Antal pass i ett klippkort (listing_type = package). Null för andra typer.';


--
-- Name: COLUMN listings.is_public; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.is_public IS 'Olistat event om false: nåbart via direktlänk (slug) men dolt från marknadsplats/browse. Gating sker i app-queries, ej RLS.';


--
-- Name: COLUMN listings.image_url_square; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.image_url_square IS 'Valfri kvadratisk variant av bannern som visas på mobil; null → använd image_url.';


--
-- Name: COLUMN listings.content_language; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.content_language IS 'Tvingat visningsspråk för event-sidan (sv|en); null = följ besökarens locale.';


--
-- Name: COLUMN listings.organizer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.organizer_name IS 'Visad arrangör/organizer på event-sidan; null = använd kontoägarens namn.';


--
-- Name: COLUMN listings.venue_profile_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.venue_profile_id IS 'Lokalen (profil med rollen venue) där evenemanget äger rum. Skilt från event_venue, som bara är ett namn från Google Places.';


--
-- Name: COLUMN listings.venue_confirmed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.venue_confirmed_at IS 'När lokalen bekräftade kopplingen. NULL = obekräftad; evenemanget syns då inte på lokalens sida och lokalens följare notifieras inte.';


--
-- Name: COLUMN listings.created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.created_by IS 'Teammedlemmen som skapade evenemanget i lokalens namn. NULL = ägaren själv skapade det.';


--
-- Name: COLUMN listings.venue_followers_notified_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.venue_followers_notified_at IS 'När lokalens följare notifierades. Skilt från followers_notified_at, eftersom lokalens godkännande kommer efter att arrangörens följare redan fått besked.';


--
-- Name: COLUMN listings.pass_series_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.pass_series_id IS 'Klippkort (package): series_id för den serie kortet ger tillträde till. Null = löses in manuellt.';


--
-- Name: COLUMN listings.pass_covers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.pass_covers IS 'Klippkort: vad ett klipp ger tillträde till, i klartext för dörren (t.ex. "Allt: practica + workshop + social").';


--
-- Name: COLUMN listings.sort_order; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.sort_order IS 'Kreatörens egen ordning på sina tjänster. Lägre tal först. NULL = ingen egen ordning, sorteras sist och faller tillbaka på created_at.';


--
-- Name: COLUMN listings.pass_series_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.pass_series_ids IS 'Serierna ett klippkort gäller på. Sanningen; pass_series_id speglar första värdet för bakåtkompatibilitet.';


--
-- Name: COLUMN listings.pass_reference_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.pass_reference_price IS 'Ordinarie pris per kväll som klippkortets rabatt räknas mot. Null = jämför mot biljettypen som heter pass_covers, annars entrépriset.';


--
-- Name: COLUMN listings.is_wellness_eligible; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.is_wellness_eligible IS 'Kortet/kvällen innehåller bara undervisning och motion, aldrig social med barservering — alltså friskvårdsberättigat och betalbart med Epassi när det flödet finns.';


--
-- Name: COLUMN listings.tldr; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.tldr IS 'Kort sammanfattning som visas öppet vid tid och plats på eventsidan. Max ett par meningar: vad det är, nivå, vad det kostar.';


--
-- Name: COLUMN listings.vat_rate; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.vat_rate IS 'Momssats för det som säljs på det här evenemanget/kortet. null = standard (25 %, Stripe Tax). Styr kassan och avräkningen. Ärvs av nya kvällar i serien.';


--
-- Name: membership_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membership_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    scanned_by uuid,
    entered_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.membership_entries OWNER TO postgres;

--
-- Name: TABLE membership_entries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.membership_entries IS 'Medlems närvaro på en kväll. Inget förbrukas — unik nyckel hindrar dubbelskanning.';


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_membership_id uuid NOT NULL,
    member_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    stripe_subscription_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'expired'::text])))
);


ALTER TABLE public.memberships OWNER TO postgres;

--
-- Name: TABLE memberships; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.memberships IS 'En deltagares medlemskap. current_period_end avgör giltighet i dörren, inte status.';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_content_check CHECK (((char_length(content) > 0) AND (char_length(content) <= 2000)))
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title_key text,
    body_key text,
    params jsonb
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notifications IS 'In-app notification feed';


--
-- Name: COLUMN notifications.title_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.title_key IS 'i18n key under serverNotifications for the heading; null = use the frozen title.';


--
-- Name: COLUMN notifications.body_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.body_key IS 'i18n key under serverNotifications for the body; null = use the frozen message.';


--
-- Name: COLUMN notifications.params; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.params IS 'Values interpolated into title_key/body_key, e.g. {"service":"Salsa 101"}.';


--
-- Name: ob_bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venue_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    amount_gross integer NOT NULL,
    commission integer NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    vat_on_commission_only boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT commission_not_exceeding_gross CHECK ((commission <= amount_gross)),
    CONSTRAINT ob_bookings_amount_gross_check CHECK ((amount_gross >= 0)),
    CONSTRAINT ob_bookings_commission_check CHECK ((commission >= 0)),
    CONSTRAINT ob_bookings_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'accepted'::text, 'in_escrow'::text, 'completed'::text, 'settled'::text, 'disputed'::text, 'cancelled'::text, 'refunded'::text])))
);


ALTER TABLE public.ob_bookings OWNER TO postgres;

--
-- Name: ob_creator_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_creator_profiles (
    user_id uuid NOT NULL,
    track text NOT NULL,
    org_no text,
    fskatt_status text DEFAULT 'unknown'::text NOT NULL,
    fskatt_checked_at timestamp with time zone,
    vat_no text,
    stripe_account_id text,
    eor_worker_id text,
    bank_account text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ob_creator_profiles_fskatt_status_check CHECK ((fskatt_status = ANY (ARRAY['active'::text, 'inactive'::text, 'unknown'::text]))),
    CONSTRAINT ob_creator_profiles_track_check CHECK ((track = ANY (ARRAY['C1'::text, 'C2'::text, 'C3'::text, 'C4'::text])))
);


ALTER TABLE public.ob_creator_profiles OWNER TO postgres;

--
-- Name: ob_dac7_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_dac7_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    quarter smallint NOT NULL,
    year smallint NOT NULL,
    consideration integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'SEK'::text NOT NULL,
    CONSTRAINT ob_dac7_records_quarter_check CHECK (((quarter >= 1) AND (quarter <= 4)))
);


ALTER TABLE public.ob_dac7_records OWNER TO postgres;

--
-- Name: ob_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    provider text NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    kind text DEFAULT 'payout'::text NOT NULL,
    gross integer DEFAULT 0 NOT NULL,
    tax integer DEFAULT 0 NOT NULL,
    fees integer DEFAULT 0 NOT NULL,
    commission integer DEFAULT 0 NOT NULL,
    net integer DEFAULT 0 NOT NULL,
    released_at timestamp with time zone,
    CONSTRAINT ob_payouts_kind_check CHECK ((kind = ANY (ARRAY['payout'::text, 'expense_reimbursement'::text]))),
    CONSTRAINT ob_payouts_provider_check CHECK ((provider = ANY (ARRAY['stripe'::text, 'eor'::text]))),
    CONSTRAINT ob_payouts_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'held'::text, 'released'::text, 'paid'::text, 'blocked'::text, 'failed'::text])))
);


ALTER TABLE public.ob_payouts OWNER TO postgres;

--
-- Name: ob_track_changes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_track_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    from_track text NOT NULL,
    to_track text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ob_track_changes OWNER TO postgres;

--
-- Name: ob_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_users (
    id uuid NOT NULL,
    bankid_verified boolean DEFAULT false NOT NULL,
    name text,
    personal_no text,
    email text,
    phone text,
    tax_residence_country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ob_users OWNER TO postgres;

--
-- Name: ob_venue_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ob_venue_profiles (
    user_id uuid NOT NULL,
    type text NOT NULL,
    org_no text NOT NULL,
    vat_no text,
    billing_info text,
    po_reference text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ob_venue_profiles_type_check CHECK ((type = ANY (ARRAY['V1'::text, 'V2'::text, 'V3'::text])))
);


ALTER TABLE public.ob_venue_profiles OWNER TO postgres;

--
-- Name: openclaw_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.openclaw_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    title text NOT NULL,
    description text NOT NULL,
    task_type text NOT NULL,
    priority integer DEFAULT 5,
    status text DEFAULT 'queued'::text NOT NULL,
    assigned_to text DEFAULT 'openclaw'::text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    execution_log jsonb DEFAULT '[]'::jsonb,
    result text,
    error_message text,
    repo_path text,
    branch text DEFAULT 'main'::text,
    files_affected text[],
    requires_approval boolean DEFAULT false,
    approved_by text,
    approved_at timestamp with time zone,
    dry_run boolean DEFAULT true,
    max_tokens integer DEFAULT 5000,
    created_by text NOT NULL,
    tags text[]
);


ALTER TABLE public.openclaw_tasks OWNER TO postgres;

--
-- Name: pass_redemptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pass_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
    scanned_by uuid,
    is_manual boolean DEFAULT false NOT NULL,
    amount_paid_ore integer,
    platform_fee_ore integer,
    credit_ore integer
);


ALTER TABLE public.pass_redemptions OWNER TO postgres;

--
-- Name: TABLE pass_redemptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pass_redemptions IS 'Ett klipp på ett klippkort, knutet till det tillfälle (listing) där det löstes in.';


--
-- Name: COLUMN pass_redemptions.is_manual; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pass_redemptions.is_manual IS 'true = efterregistrerat klipp, inte skannat i dörren. Ligger utanför spärren mot dubbelskanning.';


--
-- Name: COLUMN pass_redemptions.amount_paid_ore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pass_redemptions.amount_paid_ore IS 'Klippets andel av kortets pris, fryst när klippet togs. Null = äldre rad, räknas som 1/N.';


--
-- Name: COLUMN pass_redemptions.platform_fee_ore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pass_redemptions.platform_fee_ore IS 'Klippets andel av plattformsavgiften, fryst när klippet togs.';


--
-- Name: COLUMN pass_redemptions.credit_ore; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pass_redemptions.credit_ore IS 'Klippets andel av välkomstavdraget, fryst när klippet togs.';


--
-- Name: payee_f_tax_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payee_f_tax_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    action text NOT NULL,
    checked_at timestamp with time zone,
    source text,
    company_form text,
    org_number text,
    checked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payee_f_tax_checks_action_check CHECK ((action = ANY (ARRAY['registered'::text, 'removed'::text]))),
    CONSTRAINT payee_f_tax_checks_source_check CHECK ((source = ANY (ARRAY['skatteverket_manuell'::text, 'skatteverket_api'::text])))
);


ALTER TABLE public.payee_f_tax_checks OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    stripe_payment_id text,
    amount integer NOT NULL,
    currency text DEFAULT 'sek'::text,
    status text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    payment_method text,
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['succeeded'::text, 'pending'::text, 'failed'::text, 'refunded'::text])))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: COLUMN payments.payment_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.payment_method IS 'Stripe payment_method_details.type used for this payment (e.g. card, swish, klarna). NULL = unknown/no charge.';


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payouts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    creator_id uuid NOT NULL,
    amount_gross numeric(10,2) NOT NULL,
    amount_commission numeric(10,2) NOT NULL,
    amount_net numeric(10,2) NOT NULL,
    payout_type character varying(20) NOT NULL,
    stripe_payout_id character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    CONSTRAINT payouts_amount_commission_check CHECK ((amount_commission >= (0)::numeric)),
    CONSTRAINT payouts_amount_gross_check CHECK ((amount_gross > (0)::numeric)),
    CONSTRAINT payouts_check CHECK ((amount_net = (amount_gross - amount_commission))),
    CONSTRAINT payouts_payout_type_check CHECK (((payout_type)::text = ANY (ARRAY[('batch'::character varying)::text, ('instant'::character varying)::text]))),
    CONSTRAINT payouts_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in_transit'::character varying)::text, ('paid'::character varying)::text, ('failed'::character varying)::text])))
);


ALTER TABLE public.payouts OWNER TO postgres;

--
-- Name: TABLE payouts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payouts IS 'Creator payout records. Commission based on tier: gratis 15%, guld 8%, premium 3%.';


--
-- Name: payroll_shadow_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_shadow_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    creator_id uuid NOT NULL,
    pass_date date NOT NULL,
    paid_on date NOT NULL,
    price_ore integer NOT NULL,
    vat_ore integer NOT NULL,
    commission_ore integer NOT NULL,
    labour_budget_ore integer NOT NULL,
    gross_ore integer NOT NULL,
    holiday_pay_ore integer NOT NULL,
    employer_fee_ore integer NOT NULL,
    fee_basis text NOT NULL,
    withholding_ore integer NOT NULL,
    net_ore integer NOT NULL,
    rounding_rest_ore integer NOT NULL,
    sam_fee_ore integer NOT NULL,
    sam_net_ore integer NOT NULL,
    estimated boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    live boolean DEFAULT false NOT NULL,
    sam_submitted_at timestamp with time zone,
    sam_reference text,
    voided_at timestamp with time zone,
    shift_signup_id uuid,
    CONSTRAINT payroll_shadow_lines_commission_ore_check CHECK ((commission_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_employer_fee_ore_check CHECK ((employer_fee_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_fee_basis_check CHECK ((fee_basis = ANY (ARRAY['full'::text, 'senior'::text, 'none'::text, 'youth'::text]))),
    CONSTRAINT payroll_shadow_lines_gross_ore_check CHECK ((gross_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_holiday_pay_ore_check CHECK ((holiday_pay_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_labour_budget_ore_check CHECK ((labour_budget_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_net_ore_check CHECK ((net_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_price_ore_check CHECK ((price_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_rounding_rest_ore_check CHECK ((rounding_rest_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_sam_fee_ore_check CHECK ((sam_fee_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_sam_net_ore_check CHECK ((sam_net_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_vat_ore_check CHECK ((vat_ore >= 0)),
    CONSTRAINT payroll_shadow_lines_withholding_ore_check CHECK ((withholding_ore >= 0)),
    CONSTRAINT payroll_shadow_source CHECK (((booking_id IS NULL) <> (shift_signup_id IS NULL))),
    CONSTRAINT payroll_shadow_sums CHECK ((((((vat_ore + commission_ore) + gross_ore) + employer_fee_ore) + rounding_rest_ore) = price_ore))
);


ALTER TABLE public.payroll_shadow_lines OWNER TO postgres;

--
-- Name: point_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.point_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    points integer NOT NULL,
    source_id uuid,
    source_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_events_action_check CHECK ((action = ANY (ARRAY['like_given'::text, 'like_received'::text, 'follow_given'::text, 'follow_received'::text, 'booking_made'::text, 'booking_received'::text, 'review_written'::text, 'review_received'::text, 'post_created'::text, 'referral_signup'::text, 'profile_completed'::text])))
);


ALTER TABLE public.point_events OWNER TO postgres;

--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    post_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_likes OWNER TO postgres;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    image_url text,
    listing_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: premium_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.premium_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    days integer NOT NULL,
    source text DEFAULT 'affiliate'::text NOT NULL,
    ref text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    tier_before text,
    reverted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT premium_grants_days_check CHECK ((days > 0))
);


ALTER TABLE public.premium_grants OWNER TO postgres;

--
-- Name: TABLE premium_grants; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.premium_grants IS 'Tidsbegränsad premium från partnerprogrammet. tier_before återställs av det dagliga jobbet när ends_at passerat, om inget aktivt abonnemang finns.';


--
-- Name: profile_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_preferences (
    profile_id uuid NOT NULL,
    dance_styles text[] DEFAULT '{}'::text[] NOT NULL,
    skill_level text,
    city text,
    radius_km integer DEFAULT 25 NOT NULL,
    looking_for text[] DEFAULT '{}'::text[] NOT NULL,
    visible_in_matching boolean DEFAULT true NOT NULL,
    onboarding_completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profile_preferences OWNER TO postgres;

--
-- Name: TABLE profile_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.profile_preferences IS 'Per-profile matching preferences collected via onboarding; editable in Profile. visible_in_matching is the opt-out for appearing as a match candidate.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    bio text,
    website text,
    category text,
    location text,
    hourly_rate integer,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tier character varying(20) DEFAULT 'gratis'::character varying NOT NULL,
    stripe_account_id text,
    facebook_page_id text,
    facebook_page_name text,
    facebook_page_access_token text,
    role text DEFAULT 'customer'::text,
    calendar_sync_token uuid,
    categories text[] DEFAULT '{}'::text[],
    locations text[] DEFAULT '{}'::text[],
    rates jsonb DEFAULT '{}'::jsonb,
    websites text[] DEFAULT '{}'::text[],
    social_instagram text,
    social_x text,
    social_facebook text,
    contact_email text,
    contact_phone text,
    slug text,
    whitelabel_logo_url text,
    whitelabel_brand_name text,
    whitelabel_accent_color text,
    whitelabel_enabled boolean DEFAULT false,
    whitelabel_primary_color text,
    whitelabel_accent_color_2 text,
    whitelabel_accent_color_3 text,
    instagram_user_id text,
    instagram_username text,
    instagram_access_token text,
    tiktok_user_id text,
    tiktok_username text,
    tiktok_access_token text,
    tiktok_refresh_token text,
    bankid_verified_at timestamp with time zone,
    bankid_personal_number text,
    bankid_name text,
    referral_code text,
    referred_by uuid,
    is_admin boolean DEFAULT false,
    creator_subcategory text DEFAULT 'general'::text,
    dance_styles text[],
    dance_languages text[],
    dance_experience_years integer,
    offers_coaching boolean DEFAULT false,
    coaching_hourly_rate_sek integer,
    coaching_specialties text[],
    coaching_bio text,
    bankid_grandfathered_at timestamp with time zone,
    archived_at timestamp with time zone,
    archived_reason text,
    org_number text,
    company_name text,
    company_verified_at timestamp with time zone,
    company_verification_method text,
    is_marketplace_verified boolean GENERATED ALWAYS AS (
CASE
    WHEN (role = ANY (ARRAY['venue'::text, 'experience'::text, 'upplevelse'::text])) THEN ((company_verified_at IS NOT NULL) OR (bankid_verified_at IS NOT NULL))
    WHEN (role = ANY (ARRAY['creator'::text, 'kreator'::text])) THEN (bankid_verified_at IS NOT NULL)
    ELSE false
END) STORED,
    deleted_at timestamp with time zone,
    deleted_reason text,
    stripe_card_payments_enabled boolean DEFAULT false NOT NULL,
    stripe_charges_enabled boolean DEFAULT false NOT NULL,
    stripe_details_submitted boolean DEFAULT false NOT NULL,
    is_usha_owned_seller boolean DEFAULT false NOT NULL,
    terms_url text,
    is_company boolean DEFAULT false NOT NULL,
    locale text,
    calendar_feed_last_fetched_at timestamp with time zone,
    calendar_feed_last_client text,
    referred_at timestamp with time zone,
    founding_partner_since timestamp with time zone,
    founding_partner_until timestamp with time zone,
    share_token uuid,
    share_token_created_at timestamp with time zone,
    stripe_payouts_enabled boolean,
    bankid_birth_date date,
    coaching_title text,
    coaching_formats text[],
    cancellation_hours integer,
    coaching_credentials text[],
    signup_utm_source text,
    signup_utm_medium text,
    signup_utm_campaign text,
    signup_utm_content text,
    external_calendar_ics_url text,
    company_form text,
    f_tax_verified_at timestamp with time zone,
    f_tax_source text,
    f_tax_checked_by uuid,
    CONSTRAINT profiles_cancellation_hours_check CHECK (((cancellation_hours IS NULL) OR ((cancellation_hours >= 1) AND (cancellation_hours <= 720)))),
    CONSTRAINT profiles_coaching_credentials_check CHECK (((coaching_credentials IS NULL) OR (cardinality(coaching_credentials) <= 10))),
    CONSTRAINT profiles_coaching_formats_check CHECK (((coaching_formats IS NULL) OR (coaching_formats <@ ARRAY['in_person'::text, 'online'::text]))),
    CONSTRAINT profiles_coaching_hourly_rate_sek_check CHECK (((coaching_hourly_rate_sek IS NULL) OR (coaching_hourly_rate_sek >= 0))),
    CONSTRAINT profiles_coaching_title_check CHECK (((coaching_title IS NULL) OR ((char_length(coaching_title) >= 1) AND (char_length(coaching_title) <= 40)))),
    CONSTRAINT profiles_company_form_check CHECK ((company_form = ANY (ARRAY['aktiebolag'::text, 'enskild_firma'::text, 'forening'::text]))),
    CONSTRAINT profiles_creator_subcategory_check CHECK ((creator_subcategory = ANY (ARRAY['general'::text, 'taxi_dancer'::text]))),
    CONSTRAINT profiles_dance_experience_years_check CHECK (((dance_experience_years IS NULL) OR (dance_experience_years >= 0))),
    CONSTRAINT profiles_external_calendar_ics_url_check CHECK (((external_calendar_ics_url IS NULL) OR (char_length(external_calendar_ics_url) <= 2000))),
    CONSTRAINT profiles_f_tax_source_check CHECK ((f_tax_source = ANY (ARRAY['skatteverket_manuell'::text, 'skatteverket_api'::text]))),
    CONSTRAINT profiles_subcategory_requires_creator CHECK (((creator_subcategory = 'general'::text) OR ((creator_subcategory = 'taxi_dancer'::text) AND (role = 'creator'::text)))),
    CONSTRAINT profiles_tier_check CHECK (((tier)::text = ANY ((ARRAY['gratis'::character varying, 'guld'::character varying, 'premium'::character varying])::text[])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.tier; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.tier IS 'Creator tier: gratis (15% commission), guld (8%), premium (3%)';


--
-- Name: COLUMN profiles.stripe_account_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect Express account ID for creator payouts';


--
-- Name: COLUMN profiles.bankid_grandfathered_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.bankid_grandfathered_at IS 'Set for creator/experience users who registered before BankID enforcement (2026-05-05). They retain commercial-action access without re-verifying.';


--
-- Name: COLUMN profiles.stripe_card_payments_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.stripe_card_payments_enabled IS 'Stripe Connect card_payments capability is active — required before on_behalf_of (merchant-of-record shift to the organizer).';


--
-- Name: COLUMN profiles.is_usha_owned_seller; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.is_usha_owned_seller IS 'Seller is Usha itself → principal/gross accounting flow, not third-party/net.';


--
-- Name: COLUMN profiles.terms_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.terms_url IS 'Organizer purchase-terms URL, shown at checkout and stamped on the charge as the consent record.';


--
-- Name: COLUMN profiles.is_company; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.is_company IS 'Creator sells as a company (chosen at signup) → gets org.nr verification + company receipt/MoR path.';


--
-- Name: COLUMN profiles.locale; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.locale IS 'UI language this person reads the app in (sv|en|es); null = fall back to English.';


--
-- Name: COLUMN profiles.calendar_feed_last_fetched_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.calendar_feed_last_fetched_at IS 'När kalenderflödet senast hämtades av en kalenderklient.';


--
-- Name: COLUMN profiles.calendar_feed_last_client; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.calendar_feed_last_client IS 'Grov gissning av vilken kalender som hämtade: google | apple | outlook | other.';


--
-- Name: COLUMN profiles.founding_partner_since; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.founding_partner_since IS 'När grundarpartnerstatusen började gälla. NULL = inte grundarpartner.';


--
-- Name: COLUMN profiles.founding_partner_until; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.founding_partner_until IS 'När statusen upphör. NULL = tills vidare. Sätt hellre ett datum och förläng.';


--
-- Name: COLUMN profiles.share_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.share_token IS 'Hemlig token för att visa en opublik profil via länk. NULL = ingen delning aktiv. Rotera genom att sätta ett nytt värde.';


--
-- Name: COLUMN profiles.share_token_created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.share_token_created_at IS 'När token utfärdades. Finns för att kunna se hur gammal en delning är.';


--
-- Name: COLUMN profiles.stripe_payouts_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.stripe_payouts_enabled IS 'Stripe Connect payouts_enabled. Null = osynkat. Sätts av connect-sync, account.updated-webhooken och /api/stripe/connect/status.';


--
-- Name: COLUMN profiles.company_form; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.company_form IS 'Verifierad bolagsform för utbetalning: aktiebolag, enskild_firma eller forening. Sätts bara av admin/service-role.';


--
-- Name: COLUMN profiles.f_tax_verified_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.f_tax_verified_at IS 'När F-skatten senast kontrollerades som godkänd (Skatteverket). Skild från company_verified_at (VIES-moms).';


--
-- Name: COLUMN profiles.f_tax_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.f_tax_source IS 'Källa för F-skattekontrollen: skatteverket_manuell (Hämta företagsinformation) eller skatteverket_api.';


--
-- Name: COLUMN profiles.f_tax_checked_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.f_tax_checked_by IS 'Admin som registrerade kontrollen.';


--
-- Name: promo_code_uses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promo_code_uses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    promo_code_id uuid NOT NULL,
    user_id uuid NOT NULL,
    used_for text NOT NULL,
    reference_id text,
    discount_amount numeric,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promo_code_uses_used_for_check CHECK ((used_for = ANY (ARRAY['subscription'::text, 'ticket'::text])))
);


ALTER TABLE public.promo_code_uses OWNER TO postgres;

--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    discount_value numeric NOT NULL,
    scope text DEFAULT 'both'::text NOT NULL,
    allowed_plans text[],
    max_uses integer,
    current_uses integer DEFAULT 0,
    max_uses_per_user integer DEFAULT 1,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    stripe_coupon_id text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promo_codes_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text]))),
    CONSTRAINT promo_codes_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT promo_codes_scope_check CHECK ((scope = ANY (ARRAY['subscription'::text, 'ticket'::text, 'both'::text])))
);


ALTER TABLE public.promo_codes OWNER TO postgres;

--
-- Name: TABLE promo_codes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.promo_codes IS 'Rabattkoder. Läsbara under RLS endast för sin egen skapare; inlösen och validering går via service-role i src/lib/promo/validate.ts.';


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    locale text
);


ALTER TABLE public.push_subscriptions OWNER TO postgres;

--
-- Name: COLUMN push_subscriptions.locale; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.push_subscriptions.locale IS 'UI language this device subscribed in (sv|en|es); null = fall back to English.';


--
-- Name: referral_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_clicks (
    code text NOT NULL,
    day date NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.referral_clicks OWNER TO postgres;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: TABLE reviews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reviews IS 'Customer reviews for completed bookings';


--
-- Name: rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name_sv text NOT NULL,
    description_sv text NOT NULL,
    reward_type text NOT NULL,
    required_level integer NOT NULL,
    icon text,
    discount_percent integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rewards_reward_type_check CHECK ((reward_type = ANY (ARRAY['badge'::text, 'discount'::text, 'early_access'::text, 'feature'::text])))
);


ALTER TABLE public.rewards OWNER TO postgres;

--
-- Name: series_access_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.series_access_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    series_slug text NOT NULL,
    code text NOT NULL,
    label text,
    max_uses integer DEFAULT 1 NOT NULL,
    discount_price integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT series_access_codes_max_uses_check CHECK ((max_uses >= 1))
);


ALTER TABLE public.series_access_codes OWNER TO postgres;

--
-- Name: TABLE series_access_codes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.series_access_codes IS 'Koder som gäller varje kväll i en serie. Nya kvällar ärver dem till event_access_codes.';


--
-- Name: series_collaborators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.series_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    series_slug text NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    can_scan boolean DEFAULT false NOT NULL,
    can_manage boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    can_view_stats boolean DEFAULT false NOT NULL,
    CONSTRAINT series_collaborators_role_check CHECK ((role = ANY (ARRAY['creator'::text, 'taxi_dancer'::text, 'volunteer'::text, 'co_host'::text])))
);


ALTER TABLE public.series_collaborators OWNER TO postgres;

--
-- Name: TABLE series_collaborators; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.series_collaborators IS 'Medarrangörer som gäller hela serien. Nya kvällar ärver dem till listing_collaborators.';


--
-- Name: COLUMN series_collaborators.can_view_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.series_collaborators.can_view_stats IS 'Får medvärden se kvällens siffror? Ärvs till listing_collaborators när en ny kväll läggs in. Default false — insyn är ägarens aktiva val.';


--
-- Name: settlement_statements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settlement_statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_profile_id uuid NOT NULL,
    period text NOT NULL,
    recipients text[] DEFAULT '{}'::text[] NOT NULL,
    totals jsonb NOT NULL,
    internal_sent_at timestamp with time zone,
    partner_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT settlement_statements_period_check CHECK ((period ~ '^\d{4}-(0[1-9]|1[0-2])$'::text))
);


ALTER TABLE public.settlement_statements OWNER TO postgres;

--
-- Name: shop_processed_stripe_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shop_processed_stripe_events (
    event_id text NOT NULL,
    session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shop_processed_stripe_events OWNER TO postgres;

--
-- Name: social_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    instagram_user_id text,
    instagram_username text,
    instagram_access_token text,
    facebook_page_id text,
    facebook_page_name text,
    facebook_page_access_token text,
    tiktok_user_id text,
    tiktok_username text,
    tiktok_access_token text,
    tiktok_refresh_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    facebook_user_id text,
    instagram_token_expires_at timestamp with time zone,
    facebook_token_expires_at timestamp with time zone,
    tiktok_token_expires_at timestamp with time zone,
    tiktok_refresh_token_expires_at timestamp with time zone
);


ALTER TABLE public.social_connections OWNER TO postgres;

--
-- Name: COLUMN social_connections.instagram_token_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.social_connections.instagram_token_expires_at IS 'När instagram_access_token slutar gälla. IG long-lived = 60 dagar. NULL = okänd/ingen utgång.';


--
-- Name: COLUMN social_connections.facebook_token_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.social_connections.facebook_token_expires_at IS 'När facebook_page_access_token slutar gälla. NULL = ingen utgång (sidtoken från long-lived användartoken).';


--
-- Name: COLUMN social_connections.tiktok_token_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.social_connections.tiktok_token_expires_at IS 'När tiktok_access_token slutar gälla. TikTok access token = 24h, förnyas via tiktok_refresh_token.';


--
-- Name: COLUMN social_connections.tiktok_refresh_token_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.social_connections.tiktok_refresh_token_expires_at IS 'När tiktok_refresh_token slutar gälla (~365 dagar). Avgör om kopplingen lever; access-tokenet förnyas automatiskt.';


--
-- Name: student_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_notes (
    owner_id uuid NOT NULL,
    student_key text NOT NULL,
    note text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_notes_note_check CHECK ((char_length(note) <= 2000)),
    CONSTRAINT student_notes_student_key_check CHECK (((char_length(student_key) >= 3) AND (char_length(student_key) <= 320)))
);


ALTER TABLE public.student_notes OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    plan text NOT NULL,
    status text DEFAULT 'trialing'::text NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['publik_guld'::text, 'publik_premium'::text, 'kreator_guld'::text, 'kreator_premium'::text, 'upplevelse_guld'::text, 'upplevelse_premium'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text])))
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: taxi_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxi_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    capacity integer NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'taxi_dancer'::text NOT NULL,
    role_label text,
    pay_ore integer DEFAULT 0 NOT NULL,
    CONSTRAINT taxi_shift_min_two_hours CHECK (((ends_at - starts_at) >= '02:00:00'::interval)),
    CONSTRAINT taxi_shifts_capacity_check CHECK (((capacity >= 1) AND (capacity <= 50))),
    CONSTRAINT taxi_shifts_pay_ore_check CHECK (((pay_ore >= 0) AND (pay_ore <= 1000000))),
    CONSTRAINT taxi_shifts_role_check CHECK ((role = ANY (ARRAY['taxi_dancer'::text, 'instructor'::text, 'door_host'::text, 'cashier'::text, 'dj'::text, 'photographer'::text, 'helper'::text]))),
    CONSTRAINT taxi_shifts_role_label_check CHECK (((role_label IS NULL) OR ((char_length(role_label) >= 1) AND (char_length(role_label) <= 40))))
);


ALTER TABLE public.taxi_shifts OWNER TO postgres;

--
-- Name: taxi_signups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxi_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid NOT NULL,
    dancer_id uuid NOT NULL,
    status text DEFAULT 'booked'::text NOT NULL,
    cancelled_at timestamp with time zone,
    late_cancel boolean DEFAULT false NOT NULL,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    photo_consent boolean NOT NULL,
    volunteer_ack_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    show_photo_on_event boolean DEFAULT true NOT NULL,
    checkin_reminded_at timestamp with time zone,
    CONSTRAINT taxi_checkout_after_checkin CHECK (((checked_out_at IS NULL) OR ((checked_in_at IS NOT NULL) AND (checked_out_at >= checked_in_at)))),
    CONSTRAINT taxi_signups_status_check CHECK ((status = ANY (ARRAY['booked'::text, 'cancelled'::text])))
);


ALTER TABLE public.taxi_signups OWNER TO postgres;

--
-- Name: taxi_vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxi_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    dancer_id uuid NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
    amount_ore integer,
    CONSTRAINT taxi_vouchers_amount_ore_check CHECK (((amount_ore IS NULL) OR ((amount_ore >= 0) AND (amount_ore <= 100000))))
);


ALTER TABLE public.taxi_vouchers OWNER TO postgres;

--
-- Name: ticket_attendees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    idx integer NOT NULL,
    name text,
    checked_in_at timestamp with time zone,
    scanned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_attendees OWNER TO postgres;

--
-- Name: ticket_pools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_pools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    name text NOT NULL,
    capacity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_pools_capacity_check CHECK ((capacity > 0))
);


ALTER TABLE public.ticket_pools OWNER TO postgres;

--
-- Name: TABLE ticket_pools; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ticket_pools IS 'Kapacitet som flera biljettyper delar på, t.ex. en workshop med färre platser än lokalen. Sålda summeras ur ticket_types, potten har ingen egen räknare.';


--
-- Name: ticket_type_pools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_type_pools (
    ticket_type_id uuid NOT NULL,
    pool_id uuid NOT NULL
);


ALTER TABLE public.ticket_type_pools OWNER TO postgres;

--
-- Name: TABLE ticket_type_pools; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ticket_type_pools IS 'Vilka potter en biljettyp drar från. En kombinationsbiljett tillhör flera.';


--
-- Name: ticket_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    name text NOT NULL,
    price integer DEFAULT 0 NOT NULL,
    capacity integer,
    tickets_sold integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pool_id uuid,
    CONSTRAINT ticket_types_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT ticket_types_price_check CHECK ((price >= 0)),
    CONSTRAINT ticket_types_tickets_sold_check CHECK ((tickets_sold >= 0))
);


ALTER TABLE public.ticket_types OWNER TO postgres;

--
-- Name: tips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    tipper_email text,
    amount_ore integer NOT NULL,
    message text,
    stripe_session_id text,
    status text DEFAULT 'paid'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tips_amount_ore_check CHECK ((amount_ore > 0))
);


ALTER TABLE public.tips OWNER TO postgres;

--
-- Name: token_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_ledger (
    id bigint NOT NULL,
    profile_id uuid NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.token_ledger OWNER TO postgres;

--
-- Name: token_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.token_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.token_ledger_id_seq OWNER TO postgres;

--
-- Name: token_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.token_ledger_id_seq OWNED BY public.token_ledger.id;


--
-- Name: training_buddy_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_buddy_profiles (
    profile_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    dance_styles text[] DEFAULT '{}'::text[] NOT NULL,
    style_levels jsonb DEFAULT '{}'::jsonb NOT NULL,
    buddy_role text DEFAULT 'both'::text NOT NULL,
    availability jsonb DEFAULT '{}'::jsonb NOT NULL,
    city text,
    lat double precision,
    lon double precision,
    radius_km integer DEFAULT 25 NOT NULL,
    bio text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agreed_adult boolean DEFAULT false NOT NULL,
    CONSTRAINT training_buddy_profiles_bio_check CHECK (((bio IS NULL) OR (char_length(bio) <= 500))),
    CONSTRAINT training_buddy_profiles_buddy_role_check CHECK ((buddy_role = ANY (ARRAY['leader'::text, 'follower'::text, 'both'::text]))),
    CONSTRAINT training_buddy_profiles_radius_km_check CHECK (((radius_km >= 1) AND (radius_km <= 500)))
);


ALTER TABLE public.training_buddy_profiles OWNER TO postgres;

--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_blocks OWNER TO postgres;

--
-- Name: user_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_points (
    user_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    current_level integer DEFAULT 1 NOT NULL,
    points_this_week integer DEFAULT 0 NOT NULL,
    points_this_month integer DEFAULT 0 NOT NULL,
    week_start date DEFAULT (date_trunc('week'::text, now()))::date NOT NULL,
    month_start date DEFAULT (date_trunc('month'::text, now()))::date NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_points OWNER TO postgres;

--
-- Name: user_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_id uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text, 'actioned'::text])))
);


ALTER TABLE public.user_reports OWNER TO postgres;

--
-- Name: user_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reward_id uuid NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_rewards OWNER TO postgres;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    notif_booking_new boolean DEFAULT true NOT NULL,
    notif_booking_confirmed boolean DEFAULT true NOT NULL,
    notif_booking_canceled boolean DEFAULT true NOT NULL,
    notif_payout boolean DEFAULT true NOT NULL,
    notif_marketing boolean DEFAULT false NOT NULL,
    privacy_public_profile boolean DEFAULT true NOT NULL,
    privacy_show_location boolean DEFAULT true NOT NULL,
    privacy_show_reviews boolean DEFAULT true NOT NULL,
    privacy_booking_history boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notif_creator_events boolean DEFAULT true NOT NULL
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- Name: TABLE user_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_settings IS 'User notification and privacy preferences';


--
-- Name: venue_marketing_consents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venue_marketing_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venue_profile_id uuid NOT NULL,
    profile_id uuid,
    email text,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    withdrawn_at timestamp with time zone,
    consent_text text NOT NULL,
    locale text DEFAULT 'sv'::text NOT NULL,
    source_listing_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject text GENERATED ALWAYS AS (COALESCE((profile_id)::text, lower(email))) STORED,
    CONSTRAINT venue_consent_identity CHECK ((((profile_id IS NOT NULL) AND (email IS NULL)) OR ((profile_id IS NULL) AND (email IS NOT NULL))))
);


ALTER TABLE public.venue_marketing_consents OWNER TO postgres;

--
-- Name: TABLE venue_marketing_consents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.venue_marketing_consents IS 'Samtycke att ta emot information från en lokal. Lokalen får aldrig uppgifterna utlämnade — utskick sker genom plattformen.';


--
-- Name: venue_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venue_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venue_profile_id uuid NOT NULL,
    user_id uuid,
    invited_email text,
    capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    token text,
    invited_by uuid NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    removed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject text GENERATED ALWAYS AS (COALESCE((user_id)::text, lower(invited_email))) STORED,
    CONSTRAINT venue_member_capabilities CHECK ((capabilities <@ ARRAY['events'::text, 'bookings'::text, 'scan'::text, 'messages'::text, 'stats'::text, 'page'::text])),
    CONSTRAINT venue_member_identity CHECK (((user_id IS NOT NULL) OR (invited_email IS NOT NULL))),
    CONSTRAINT venue_member_not_owner CHECK (((user_id IS NULL) OR (user_id <> venue_profile_id)))
);


ALTER TABLE public.venue_members OWNER TO postgres;

--
-- Name: TABLE venue_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.venue_members IS 'Personer som tillhör en lokal. Ägaren är IMPLICIT (= lokalens eget konto) och har ingen rad här.';


--
-- Name: venue_revenue_share_defaults; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venue_revenue_share_defaults (
    venue_profile_id uuid NOT NULL,
    partner_percent integer NOT NULL,
    vat_rate numeric NOT NULL,
    payout_delay_days integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    statement_emails text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT venue_revenue_share_defaults_partner_percent_check CHECK (((partner_percent >= 0) AND (partner_percent <= 100))),
    CONSTRAINT venue_revenue_share_defaults_payout_delay_days_check CHECK (((payout_delay_days >= 0) AND (payout_delay_days <= 30))),
    CONSTRAINT venue_revenue_share_defaults_vat_rate_check CHECK (((vat_rate >= (0)::numeric) AND (vat_rate < (1)::numeric)))
);


ALTER TABLE public.venue_revenue_share_defaults OWNER TO postgres;

--
-- Name: TABLE venue_revenue_share_defaults; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.venue_revenue_share_defaults IS 'Standardavtal per lokal. Nya kvällar på lokalen ärver detta till event_revenue_shares.';


--
-- Name: COLUMN venue_revenue_share_defaults.statement_emails; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.venue_revenue_share_defaults.statement_emails IS 'Mottagare av månadsavräkningen hos partnern. Tom = bara Ushas ekonomilista får den.';


--
-- Name: venues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    place_id text,
    lat double precision,
    lng double precision,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.venues OWNER TO postgres;

--
-- Name: volunteer_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.volunteer_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_key text NOT NULL,
    role text NOT NULL,
    volunteer_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text,
    decided_by uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT volunteer_approvals_message_check CHECK (((message IS NULL) OR (char_length(message) <= 500))),
    CONSTRAINT volunteer_approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


ALTER TABLE public.volunteer_approvals OWNER TO postgres;

--
-- Name: volunteer_voucher_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.volunteer_voucher_settings (
    scope_id uuid NOT NULL,
    code text NOT NULL,
    max_ore integer DEFAULT 10000 NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT volunteer_voucher_settings_code_check CHECK ((code ~ '^[0-9]{4,6}$'::text)),
    CONSTRAINT volunteer_voucher_settings_max_ore_check CHECK (((max_ore >= 100) AND (max_ore <= 100000)))
);


ALTER TABLE public.volunteer_voucher_settings OWNER TO postgres;

--
-- Name: archived_deleted_rows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archived_deleted_rows ALTER COLUMN id SET DEFAULT nextval('public.archived_deleted_rows_id_seq'::regclass);


--
-- Name: token_ledger id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_ledger ALTER COLUMN id SET DEFAULT nextval('public.token_ledger_id_seq'::regclass);


--
-- Name: account_credits account_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_credits
    ADD CONSTRAINT account_credits_pkey PRIMARY KEY (user_id);


--
-- Name: admin_capabilities admin_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_capabilities
    ADD CONSTRAINT admin_capabilities_pkey PRIMARY KEY (user_id, capability);


--
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- Name: affiliate_payouts affiliate_payouts_profile_id_period_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_profile_id_period_key UNIQUE (profile_id, period);


--
-- Name: affiliate_payouts affiliate_payouts_stripe_transfer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_stripe_transfer_id_key UNIQUE (stripe_transfer_id);


--
-- Name: affiliate_rewards affiliate_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_rewards
    ADD CONSTRAINT affiliate_rewards_pkey PRIMARY KEY (id);


--
-- Name: affiliate_rewards affiliate_rewards_ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_rewards
    ADD CONSTRAINT affiliate_rewards_ref_key UNIQUE (ref);


--
-- Name: agreement_events agreement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreement_events
    ADD CONSTRAINT agreement_events_pkey PRIMARY KEY (id);


--
-- Name: agreements agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: archived_deleted_rows archived_deleted_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archived_deleted_rows
    ADD CONSTRAINT archived_deleted_rows_pkey PRIMARY KEY (id);


--
-- Name: bastu_interest bastu_interest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bastu_interest
    ADD CONSTRAINT bastu_interest_pkey PRIMARY KEY (id);


--
-- Name: booking_queue booking_queue_listing_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_queue
    ADD CONSTRAINT booking_queue_listing_id_user_id_key UNIQUE (listing_id, user_id);


--
-- Name: booking_queue booking_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_queue
    ADD CONSTRAINT booking_queue_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: buddy_likes buddy_likes_from_user_to_user_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_likes
    ADD CONSTRAINT buddy_likes_from_user_to_user_key UNIQUE (from_user, to_user);


--
-- Name: buddy_likes buddy_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_likes
    ADD CONSTRAINT buddy_likes_pkey PRIMARY KEY (id);


--
-- Name: buddy_matches buddy_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_matches
    ADD CONSTRAINT buddy_matches_pkey PRIMARY KEY (id);


--
-- Name: buddy_matches buddy_matches_user_a_user_b_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_matches
    ADD CONSTRAINT buddy_matches_user_a_user_b_key UNIQUE (user_a, user_b);


--
-- Name: calendar_import_hidden calendar_import_hidden_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_import_hidden
    ADD CONSTRAINT calendar_import_hidden_pkey PRIMARY KEY (user_id, external_uid);


--
-- Name: capability_unlocks capability_unlocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_unlocks
    ADD CONSTRAINT capability_unlocks_pkey PRIMARY KEY (id);


--
-- Name: collaborator_invites collaborator_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_invites
    ADD CONSTRAINT collaborator_invites_pkey PRIMARY KEY (id);


--
-- Name: collaborator_invites collaborator_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_invites
    ADD CONSTRAINT collaborator_invites_token_key UNIQUE (token);


--
-- Name: collaborator_payment_requests collaborator_payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_payment_requests
    ADD CONSTRAINT collaborator_payment_requests_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_participant_a_participant_b_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_participant_a_participant_b_key UNIQUE (participant_a, participant_b);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: creator_availability creator_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_availability
    ADD CONSTRAINT creator_availability_pkey PRIMARY KEY (id);


--
-- Name: creator_commitments creator_commitments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_commitments
    ADD CONSTRAINT creator_commitments_pkey PRIMARY KEY (id);


--
-- Name: creator_commitments creator_commitments_user_external_uid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_commitments
    ADD CONSTRAINT creator_commitments_user_external_uid_key UNIQUE (user_id, external_uid);


--
-- Name: creator_debts creator_debts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_debts
    ADD CONSTRAINT creator_debts_pkey PRIMARY KEY (id);


--
-- Name: creator_earnings creator_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_pkey PRIMARY KEY (id);


--
-- Name: creator_media creator_media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_media
    ADD CONSTRAINT creator_media_pkey PRIMARY KEY (id);


--
-- Name: creator_memberships creator_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_memberships
    ADD CONSTRAINT creator_memberships_pkey PRIMARY KEY (id);


--
-- Name: creator_promo_codes creator_promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_promo_codes
    ADD CONSTRAINT creator_promo_codes_code_key UNIQUE (code);


--
-- Name: creator_promo_codes creator_promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_promo_codes
    ADD CONSTRAINT creator_promo_codes_pkey PRIMARY KEY (id);


--
-- Name: credit_ledger credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: credit_ledger credit_ledger_ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_ref_key UNIQUE (ref);


--
-- Name: csp_reports csp_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.csp_reports
    ADD CONSTRAINT csp_reports_pkey PRIMARY KEY (id);


--
-- Name: data_deletion_requests data_deletion_requests_confirmation_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_confirmation_code_key UNIQUE (confirmation_code);


--
-- Name: data_deletion_requests data_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: digital_product_content digital_product_content_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_product_content
    ADD CONSTRAINT digital_product_content_pkey PRIMARY KEY (product_id);


--
-- Name: digital_products digital_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_products
    ADD CONSTRAINT digital_products_pkey PRIMARY KEY (id);


--
-- Name: digital_purchases digital_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_pkey PRIMARY KEY (id);


--
-- Name: digital_purchases digital_purchases_product_id_buyer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_product_id_buyer_id_key UNIQUE (product_id, buyer_id);


--
-- Name: dj_wish_votes dj_wish_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dj_wish_votes
    ADD CONSTRAINT dj_wish_votes_pkey PRIMARY KEY (wish_id, voter_id);


--
-- Name: dj_wishes dj_wishes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dj_wishes
    ADD CONSTRAINT dj_wishes_pkey PRIMARY KEY (id);


--
-- Name: email_broadcasts email_broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_broadcasts
    ADD CONSTRAINT email_broadcasts_pkey PRIMARY KEY (id);


--
-- Name: email_follows email_follows_email_followed_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_follows
    ADD CONSTRAINT email_follows_email_followed_id_key UNIQUE (email, followed_id);


--
-- Name: email_follows email_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_follows
    ADD CONSTRAINT email_follows_pkey PRIMARY KEY (id);


--
-- Name: event_access_codes event_access_codes_listing_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_access_codes
    ADD CONSTRAINT event_access_codes_listing_code_key UNIQUE (listing_id, code);


--
-- Name: event_access_codes event_access_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_access_codes
    ADD CONSTRAINT event_access_codes_pkey PRIMARY KEY (id);


--
-- Name: event_instructors event_instructors_listing_id_instructor_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_instructors
    ADD CONSTRAINT event_instructors_listing_id_instructor_id_key UNIQUE (listing_id, instructor_id);


--
-- Name: event_instructors event_instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_instructors
    ADD CONSTRAINT event_instructors_pkey PRIMARY KEY (id);


--
-- Name: event_revenue_shares event_revenue_shares_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_revenue_shares
    ADD CONSTRAINT event_revenue_shares_listing_id_key UNIQUE (listing_id);


--
-- Name: event_revenue_shares event_revenue_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_revenue_shares
    ADD CONSTRAINT event_revenue_shares_pkey PRIMARY KEY (id);


--
-- Name: event_settlement_payouts event_settlement_payouts_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_payouts
    ADD CONSTRAINT event_settlement_payouts_listing_id_key UNIQUE (listing_id);


--
-- Name: event_settlement_payouts event_settlement_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_payouts
    ADD CONSTRAINT event_settlement_payouts_pkey PRIMARY KEY (id);


--
-- Name: event_settlement_payouts event_settlement_payouts_stripe_transfer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_payouts
    ADD CONSTRAINT event_settlement_payouts_stripe_transfer_id_key UNIQUE (stripe_transfer_id);


--
-- Name: event_settlement_supplements event_settlement_supplements_listing_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_supplements
    ADD CONSTRAINT event_settlement_supplements_listing_id_seq_key UNIQUE (listing_id, seq);


--
-- Name: event_settlement_supplements event_settlement_supplements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_supplements
    ADD CONSTRAINT event_settlement_supplements_pkey PRIMARY KEY (id);


--
-- Name: event_waitlist event_waitlist_listing_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_waitlist
    ADD CONSTRAINT event_waitlist_listing_email_key UNIQUE (listing_id, email);


--
-- Name: event_waitlist event_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_waitlist
    ADD CONSTRAINT event_waitlist_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_listing_id_key UNIQUE (user_id, listing_id);


--
-- Name: follows follows_follower_id_followed_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_followed_id_key UNIQUE (follower_id, followed_id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: gage_agreements gage_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gage_agreements
    ADD CONSTRAINT gage_agreements_pkey PRIMARY KEY (id);


--
-- Name: gig_applications gig_applications_gig_id_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gig_applications
    ADD CONSTRAINT gig_applications_gig_id_applicant_id_key UNIQUE (gig_id, applicant_id);


--
-- Name: gig_applications gig_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gig_applications
    ADD CONSTRAINT gig_applications_pkey PRIMARY KEY (id);


--
-- Name: gigs gigs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_pkey PRIMARY KEY (id);


--
-- Name: listen_documents listen_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listen_documents
    ADD CONSTRAINT listen_documents_pkey PRIMARY KEY (id);


--
-- Name: listing_collaborators listing_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_collaborators
    ADD CONSTRAINT listing_collaborators_pkey PRIMARY KEY (id);


--
-- Name: listing_collaborators listing_collaborators_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_collaborators
    ADD CONSTRAINT listing_collaborators_unique UNIQUE (listing_id, user_id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: membership_entries membership_entries_membership_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_entries
    ADD CONSTRAINT membership_entries_membership_id_listing_id_key UNIQUE (membership_id, listing_id);


--
-- Name: membership_entries membership_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_entries
    ADD CONSTRAINT membership_entries_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_creator_membership_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_creator_membership_id_member_id_key UNIQUE (creator_membership_id, member_id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: ob_bookings ob_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_bookings
    ADD CONSTRAINT ob_bookings_pkey PRIMARY KEY (id);


--
-- Name: ob_creator_profiles ob_creator_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_creator_profiles
    ADD CONSTRAINT ob_creator_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: ob_dac7_records ob_dac7_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_dac7_records
    ADD CONSTRAINT ob_dac7_records_pkey PRIMARY KEY (id);


--
-- Name: ob_dac7_records ob_dac7_records_seller_id_quarter_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_dac7_records
    ADD CONSTRAINT ob_dac7_records_seller_id_quarter_year_key UNIQUE (seller_id, quarter, year);


--
-- Name: ob_payouts ob_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_payouts
    ADD CONSTRAINT ob_payouts_pkey PRIMARY KEY (id);


--
-- Name: ob_track_changes ob_track_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_track_changes
    ADD CONSTRAINT ob_track_changes_pkey PRIMARY KEY (id);


--
-- Name: ob_users ob_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_users
    ADD CONSTRAINT ob_users_pkey PRIMARY KEY (id);


--
-- Name: ob_venue_profiles ob_venue_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_venue_profiles
    ADD CONSTRAINT ob_venue_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: openclaw_tasks openclaw_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.openclaw_tasks
    ADD CONSTRAINT openclaw_tasks_pkey PRIMARY KEY (id);


--
-- Name: pass_redemptions pass_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pass_redemptions
    ADD CONSTRAINT pass_redemptions_pkey PRIMARY KEY (id);


--
-- Name: payee_f_tax_checks payee_f_tax_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payee_f_tax_checks
    ADD CONSTRAINT payee_f_tax_checks_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_stripe_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_stripe_payment_id_key UNIQUE (stripe_payment_id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: payroll_shadow_lines payroll_shadow_lines_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_shadow_lines
    ADD CONSTRAINT payroll_shadow_lines_booking_id_key UNIQUE (booking_id);


--
-- Name: payroll_shadow_lines payroll_shadow_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_shadow_lines
    ADD CONSTRAINT payroll_shadow_lines_pkey PRIMARY KEY (id);


--
-- Name: payroll_shadow_lines payroll_shadow_lines_shift_signup_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_shadow_lines
    ADD CONSTRAINT payroll_shadow_lines_shift_signup_id_key UNIQUE (shift_signup_id);


--
-- Name: point_events point_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_post_id_key UNIQUE (user_id, post_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: premium_grants premium_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premium_grants
    ADD CONSTRAINT premium_grants_pkey PRIMARY KEY (id);


--
-- Name: premium_grants premium_grants_ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premium_grants
    ADD CONSTRAINT premium_grants_ref_key UNIQUE (ref);


--
-- Name: profile_preferences profile_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_preferences
    ADD CONSTRAINT profile_preferences_pkey PRIMARY KEY (profile_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promo_code_uses promo_code_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);


--
-- Name: promo_code_uses promo_code_uses_promo_code_id_user_id_reference_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_promo_code_id_user_id_reference_id_key UNIQUE (promo_code_id, user_id, reference_id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: referral_clicks referral_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_clicks
    ADD CONSTRAINT referral_clicks_pkey PRIMARY KEY (code, day);


--
-- Name: reviews reviews_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_key UNIQUE (booking_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: rewards rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_pkey PRIMARY KEY (id);


--
-- Name: rewards rewards_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_slug_key UNIQUE (slug);


--
-- Name: series_access_codes series_access_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.series_access_codes
    ADD CONSTRAINT series_access_codes_pkey PRIMARY KEY (id);


--
-- Name: series_access_codes series_access_codes_series_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.series_access_codes
    ADD CONSTRAINT series_access_codes_series_slug_code_key UNIQUE (series_slug, code);


--
-- Name: series_collaborators series_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.series_collaborators
    ADD CONSTRAINT series_collaborators_pkey PRIMARY KEY (id);


--
-- Name: series_collaborators series_collaborators_series_slug_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.series_collaborators
    ADD CONSTRAINT series_collaborators_series_slug_user_id_key UNIQUE (series_slug, user_id);


--
-- Name: settlement_statements settlement_statements_partner_profile_id_period_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settlement_statements
    ADD CONSTRAINT settlement_statements_partner_profile_id_period_key UNIQUE (partner_profile_id, period);


--
-- Name: settlement_statements settlement_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settlement_statements
    ADD CONSTRAINT settlement_statements_pkey PRIMARY KEY (id);


--
-- Name: shop_processed_stripe_events shop_processed_stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shop_processed_stripe_events
    ADD CONSTRAINT shop_processed_stripe_events_pkey PRIMARY KEY (event_id);


--
-- Name: social_connections social_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_connections
    ADD CONSTRAINT social_connections_pkey PRIMARY KEY (id);


--
-- Name: social_connections social_connections_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_connections
    ADD CONSTRAINT social_connections_user_id_key UNIQUE (user_id);


--
-- Name: student_notes student_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_pkey PRIMARY KEY (owner_id, student_key);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: taxi_shifts taxi_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_shifts
    ADD CONSTRAINT taxi_shifts_pkey PRIMARY KEY (id);


--
-- Name: taxi_signups taxi_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_signups
    ADD CONSTRAINT taxi_signups_pkey PRIMARY KEY (id);


--
-- Name: taxi_signups taxi_signups_shift_id_dancer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_signups
    ADD CONSTRAINT taxi_signups_shift_id_dancer_id_key UNIQUE (shift_id, dancer_id);


--
-- Name: taxi_vouchers taxi_vouchers_listing_id_dancer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_vouchers
    ADD CONSTRAINT taxi_vouchers_listing_id_dancer_id_key UNIQUE (listing_id, dancer_id);


--
-- Name: taxi_vouchers taxi_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_vouchers
    ADD CONSTRAINT taxi_vouchers_pkey PRIMARY KEY (id);


--
-- Name: ticket_attendees ticket_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_attendees
    ADD CONSTRAINT ticket_attendees_pkey PRIMARY KEY (id);


--
-- Name: ticket_pools ticket_pools_listing_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pools
    ADD CONSTRAINT ticket_pools_listing_id_name_key UNIQUE (listing_id, name);


--
-- Name: ticket_pools ticket_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pools
    ADD CONSTRAINT ticket_pools_pkey PRIMARY KEY (id);


--
-- Name: ticket_type_pools ticket_type_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_type_pools
    ADD CONSTRAINT ticket_type_pools_pkey PRIMARY KEY (ticket_type_id, pool_id);


--
-- Name: ticket_types ticket_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_pkey PRIMARY KEY (id);


--
-- Name: tips tips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_pkey PRIMARY KEY (id);


--
-- Name: tips tips_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: token_ledger token_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_ledger
    ADD CONSTRAINT token_ledger_pkey PRIMARY KEY (id);


--
-- Name: training_buddy_profiles training_buddy_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_buddy_profiles
    ADD CONSTRAINT training_buddy_profiles_pkey PRIMARY KEY (profile_id);


--
-- Name: user_blocks user_blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (user_id);


--
-- Name: user_reports user_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_pkey PRIMARY KEY (id);


--
-- Name: user_rewards user_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_pkey PRIMARY KEY (id);


--
-- Name: user_rewards user_rewards_user_id_reward_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_user_id_reward_id_key UNIQUE (user_id, reward_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: venue_marketing_consents venue_marketing_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_marketing_consents
    ADD CONSTRAINT venue_marketing_consents_pkey PRIMARY KEY (id);


--
-- Name: venue_members venue_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_members
    ADD CONSTRAINT venue_members_pkey PRIMARY KEY (id);


--
-- Name: venue_members venue_members_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_members
    ADD CONSTRAINT venue_members_token_key UNIQUE (token);


--
-- Name: venue_revenue_share_defaults venue_revenue_share_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_revenue_share_defaults
    ADD CONSTRAINT venue_revenue_share_defaults_pkey PRIMARY KEY (venue_profile_id);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: venues venues_place_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_place_id_key UNIQUE (place_id);


--
-- Name: volunteer_approvals volunteer_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_approvals
    ADD CONSTRAINT volunteer_approvals_pkey PRIMARY KEY (id);


--
-- Name: volunteer_approvals volunteer_approvals_scope_key_role_volunteer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_approvals
    ADD CONSTRAINT volunteer_approvals_scope_key_role_volunteer_id_key UNIQUE (scope_key, role, volunteer_id);


--
-- Name: volunteer_voucher_settings volunteer_voucher_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_voucher_settings
    ADD CONSTRAINT volunteer_voucher_settings_pkey PRIMARY KEY (scope_id);


--
-- Name: affiliate_rewards_booking_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX affiliate_rewards_booking_idx ON public.affiliate_rewards USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: affiliate_rewards_profile_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX affiliate_rewards_profile_idx ON public.affiliate_rewards USING btree (profile_id, status);


--
-- Name: agreement_events_agreement_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agreement_events_agreement_idx ON public.agreement_events USING btree (agreement_id, created_at);


--
-- Name: agreements_counterparty_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agreements_counterparty_idx ON public.agreements USING btree (counterparty_id, created_at DESC);


--
-- Name: agreements_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agreements_created_by_idx ON public.agreements USING btree (created_by, created_at DESC);


--
-- Name: agreements_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agreements_listing_idx ON public.agreements USING btree (listing_id);


--
-- Name: bastu_interest_site_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bastu_interest_site_email_idx ON public.bastu_interest USING btree (site_slug, lower(email));


--
-- Name: bastu_interest_site_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bastu_interest_site_idx ON public.bastu_interest USING btree (site_slug);


--
-- Name: bookings_epassi_pending_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_epassi_pending_idx ON public.bookings USING btree (creator_id, created_at DESC) WHERE (payment_method = 'epassi'::text);


--
-- Name: bookings_free_ticket_customer_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bookings_free_ticket_customer_key ON public.bookings USING btree (listing_id, customer_id) WHERE ((booking_type = 'ticket'::text) AND (amount_paid = 0) AND (customer_id IS NOT NULL) AND (status <> 'canceled'::text));


--
-- Name: bookings_referred_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_referred_by_idx ON public.bookings USING btree (referred_by) WHERE (referred_by IS NOT NULL);


--
-- Name: bookings_stripe_payment_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bookings_stripe_payment_id_key ON public.bookings USING btree (stripe_payment_id) WHERE (stripe_payment_id IS NOT NULL);


--
-- Name: bookings_swish_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_swish_idx ON public.bookings USING btree (listing_id, created_at DESC) WHERE (payment_method = 'swish'::text);


--
-- Name: bookings_utm_campaign_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_utm_campaign_idx ON public.bookings USING btree (utm_campaign, created_at DESC) WHERE (utm_campaign IS NOT NULL);


--
-- Name: capability_unlocks_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX capability_unlocks_listing_idx ON public.capability_unlocks USING btree (listing_id);


--
-- Name: capability_unlocks_profile_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX capability_unlocks_profile_idx ON public.capability_unlocks USING btree (profile_id);


--
-- Name: capability_unlocks_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX capability_unlocks_uniq ON public.capability_unlocks USING btree (profile_id, capability, listing_id) NULLS NOT DISTINCT;


--
-- Name: collaborator_invites_invited_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collaborator_invites_invited_user_id_idx ON public.collaborator_invites USING btree (invited_user_id) WHERE (invited_user_id IS NOT NULL);


--
-- Name: creator_debts_partner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX creator_debts_partner_idx ON public.creator_debts USING btree (partner_profile_id, created_at DESC);


--
-- Name: creator_debts_refund_once_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX creator_debts_refund_once_idx ON public.creator_debts USING btree (booking_id) WHERE (reason = 'refund_after_payout'::text);


--
-- Name: creator_earnings_creator_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX creator_earnings_creator_idx ON public.creator_earnings USING btree (creator_id, created_at DESC);


--
-- Name: creator_earnings_once_per_night_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX creator_earnings_once_per_night_idx ON public.creator_earnings USING btree (creator_id, listing_id) WHERE (listing_id IS NOT NULL);


--
-- Name: creator_memberships_creator_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX creator_memberships_creator_idx ON public.creator_memberships USING btree (creator_id) WHERE is_active;


--
-- Name: credit_ledger_profile_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX credit_ledger_profile_idx ON public.credit_ledger USING btree (profile_id);


--
-- Name: csp_reports_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX csp_reports_created_at_idx ON public.csp_reports USING btree (created_at DESC);


--
-- Name: csp_reports_directive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX csp_reports_directive_idx ON public.csp_reports USING btree (effective_directive);


--
-- Name: dj_wishes_scope_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX dj_wishes_scope_name ON public.dj_wishes USING btree (scope_key, lower(name));


--
-- Name: email_broadcasts_creator_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_broadcasts_creator_idx ON public.email_broadcasts USING btree (creator_id, created_at DESC);


--
-- Name: email_broadcasts_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_broadcasts_listing_idx ON public.email_broadcasts USING btree (listing_id, created_at DESC);


--
-- Name: email_follows_confirm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_follows_confirm_idx ON public.email_follows USING btree (confirm_token);


--
-- Name: email_follows_followed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_follows_followed_idx ON public.email_follows USING btree (followed_id) WHERE ((confirmed_at IS NOT NULL) AND (unsubscribed_at IS NULL));


--
-- Name: email_follows_unsub_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_follows_unsub_idx ON public.email_follows USING btree (unsubscribe_token);


--
-- Name: event_access_codes_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_access_codes_listing_idx ON public.event_access_codes USING btree (listing_id);


--
-- Name: event_revenue_shares_partner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_revenue_shares_partner_idx ON public.event_revenue_shares USING btree (partner_profile_id);


--
-- Name: event_settlement_payouts_destination_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_settlement_payouts_destination_idx ON public.event_settlement_payouts USING btree (destination_account_id) WHERE (destination_account_id IS NOT NULL);


--
-- Name: event_settlement_payouts_partner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_settlement_payouts_partner_idx ON public.event_settlement_payouts USING btree (partner_profile_id);


--
-- Name: event_settlement_payouts_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_settlement_payouts_status_idx ON public.event_settlement_payouts USING btree (status);


--
-- Name: event_settlement_supplements_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_settlement_supplements_listing_idx ON public.event_settlement_supplements USING btree (listing_id);


--
-- Name: event_settlement_supplements_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_settlement_supplements_status_idx ON public.event_settlement_supplements USING btree (status);


--
-- Name: event_waitlist_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_waitlist_listing_idx ON public.event_waitlist USING btree (listing_id);


--
-- Name: event_waitlist_release_pending_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_waitlist_release_pending_idx ON public.event_waitlist USING btree (listing_id) WHERE ((released_notified_at IS NULL) AND (unsubscribed_at IS NULL));


--
-- Name: gage_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX gage_active_unique ON public.gage_agreements USING btree (listing_id, collaborator_user_id) WHERE (status = ANY (ARRAY['proposed'::text, 'agreed'::text]));


--
-- Name: gage_collaborator_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gage_collaborator_idx ON public.gage_agreements USING btree (collaborator_user_id);


--
-- Name: gage_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gage_listing_idx ON public.gage_agreements USING btree (listing_id);


--
-- Name: gigs_listing_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gigs_listing_id_idx ON public.gigs USING btree (listing_id);


--
-- Name: idx_admin_capabilities_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_capabilities_user ON public.admin_capabilities USING btree (user_id);


--
-- Name: idx_booking_queue_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_queue_listing ON public.booking_queue USING btree (listing_id, "position");


--
-- Name: idx_bookings_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_creator ON public.bookings USING btree (creator_id, created_at DESC);


--
-- Name: idx_bookings_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_customer ON public.bookings USING btree (customer_id, scheduled_at);


--
-- Name: idx_bookings_reminder_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_reminder_pending ON public.bookings USING btree (scheduled_at) WHERE ((reminder_sent_at IS NULL) AND (status = 'confirmed'::text));


--
-- Name: idx_bookings_reminder_soon_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_reminder_soon_pending ON public.bookings USING btree (scheduled_at) WHERE ((reminder_soon_sent_at IS NULL) AND (status = 'confirmed'::text));


--
-- Name: idx_bookings_stripe_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_stripe_payment ON public.bookings USING btree (stripe_payment_id) WHERE (stripe_payment_id IS NOT NULL);


--
-- Name: idx_buddy_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buddy_active ON public.training_buddy_profiles USING btree (is_active) WHERE is_active;


--
-- Name: idx_buddy_likes_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buddy_likes_from ON public.buddy_likes USING btree (from_user);


--
-- Name: idx_buddy_likes_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buddy_likes_to ON public.buddy_likes USING btree (to_user);


--
-- Name: idx_buddy_matches_a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buddy_matches_a ON public.buddy_matches USING btree (user_a);


--
-- Name: idx_buddy_matches_b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buddy_matches_b ON public.buddy_matches USING btree (user_b);


--
-- Name: idx_collaborator_invites_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collaborator_invites_listing ON public.collaborator_invites USING btree (listing_id);


--
-- Name: idx_collaborator_invites_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collaborator_invites_token ON public.collaborator_invites USING btree (token);


--
-- Name: idx_conversations_participant_a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_participant_a ON public.conversations USING btree (participant_a, last_message_at DESC);


--
-- Name: idx_conversations_participant_b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_participant_b ON public.conversations USING btree (participant_b, last_message_at DESC);


--
-- Name: idx_creator_availability_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_creator_availability_user_date ON public.creator_availability USING btree (user_id, available_date);


--
-- Name: idx_creator_commitments_user_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_creator_commitments_user_start ON public.creator_commitments USING btree (user_id, start_date);


--
-- Name: idx_creator_media_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_creator_media_user ON public.creator_media USING btree (user_id, sort_order);


--
-- Name: idx_creator_promo_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_creator_promo_code ON public.creator_promo_codes USING btree (code);


--
-- Name: idx_creator_promo_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_creator_promo_creator ON public.creator_promo_codes USING btree (creator_id);


--
-- Name: idx_data_deletion_requests_external_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_data_deletion_requests_external_user ON public.data_deletion_requests USING btree (provider, external_user_id);


--
-- Name: idx_digital_products_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_digital_products_creator ON public.digital_products USING btree (creator_id);


--
-- Name: idx_event_instructors_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_event_instructors_listing ON public.event_instructors USING btree (listing_id);


--
-- Name: idx_favorites_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_listing ON public.favorites USING btree (listing_id);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);


--
-- Name: idx_follows_followed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_follows_followed ON public.follows USING btree (followed_id);


--
-- Name: idx_follows_follower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_follows_follower ON public.follows USING btree (follower_id);


--
-- Name: idx_gig_applications_applicant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gig_applications_applicant ON public.gig_applications USING btree (applicant_id);


--
-- Name: idx_gig_applications_gig; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gig_applications_gig ON public.gig_applications USING btree (gig_id);


--
-- Name: idx_gigs_arranger; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gigs_arranger ON public.gigs USING btree (arranger_id);


--
-- Name: idx_gigs_status_event_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gigs_status_event_date ON public.gigs USING btree (status, event_date) WHERE (status = 'open'::text);


--
-- Name: idx_listen_documents_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listen_documents_user ON public.listen_documents USING btree (user_id, updated_at DESC);


--
-- Name: idx_listing_collaborators_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_collaborators_listing ON public.listing_collaborators USING btree (listing_id);


--
-- Name: idx_listing_collaborators_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_collaborators_user_status ON public.listing_collaborators USING btree (user_id, status);


--
-- Name: idx_listings_followers_notify_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_followers_notify_pending ON public.listings USING btree (created_at) WHERE ((followers_notified_at IS NULL) AND (is_active = true) AND (listing_type = 'event'::text));


--
-- Name: idx_listings_listing_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_listing_type ON public.listings USING btree (listing_type);


--
-- Name: idx_listings_promoted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_promoted ON public.listings USING btree (is_promoted, promoted_until);


--
-- Name: idx_listings_public; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_public ON public.listings USING btree (is_active, is_public) WHERE (is_active AND is_public);


--
-- Name: idx_listings_series_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_series_id ON public.listings USING btree (series_id) WHERE (series_id IS NOT NULL);


--
-- Name: idx_listings_series_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_series_slug ON public.listings USING btree (series_slug) WHERE (series_slug IS NOT NULL);


--
-- Name: idx_listings_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_listings_slug ON public.listings USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_listings_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_user ON public.listings USING btree (user_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (conversation_id, is_read) WHERE (NOT is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_openclaw_tasks_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_openclaw_tasks_created_at ON public.openclaw_tasks USING btree (created_at DESC);


--
-- Name: idx_openclaw_tasks_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_openclaw_tasks_priority ON public.openclaw_tasks USING btree (priority);


--
-- Name: idx_openclaw_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_openclaw_tasks_status ON public.openclaw_tasks USING btree (status);


--
-- Name: idx_payment_requests_collab_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_requests_collab_status ON public.collaborator_payment_requests USING btree (collaborator_id, status);


--
-- Name: idx_payouts_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payouts_creator ON public.payouts USING btree (creator_id, created_at DESC);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payouts_status ON public.payouts USING btree (status) WHERE ((status)::text <> 'paid'::text);


--
-- Name: idx_payroll_shadow_lines_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payroll_shadow_lines_creator ON public.payroll_shadow_lines USING btree (creator_id, paid_on);


--
-- Name: idx_payroll_shadow_lines_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payroll_shadow_lines_pending ON public.payroll_shadow_lines USING btree (creator_id) WHERE (live AND (sam_submitted_at IS NULL) AND (voided_at IS NULL));


--
-- Name: idx_point_events_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_events_source ON public.point_events USING btree (source_type, source_id);


--
-- Name: idx_point_events_unique_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_point_events_unique_source ON public.point_events USING btree (user_id, action, source_id) WHERE (source_id IS NOT NULL);


--
-- Name: idx_point_events_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_events_user ON public.point_events USING btree (user_id, created_at DESC);


--
-- Name: idx_post_likes_post_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_post_likes_post_id ON public.post_likes USING btree (post_id);


--
-- Name: idx_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);


--
-- Name: idx_profiles_bankid_personal_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_profiles_bankid_personal_number ON public.profiles USING btree (bankid_personal_number) WHERE (bankid_personal_number IS NOT NULL);


--
-- Name: idx_profiles_calendar_sync_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_calendar_sync_token ON public.profiles USING btree (calendar_sync_token) WHERE (calendar_sync_token IS NOT NULL);


--
-- Name: idx_profiles_creator_subcategory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_creator_subcategory ON public.profiles USING btree (creator_subcategory) WHERE (creator_subcategory <> 'general'::text);


--
-- Name: idx_profiles_offers_coaching; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_offers_coaching ON public.profiles USING btree (offers_coaching) WHERE (offers_coaching = true);


--
-- Name: idx_profiles_referral_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_profiles_referral_code ON public.profiles USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code) WHERE (is_active = true);


--
-- Name: idx_push_subs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_push_subs_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_reviews_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_creator ON public.reviews USING btree (creator_id);


--
-- Name: idx_reviews_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_listing ON public.reviews USING btree (listing_id);


--
-- Name: idx_reviews_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_reviewer ON public.reviews USING btree (reviewer_id);


--
-- Name: idx_social_connections_facebook_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_social_connections_facebook_user_id ON public.social_connections USING btree (facebook_user_id) WHERE (facebook_user_id IS NOT NULL);


--
-- Name: idx_taxi_shifts_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_taxi_shifts_listing ON public.taxi_shifts USING btree (listing_id, starts_at);


--
-- Name: idx_taxi_signups_dancer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_taxi_signups_dancer ON public.taxi_signups USING btree (dancer_id);


--
-- Name: idx_ticket_attendees_booking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_attendees_booking ON public.ticket_attendees USING btree (booking_id);


--
-- Name: idx_ticket_types_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_types_listing ON public.ticket_types USING btree (listing_id);


--
-- Name: idx_user_blocks_blocked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_blocks_blocked ON public.user_blocks USING btree (blocked_id);


--
-- Name: idx_user_blocks_blocker; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_blocks_blocker ON public.user_blocks USING btree (blocker_id);


--
-- Name: idx_user_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_reports_status ON public.user_reports USING btree (status);


--
-- Name: idx_venues_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_venues_city ON public.venues USING btree (city);


--
-- Name: idx_volunteer_approvals_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_volunteer_approvals_scope ON public.volunteer_approvals USING btree (scope_key, status);


--
-- Name: listings_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX listings_created_by_idx ON public.listings USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: listings_pass_series_ids_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX listings_pass_series_ids_idx ON public.listings USING gin (pass_series_ids);


--
-- Name: listings_pass_series_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX listings_pass_series_idx ON public.listings USING btree (pass_series_id) WHERE (pass_series_id IS NOT NULL);


--
-- Name: listings_user_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX listings_user_sort_idx ON public.listings USING btree (user_id, sort_order) WHERE (sort_order IS NOT NULL);


--
-- Name: listings_venue_confirmed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX listings_venue_confirmed_idx ON public.listings USING btree (venue_profile_id, venue_confirmed_at) WHERE (venue_profile_id IS NOT NULL);


--
-- Name: listings_venue_notify_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX listings_venue_notify_idx ON public.listings USING btree (venue_profile_id) WHERE ((venue_profile_id IS NOT NULL) AND (venue_followers_notified_at IS NULL));


--
-- Name: memberships_member_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX memberships_member_idx ON public.memberships USING btree (member_id);


--
-- Name: pass_redemptions_ett_skannat_klipp_per_kvall; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX pass_redemptions_ett_skannat_klipp_per_kvall ON public.pass_redemptions USING btree (booking_id, listing_id) WHERE (NOT is_manual);


--
-- Name: pass_redemptions_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pass_redemptions_listing_idx ON public.pass_redemptions USING btree (listing_id);


--
-- Name: payee_f_tax_checks_profile_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payee_f_tax_checks_profile_idx ON public.payee_f_tax_checks USING btree (profile_id, created_at DESC);


--
-- Name: premium_grants_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX premium_grants_active_idx ON public.premium_grants USING btree (ends_at) WHERE (reverted_at IS NULL);


--
-- Name: profile_preferences_city_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profile_preferences_city_idx ON public.profile_preferences USING btree (lower(city));


--
-- Name: profiles_founding_partner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_founding_partner_idx ON public.profiles USING btree (founding_partner_since) WHERE (founding_partner_since IS NOT NULL);


--
-- Name: profiles_share_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_share_token_idx ON public.profiles USING btree (share_token) WHERE (share_token IS NOT NULL);


--
-- Name: profiles_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_slug_idx ON public.profiles USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: profiles_slug_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_slug_unique ON public.profiles USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: ticket_type_pools_pool_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_type_pools_pool_idx ON public.ticket_type_pools USING btree (pool_id);


--
-- Name: ticket_types_pool_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ticket_types_pool_idx ON public.ticket_types USING btree (pool_id) WHERE (pool_id IS NOT NULL);


--
-- Name: tips_recipient_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tips_recipient_idx ON public.tips USING btree (recipient_id, created_at DESC);


--
-- Name: token_ledger_allowance_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX token_ledger_allowance_uq ON public.token_ledger USING btree (ref) WHERE (reason = 'allowance'::text);


--
-- Name: token_ledger_profile_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_ledger_profile_idx ON public.token_ledger USING btree (profile_id);


--
-- Name: token_ledger_purchase_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX token_ledger_purchase_uq ON public.token_ledger USING btree (ref) WHERE (reason = 'purchase'::text);


--
-- Name: token_ledger_ref_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_ledger_ref_idx ON public.token_ledger USING btree (ref);


--
-- Name: unique_availability_slot; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_availability_slot ON public.creator_availability USING btree (user_id, available_date, COALESCE(start_time, '00:00:00'::time without time zone));


--
-- Name: uq_payments_stripe_payment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_payments_stripe_payment_id ON public.payments USING btree (stripe_payment_id) WHERE (stripe_payment_id IS NOT NULL);


--
-- Name: venue_consent_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venue_consent_active_idx ON public.venue_marketing_consents USING btree (venue_profile_id) WHERE (withdrawn_at IS NULL);


--
-- Name: venue_consent_subject_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX venue_consent_subject_uniq ON public.venue_marketing_consents USING btree (venue_profile_id, subject);


--
-- Name: venue_members_subject_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX venue_members_subject_uniq ON public.venue_members USING btree (venue_profile_id, subject);


--
-- Name: venue_members_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venue_members_user_idx ON public.venue_members USING btree (user_id) WHERE (removed_at IS NULL);


--
-- Name: listings affiliate_on_first_listing_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER affiliate_on_first_listing_trigger AFTER INSERT OR UPDATE OF is_active ON public.listings FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_first_listing();


--
-- Name: openclaw_tasks openclaw_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER openclaw_tasks_updated_at BEFORE UPDATE ON public.openclaw_tasks FOR EACH ROW EXECUTE FUNCTION public.update_openclaw_tasks_updated_at();


--
-- Name: profiles protect_profile_payee_columns_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER protect_profile_payee_columns_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_payee_columns();


--
-- Name: profiles protect_profile_privileged_columns_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER protect_profile_privileged_columns_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();


--
-- Name: profiles protect_stripe_account_rebind_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER protect_stripe_account_rebind_trigger BEFORE UPDATE OF stripe_account_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_account_rebind();


--
-- Name: profiles require_bankid_for_public_creator_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER require_bankid_for_public_creator_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.require_bankid_for_public_creator();


--
-- Name: bookings set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: listings set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: payouts set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: promo_codes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: social_connections set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.social_connections FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: subscriptions set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: listings trg_inherit_listing_vat_rate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inherit_listing_vat_rate BEFORE INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.inherit_listing_vat_rate();


--
-- Name: listings trg_inherit_standing_rules; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inherit_standing_rules AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.inherit_standing_rules();


--
-- Name: account_credits account_credits_used_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_credits
    ADD CONSTRAINT account_credits_used_booking_id_fkey FOREIGN KEY (used_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: account_credits account_credits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_credits
    ADD CONSTRAINT account_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_capabilities admin_capabilities_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_capabilities
    ADD CONSTRAINT admin_capabilities_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: admin_capabilities admin_capabilities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_capabilities
    ADD CONSTRAINT admin_capabilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: affiliate_payouts affiliate_payouts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: affiliate_rewards affiliate_rewards_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_rewards
    ADD CONSTRAINT affiliate_rewards_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: affiliate_rewards affiliate_rewards_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_rewards
    ADD CONSTRAINT affiliate_rewards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: affiliate_rewards affiliate_rewards_referred_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_rewards
    ADD CONSTRAINT affiliate_rewards_referred_profile_id_fkey FOREIGN KEY (referred_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: agreement_events agreement_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreement_events
    ADD CONSTRAINT agreement_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agreement_events agreement_events_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreement_events
    ADD CONSTRAINT agreement_events_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE CASCADE;


--
-- Name: agreements agreements_counterparty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_counterparty_id_fkey FOREIGN KEY (counterparty_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agreements agreements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agreements agreements_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: booking_queue booking_queue_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_queue
    ADD CONSTRAINT booking_queue_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: booking_queue booking_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_queue
    ADD CONSTRAINT booking_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id);


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id);


--
-- Name: bookings bookings_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id) ON DELETE SET NULL;


--
-- Name: buddy_likes buddy_likes_from_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_likes
    ADD CONSTRAINT buddy_likes_from_user_fkey FOREIGN KEY (from_user) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: buddy_likes buddy_likes_to_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_likes
    ADD CONSTRAINT buddy_likes_to_user_fkey FOREIGN KEY (to_user) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: buddy_matches buddy_matches_user_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_matches
    ADD CONSTRAINT buddy_matches_user_a_fkey FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: buddy_matches buddy_matches_user_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buddy_matches
    ADD CONSTRAINT buddy_matches_user_b_fkey FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: calendar_import_hidden calendar_import_hidden_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_import_hidden
    ADD CONSTRAINT calendar_import_hidden_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: capability_unlocks capability_unlocks_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_unlocks
    ADD CONSTRAINT capability_unlocks_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: capability_unlocks capability_unlocks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capability_unlocks
    ADD CONSTRAINT capability_unlocks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: collaborator_invites collaborator_invites_accepted_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_invites
    ADD CONSTRAINT collaborator_invites_accepted_user_id_fkey FOREIGN KEY (accepted_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: collaborator_invites collaborator_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_invites
    ADD CONSTRAINT collaborator_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: collaborator_invites collaborator_invites_invited_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_invites
    ADD CONSTRAINT collaborator_invites_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: collaborator_invites collaborator_invites_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_invites
    ADD CONSTRAINT collaborator_invites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: collaborator_payment_requests collaborator_payment_requests_collaborator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaborator_payment_requests
    ADD CONSTRAINT collaborator_payment_requests_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.listing_collaborators(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_participant_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_participant_a_fkey FOREIGN KEY (participant_a) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_participant_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_participant_b_fkey FOREIGN KEY (participant_b) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: creator_availability creator_availability_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_availability
    ADD CONSTRAINT creator_availability_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: creator_commitments creator_commitments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_commitments
    ADD CONSTRAINT creator_commitments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: creator_debts creator_debts_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_debts
    ADD CONSTRAINT creator_debts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: creator_debts creator_debts_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_debts
    ADD CONSTRAINT creator_debts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: creator_debts creator_debts_partner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_debts
    ADD CONSTRAINT creator_debts_partner_profile_id_fkey FOREIGN KEY (partner_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creator_earnings creator_earnings_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creator_earnings creator_earnings_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: creator_media creator_media_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_media
    ADD CONSTRAINT creator_media_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: creator_memberships creator_memberships_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_memberships
    ADD CONSTRAINT creator_memberships_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: creator_promo_codes creator_promo_codes_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.creator_promo_codes
    ADD CONSTRAINT creator_promo_codes_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: credit_ledger credit_ledger_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: digital_product_content digital_product_content_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_product_content
    ADD CONSTRAINT digital_product_content_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.digital_products(id) ON DELETE CASCADE;


--
-- Name: digital_products digital_products_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_products
    ADD CONSTRAINT digital_products_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: digital_purchases digital_purchases_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: digital_purchases digital_purchases_creator_promo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_creator_promo_id_fkey FOREIGN KEY (creator_promo_id) REFERENCES public.creator_promo_codes(id) ON DELETE SET NULL;


--
-- Name: digital_purchases digital_purchases_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_purchases
    ADD CONSTRAINT digital_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.digital_products(id) ON DELETE CASCADE;


--
-- Name: dj_wish_votes dj_wish_votes_voter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dj_wish_votes
    ADD CONSTRAINT dj_wish_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dj_wish_votes dj_wish_votes_wish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dj_wish_votes
    ADD CONSTRAINT dj_wish_votes_wish_id_fkey FOREIGN KEY (wish_id) REFERENCES public.dj_wishes(id) ON DELETE CASCADE;


--
-- Name: dj_wishes dj_wishes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dj_wishes
    ADD CONSTRAINT dj_wishes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_broadcasts email_broadcasts_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_broadcasts
    ADD CONSTRAINT email_broadcasts_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_broadcasts email_broadcasts_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_broadcasts
    ADD CONSTRAINT email_broadcasts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: email_broadcasts email_broadcasts_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_broadcasts
    ADD CONSTRAINT email_broadcasts_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_follows email_follows_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_follows
    ADD CONSTRAINT email_follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_access_codes event_access_codes_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_access_codes
    ADD CONSTRAINT event_access_codes_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: event_instructors event_instructors_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_instructors
    ADD CONSTRAINT event_instructors_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_instructors event_instructors_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_instructors
    ADD CONSTRAINT event_instructors_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: event_revenue_shares event_revenue_shares_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_revenue_shares
    ADD CONSTRAINT event_revenue_shares_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: event_revenue_shares event_revenue_shares_partner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_revenue_shares
    ADD CONSTRAINT event_revenue_shares_partner_profile_id_fkey FOREIGN KEY (partner_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: event_settlement_payouts event_settlement_payouts_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_payouts
    ADD CONSTRAINT event_settlement_payouts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;


--
-- Name: event_settlement_payouts event_settlement_payouts_partner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_payouts
    ADD CONSTRAINT event_settlement_payouts_partner_profile_id_fkey FOREIGN KEY (partner_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: event_settlement_supplements event_settlement_supplements_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_supplements
    ADD CONSTRAINT event_settlement_supplements_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: event_settlement_supplements event_settlement_supplements_partner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_settlement_supplements
    ADD CONSTRAINT event_settlement_supplements_partner_profile_id_fkey FOREIGN KEY (partner_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: event_waitlist event_waitlist_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_waitlist
    ADD CONSTRAINT event_waitlist_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gage_agreements gage_agreements_collaborator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gage_agreements
    ADD CONSTRAINT gage_agreements_collaborator_user_id_fkey FOREIGN KEY (collaborator_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gage_agreements gage_agreements_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gage_agreements
    ADD CONSTRAINT gage_agreements_host_id_fkey FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gage_agreements gage_agreements_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gage_agreements
    ADD CONSTRAINT gage_agreements_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: gig_applications gig_applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gig_applications
    ADD CONSTRAINT gig_applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: gig_applications gig_applications_gig_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gig_applications
    ADD CONSTRAINT gig_applications_gig_id_fkey FOREIGN KEY (gig_id) REFERENCES public.gigs(id) ON DELETE CASCADE;


--
-- Name: gigs gigs_arranger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_arranger_id_fkey FOREIGN KEY (arranger_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: gigs gigs_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: listen_documents listen_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listen_documents
    ADD CONSTRAINT listen_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: listing_collaborators listing_collaborators_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_collaborators
    ADD CONSTRAINT listing_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: listing_collaborators listing_collaborators_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_collaborators
    ADD CONSTRAINT listing_collaborators_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_collaborators listing_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_collaborators
    ADD CONSTRAINT listing_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: listings listings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: listings listings_venue_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_venue_profile_id_fkey FOREIGN KEY (venue_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: membership_entries membership_entries_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_entries
    ADD CONSTRAINT membership_entries_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: membership_entries membership_entries_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_entries
    ADD CONSTRAINT membership_entries_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;


--
-- Name: membership_entries membership_entries_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_entries
    ADD CONSTRAINT membership_entries_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: memberships memberships_creator_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_creator_membership_id_fkey FOREIGN KEY (creator_membership_id) REFERENCES public.creator_memberships(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ob_bookings ob_bookings_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_bookings
    ADD CONSTRAINT ob_bookings_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.ob_users(id);


--
-- Name: ob_bookings ob_bookings_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_bookings
    ADD CONSTRAINT ob_bookings_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.ob_users(id);


--
-- Name: ob_creator_profiles ob_creator_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_creator_profiles
    ADD CONSTRAINT ob_creator_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ob_users(id) ON DELETE CASCADE;


--
-- Name: ob_dac7_records ob_dac7_records_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_dac7_records
    ADD CONSTRAINT ob_dac7_records_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.ob_users(id);


--
-- Name: ob_payouts ob_payouts_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_payouts
    ADD CONSTRAINT ob_payouts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ob_bookings(id) ON DELETE CASCADE;


--
-- Name: ob_track_changes ob_track_changes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_track_changes
    ADD CONSTRAINT ob_track_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ob_users(id) ON DELETE CASCADE;


--
-- Name: ob_users ob_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_users
    ADD CONSTRAINT ob_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ob_venue_profiles ob_venue_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ob_venue_profiles
    ADD CONSTRAINT ob_venue_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ob_users(id) ON DELETE CASCADE;


--
-- Name: pass_redemptions pass_redemptions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pass_redemptions
    ADD CONSTRAINT pass_redemptions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: pass_redemptions pass_redemptions_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pass_redemptions
    ADD CONSTRAINT pass_redemptions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;


--
-- Name: pass_redemptions pass_redemptions_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pass_redemptions
    ADD CONSTRAINT pass_redemptions_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: payee_f_tax_checks payee_f_tax_checks_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payee_f_tax_checks
    ADD CONSTRAINT payee_f_tax_checks_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: payee_f_tax_checks payee_f_tax_checks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payee_f_tax_checks
    ADD CONSTRAINT payee_f_tax_checks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payouts payouts_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payroll_shadow_lines payroll_shadow_lines_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_shadow_lines
    ADD CONSTRAINT payroll_shadow_lines_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: payroll_shadow_lines payroll_shadow_lines_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_shadow_lines
    ADD CONSTRAINT payroll_shadow_lines_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payroll_shadow_lines payroll_shadow_lines_shift_signup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_shadow_lines
    ADD CONSTRAINT payroll_shadow_lines_shift_signup_id_fkey FOREIGN KEY (shift_signup_id) REFERENCES public.taxi_signups(id) ON DELETE CASCADE;


--
-- Name: point_events point_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: premium_grants premium_grants_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premium_grants
    ADD CONSTRAINT premium_grants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_preferences profile_preferences_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_preferences
    ADD CONSTRAINT profile_preferences_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_f_tax_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_f_tax_checked_by_fkey FOREIGN KEY (f_tax_checked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id);


--
-- Name: promo_code_uses promo_code_uses_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: promo_code_uses promo_code_uses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: promo_codes promo_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: series_collaborators series_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.series_collaborators
    ADD CONSTRAINT series_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: settlement_statements settlement_statements_partner_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settlement_statements
    ADD CONSTRAINT settlement_statements_partner_profile_id_fkey FOREIGN KEY (partner_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: social_connections social_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_connections
    ADD CONSTRAINT social_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: student_notes student_notes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT student_notes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: taxi_shifts taxi_shifts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_shifts
    ADD CONSTRAINT taxi_shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: taxi_shifts taxi_shifts_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_shifts
    ADD CONSTRAINT taxi_shifts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: taxi_signups taxi_signups_dancer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_signups
    ADD CONSTRAINT taxi_signups_dancer_id_fkey FOREIGN KEY (dancer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: taxi_signups taxi_signups_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_signups
    ADD CONSTRAINT taxi_signups_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.taxi_shifts(id) ON DELETE CASCADE;


--
-- Name: taxi_vouchers taxi_vouchers_dancer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_vouchers
    ADD CONSTRAINT taxi_vouchers_dancer_id_fkey FOREIGN KEY (dancer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: taxi_vouchers taxi_vouchers_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxi_vouchers
    ADD CONSTRAINT taxi_vouchers_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: ticket_attendees ticket_attendees_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_attendees
    ADD CONSTRAINT ticket_attendees_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: ticket_attendees ticket_attendees_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_attendees
    ADD CONSTRAINT ticket_attendees_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id);


--
-- Name: ticket_pools ticket_pools_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_pools
    ADD CONSTRAINT ticket_pools_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: ticket_type_pools ticket_type_pools_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_type_pools
    ADD CONSTRAINT ticket_type_pools_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.ticket_pools(id) ON DELETE CASCADE;


--
-- Name: ticket_type_pools ticket_type_pools_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_type_pools
    ADD CONSTRAINT ticket_type_pools_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id) ON DELETE CASCADE;


--
-- Name: ticket_types ticket_types_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: ticket_types ticket_types_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.ticket_pools(id) ON DELETE SET NULL;


--
-- Name: tips tips_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: token_ledger token_ledger_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_ledger
    ADD CONSTRAINT token_ledger_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: training_buddy_profiles training_buddy_profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_buddy_profiles
    ADD CONSTRAINT training_buddy_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_points user_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reported_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reported_id_fkey FOREIGN KEY (reported_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_rewards user_rewards_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE CASCADE;


--
-- Name: user_rewards user_rewards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_rewards
    ADD CONSTRAINT user_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: venue_marketing_consents venue_marketing_consents_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_marketing_consents
    ADD CONSTRAINT venue_marketing_consents_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: venue_marketing_consents venue_marketing_consents_source_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_marketing_consents
    ADD CONSTRAINT venue_marketing_consents_source_listing_id_fkey FOREIGN KEY (source_listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: venue_marketing_consents venue_marketing_consents_venue_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_marketing_consents
    ADD CONSTRAINT venue_marketing_consents_venue_profile_id_fkey FOREIGN KEY (venue_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: venue_members venue_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_members
    ADD CONSTRAINT venue_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: venue_members venue_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_members
    ADD CONSTRAINT venue_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: venue_members venue_members_venue_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_members
    ADD CONSTRAINT venue_members_venue_profile_id_fkey FOREIGN KEY (venue_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: venue_revenue_share_defaults venue_revenue_share_defaults_venue_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venue_revenue_share_defaults
    ADD CONSTRAINT venue_revenue_share_defaults_venue_profile_id_fkey FOREIGN KEY (venue_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: volunteer_approvals volunteer_approvals_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_approvals
    ADD CONSTRAINT volunteer_approvals_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);


--
-- Name: volunteer_approvals volunteer_approvals_volunteer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_approvals
    ADD CONSTRAINT volunteer_approvals_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: volunteer_voucher_settings volunteer_voucher_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_voucher_settings
    ADD CONSTRAINT volunteer_voucher_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: listings Active listings are viewable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Active listings are viewable" ON public.listings FOR SELECT USING ((is_active = true));


--
-- Name: digital_products Anyone can view active products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view active products" ON public.digital_products FOR SELECT USING ((is_active = true));


--
-- Name: creator_promo_codes Anyone can view active promo codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view active promo codes" ON public.creator_promo_codes FOR SELECT USING ((is_active = true));


--
-- Name: rewards Anyone can view active rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view active rewards" ON public.rewards FOR SELECT USING ((is_active = true));


--
-- Name: follows Anyone can view follow counts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view follow counts" ON public.follows FOR SELECT USING (true);


--
-- Name: creator_media Anyone can view media; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view media" ON public.creator_media FOR SELECT USING (true);


--
-- Name: post_likes Anyone can view post likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view post likes" ON public.post_likes FOR SELECT USING (true);


--
-- Name: posts Anyone can view posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);


--
-- Name: reviews Anyone can view reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);


--
-- Name: user_points Anyone can view user points; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view user points" ON public.user_points FOR SELECT USING (true);


--
-- Name: venues Anyone can view venues; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view venues" ON public.venues FOR SELECT USING (true);


--
-- Name: gigs Anyone reads open gigs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone reads open gigs" ON public.gigs FOR SELECT USING (((status = 'open'::text) OR (arranger_id = ( SELECT auth.uid() AS uid))));


--
-- Name: event_revenue_shares Arrangören hanterar delningen; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Arrangören hanterar delningen" ON public.event_revenue_shares USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_revenue_shares.listing_id) AND (l.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_revenue_shares.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: ticket_type_pools Arrangören hanterar kopplingarna; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Arrangören hanterar kopplingarna" ON public.ticket_type_pools USING ((EXISTS ( SELECT 1
   FROM (public.ticket_types t
     JOIN public.listings l ON ((l.id = t.listing_id)))
  WHERE ((t.id = ticket_type_pools.ticket_type_id) AND (l.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.ticket_types t
     JOIN public.listings l ON ((l.id = t.listing_id)))
  WHERE ((t.id = ticket_type_pools.ticket_type_id) AND (l.user_id = auth.uid())))));


--
-- Name: ticket_pools Arrangören hanterar sina potter; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Arrangören hanterar sina potter" ON public.ticket_pools USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = ticket_pools.listing_id) AND (l.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = ticket_pools.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: event_settlement_supplements Arrangören ser sina kompletteringar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Arrangören ser sina kompletteringar" ON public.event_settlement_supplements FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_settlement_supplements.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: event_settlement_payouts Arrangören ser sina utbetalningar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Arrangören ser sina utbetalningar" ON public.event_settlement_payouts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_settlement_payouts.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: posts Authors can delete own posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authors can delete own posts" ON public.posts FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: posts Authors can update own posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authors can update own posts" ON public.posts FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: creator_availability Availability is publicly readable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Availability is publicly readable" ON public.creator_availability FOR SELECT USING (true);


--
-- Name: digital_purchases Buyers can view own purchases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Buyers can view own purchases" ON public.digital_purchases FOR SELECT USING ((( SELECT auth.uid() AS uid) = buyer_id));


--
-- Name: gigs Cleared arranger manages own gigs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cleared arranger manages own gigs" ON public.gigs USING (((arranger_id = ( SELECT auth.uid() AS uid)) AND public.is_bankid_cleared(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['creator'::text, 'kreator'::text, 'venue'::text, 'experience'::text, 'upplevelse'::text]))))))) WITH CHECK (((arranger_id = ( SELECT auth.uid() AS uid)) AND public.is_bankid_cleared(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['creator'::text, 'kreator'::text, 'venue'::text, 'experience'::text, 'upplevelse'::text])))))));


--
-- Name: gig_applications Cleared creator applies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cleared creator applies" ON public.gig_applications FOR INSERT WITH CHECK (((applicant_id = ( SELECT auth.uid() AS uid)) AND public.is_bankid_cleared(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'creator'::text))))));


--
-- Name: listings Cleared sellers manage own listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cleared sellers manage own listings" ON public.listings USING (((( SELECT auth.uid() AS uid) = user_id) AND public.is_bankid_cleared(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['creator'::text, 'kreator'::text, 'venue'::text, 'upplevelse'::text, 'experience'::text]))))))) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND public.is_bankid_cleared(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['creator'::text, 'kreator'::text, 'venue'::text, 'upplevelse'::text, 'experience'::text])))))));


--
-- Name: posts Creators and venues can create posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators and venues can create posts" ON public.posts FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['creator'::text, 'venue'::text, 'kreator'::text, 'experience'::text, 'upplevelse'::text])))))));


--
-- Name: digital_products Creators can manage own products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can manage own products" ON public.digital_products USING ((( SELECT auth.uid() AS uid) = creator_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = creator_id));


--
-- Name: creator_promo_codes Creators can manage own promo codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can manage own promo codes" ON public.creator_promo_codes USING ((( SELECT auth.uid() AS uid) = creator_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = creator_id));


--
-- Name: bookings Creators can update bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can update bookings" ON public.bookings FOR UPDATE USING ((( SELECT auth.uid() AS uid) = creator_id));


--
-- Name: payouts Creators can view own payouts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can view own payouts" ON public.payouts FOR SELECT USING ((( SELECT auth.uid() AS uid) = creator_id));


--
-- Name: booking_queue Creators can view queue for their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can view queue for their listings" ON public.booking_queue FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = booking_queue.listing_id) AND (listings.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: digital_purchases Creators can view sales of own products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can view sales of own products" ON public.digital_purchases FOR SELECT USING ((product_id IN ( SELECT digital_products.id
   FROM public.digital_products
  WHERE (digital_products.creator_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: bookings Customers can create bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT WITH CHECK ((auth.uid() = customer_id));


--
-- Name: credit_ledger Egen kredit; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Egen kredit" ON public.credit_ledger FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: affiliate_rewards Egna belöningar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Egna belöningar" ON public.affiliate_rewards FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: premium_grants Egna premiumperioder; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Egna premiumperioder" ON public.premium_grants FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: affiliate_payouts Egna utbetalningar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Egna utbetalningar" ON public.affiliate_payouts FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: event_instructors Eligible instructor joins open event; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Eligible instructor joins open event" ON public.event_instructors FOR INSERT WITH CHECK (((instructor_id = ( SELECT auth.uid() AS uid)) AND public.is_bankid_cleared(( SELECT auth.uid() AS uid)) AND public.is_approved_instructor(( SELECT auth.uid() AS uid), listing_id) AND public.instructor_profile_ready(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_instructors.listing_id) AND (l.is_active = true) AND (l.open_to_instructors = true) AND ((l.event_date IS NULL) OR (l.event_date >= ((now() AT TIME ZONE 'Europe/Stockholm'::text))::date)))))));


--
-- Name: event_access_codes Hosts manage own access codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts manage own access codes" ON public.event_access_codes USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_access_codes.listing_id) AND (l.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_access_codes.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: email_broadcasts Hosts read own broadcasts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts read own broadcasts" ON public.email_broadcasts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = email_broadcasts.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: event_waitlist Hosts read own event waitlist; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts read own event waitlist" ON public.event_waitlist FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_waitlist.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: event_instructors Instructor or host removes instructor row; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Instructor or host removes instructor row" ON public.event_instructors FOR DELETE USING (((instructor_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_instructors.listing_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: ticket_type_pools Kopplingar är läsbara; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Kopplingar är läsbara" ON public.ticket_type_pools FOR SELECT USING (true);


--
-- Name: venue_marketing_consents Man ser sitt eget samtycke; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Man ser sitt eget samtycke" ON public.venue_marketing_consents FOR SELECT USING ((profile_id = auth.uid()));


--
-- Name: venue_marketing_consents Man återkallar sitt eget samtycke; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Man återkallar sitt eget samtycke" ON public.venue_marketing_consents FOR UPDATE USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: venue_members Medlemmen ser sitt eget medlemskap; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Medlemmen ser sitt eget medlemskap" ON public.venue_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: creator_commitments Owner adds own commitments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner adds own commitments" ON public.creator_commitments FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: openclaw_tasks Owner full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner full access" ON public.openclaw_tasks USING ((created_by = 'pabloacostagomez_84556'::text));


--
-- Name: calendar_import_hidden Owner manages own hidden imports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner manages own hidden imports" ON public.calendar_import_hidden TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: student_notes Owner manages own student notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner manages own student notes" ON public.student_notes TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: creator_commitments Owner reads own commitments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner reads own commitments" ON public.creator_commitments FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: creator_commitments Owner removes own commitments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner removes own commitments" ON public.creator_commitments FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: creator_commitments Owner updates own commitments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner updates own commitments" ON public.creator_commitments FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: event_revenue_shares Partnern läser sin egen delning; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partnern läser sin egen delning" ON public.event_revenue_shares FOR SELECT USING ((partner_profile_id = auth.uid()));


--
-- Name: event_settlement_supplements Partnern ser sina kompletteringar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partnern ser sina kompletteringar" ON public.event_settlement_supplements FOR SELECT USING ((partner_profile_id = auth.uid()));


--
-- Name: event_settlement_payouts Partnern ser sina utbetalningar; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partnern ser sina utbetalningar" ON public.event_settlement_payouts FOR SELECT USING ((partner_profile_id = auth.uid()));


--
-- Name: ticket_pools Potter är läsbara; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Potter är läsbara" ON public.ticket_pools FOR SELECT USING (true);


--
-- Name: profiles Public profiles are viewable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING ((is_public = true));


--
-- Name: event_instructors Read instructors of open events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Read instructors of open events" ON public.event_instructors FOR SELECT USING (((instructor_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_instructors.listing_id) AND (l.is_active = true) AND (l.open_to_instructors = true)))) OR (EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = event_instructors.listing_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: gig_applications Read own applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Read own applications" ON public.gig_applications FOR SELECT USING (((applicant_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.gigs g
  WHERE ((g.id = gig_applications.gig_id) AND (g.arranger_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: messages Recipients can mark messages as read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Recipients can mark messages as read" ON public.messages FOR UPDATE USING (((sender_id <> ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.participant_a = ( SELECT auth.uid() AS uid)) OR (c.participant_b = ( SELECT auth.uid() AS uid))))))));


--
-- Name: bookings Service role manages bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role manages bookings" ON public.bookings TO service_role USING (true) WITH CHECK (true);


--
-- Name: gig_applications Update own application or applications to own gig; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Update own application or applications to own gig" ON public.gig_applications FOR UPDATE USING (((applicant_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.gigs g
  WHERE ((g.id = gig_applications.gig_id) AND (g.arranger_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((applicant_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.gigs g
  WHERE ((g.id = gig_applications.gig_id) AND (g.arranger_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: favorites Users can add favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can add favorites" ON public.favorites FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: creator_availability Users can add own availability; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can add own availability" ON public.creator_availability FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: listen_documents Users can add own listen documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can add own listen documents" ON public.listen_documents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: conversations Users can create conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (((auth.uid() = participant_a) OR (auth.uid() = participant_b)));


--
-- Name: reviews Users can create reviews for their completed bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create reviews for their completed bookings" ON public.reviews FOR INSERT WITH CHECK ((auth.uid() = reviewer_id));


--
-- Name: listen_documents Users can delete own listen documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own listen documents" ON public.listen_documents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: social_connections Users can insert own social connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own social connections" ON public.social_connections FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_reports Users can insert their own reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own reports" ON public.user_reports FOR INSERT WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: booking_queue Users can join queue; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can join queue" ON public.booking_queue FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: booking_queue Users can leave queue; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can leave queue" ON public.booking_queue FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: post_likes Users can like posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: follows Users can manage own follows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own follows" ON public.follows FOR INSERT WITH CHECK ((auth.uid() = follower_id));


--
-- Name: creator_media Users can manage own media; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own media" ON public.creator_media USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_blocks Users can manage their own blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage their own blocks" ON public.user_blocks USING ((( SELECT auth.uid() AS uid) = blocker_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = blocker_id));


--
-- Name: promo_codes Users can read their own promo codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read their own promo codes" ON public.promo_codes FOR SELECT USING (((is_active = true) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: promo_code_uses Users can record own promo usage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can record own promo usage" ON public.promo_code_uses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: creator_availability Users can remove own availability; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can remove own availability" ON public.creator_availability FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: favorites Users can remove own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can remove own favorites" ON public.favorites FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: messages Users can send messages in own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can send messages in own conversations" ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.participant_a = auth.uid()) OR (c.participant_b = auth.uid())))))));


--
-- Name: follows Users can unfollow; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING ((( SELECT auth.uid() AS uid) = follower_id));


--
-- Name: post_likes Users can unlike posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can unlike posts" ON public.post_likes FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (((( SELECT auth.uid() AS uid) = participant_a) OR (( SELECT auth.uid() AS uid) = participant_b)));


--
-- Name: listen_documents Users can update own listen documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own listen documents" ON public.listen_documents FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: reviews Users can update own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING ((( SELECT auth.uid() AS uid) = reviewer_id));


--
-- Name: user_settings Users can update own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: social_connections Users can update own social connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own social connections" ON public.social_connections FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can upsert own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can upsert own settings" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can view messages in own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.participant_a = ( SELECT auth.uid() AS uid)) OR (c.participant_b = ( SELECT auth.uid() AS uid)))))));


--
-- Name: bookings Users can view own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (((( SELECT auth.uid() AS uid) = creator_id) OR (( SELECT auth.uid() AS uid) = customer_id)));


--
-- Name: conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (((( SELECT auth.uid() AS uid) = participant_a) OR (( SELECT auth.uid() AS uid) = participant_b)));


--
-- Name: favorites Users can view own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: listen_documents Users can view own listen documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own listen documents" ON public.listen_documents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: payments Users can view own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: payouts Users can view own payouts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own payouts" ON public.payouts FOR SELECT USING ((( SELECT auth.uid() AS uid) = creator_id));


--
-- Name: point_events Users can view own point events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own point events" ON public.point_events FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: promo_code_uses Users can view own promo usage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own promo usage" ON public.promo_code_uses FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: booking_queue Users can view own queue entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own queue entries" ON public.booking_queue FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_rewards Users can view own rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own rewards" ON public.user_rewards FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can view own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: social_connections Users can view own social connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own social connections" ON public.social_connections FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: subscriptions Users can view own subscription; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_reports Users can view their own reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own reports" ON public.user_reports FOR SELECT USING ((( SELECT auth.uid() AS uid) = reporter_id));


--
-- Name: venue_revenue_share_defaults Venue reads own share default; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Venue reads own share default" ON public.venue_revenue_share_defaults FOR SELECT USING ((( SELECT auth.uid() AS uid) = venue_profile_id));


--
-- Name: account_credits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.account_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_capabilities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_capabilities ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_payouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.affiliate_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agreement_events ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_events agreement_events_select_party; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agreement_events_select_party ON public.agreement_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agreements a
  WHERE ((a.id = agreement_events.agreement_id) AND ((a.created_by = ( SELECT auth.uid() AS uid)) OR (a.counterparty_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: agreements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: agreements agreements_select_party; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agreements_select_party ON public.agreements FOR SELECT USING (((created_by = ( SELECT auth.uid() AS uid)) OR (counterparty_id = ( SELECT auth.uid() AS uid))));


--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: archived_deleted_rows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.archived_deleted_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: bastu_interest; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bastu_interest ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_queue; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.booking_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: training_buddy_profiles buddy profile own delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy profile own delete" ON public.training_buddy_profiles FOR DELETE USING ((auth.uid() = profile_id));


--
-- Name: training_buddy_profiles buddy profile own insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy profile own insert" ON public.training_buddy_profiles FOR INSERT WITH CHECK ((auth.uid() = profile_id));


--
-- Name: training_buddy_profiles buddy profile own select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy profile own select" ON public.training_buddy_profiles FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: training_buddy_profiles buddy profile own update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy profile own update" ON public.training_buddy_profiles FOR UPDATE USING ((auth.uid() = profile_id));


--
-- Name: buddy_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buddy_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_likes buddy_likes own insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_likes own insert" ON public.buddy_likes FOR INSERT WITH CHECK ((auth.uid() = from_user));


--
-- Name: buddy_likes buddy_likes own update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_likes own update" ON public.buddy_likes FOR UPDATE USING ((auth.uid() = from_user)) WITH CHECK ((auth.uid() = from_user));


--
-- Name: buddy_likes buddy_likes party select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_likes party select" ON public.buddy_likes FOR SELECT USING (((auth.uid() = from_user) OR (auth.uid() = to_user)));


--
-- Name: buddy_matches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buddy_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: buddy_matches buddy_matches party select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buddy_matches party select" ON public.buddy_matches FOR SELECT USING (((auth.uid() = user_a) OR (auth.uid() = user_b)));


--
-- Name: digital_product_content buyers read purchased content; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "buyers read purchased content" ON public.digital_product_content FOR SELECT USING ((product_id IN ( SELECT digital_purchases.product_id
   FROM public.digital_purchases
  WHERE (digital_purchases.buyer_id = auth.uid()))));


--
-- Name: calendar_import_hidden; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.calendar_import_hidden ENABLE ROW LEVEL SECURITY;

--
-- Name: capability_unlocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.capability_unlocks ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_collaborators collab_delete_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY collab_delete_host ON public.listing_collaborators FOR DELETE USING ((listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: listing_collaborators collab_insert_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY collab_insert_host ON public.listing_collaborators FOR INSERT WITH CHECK ((listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: listing_collaborators collab_select_host_or_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY collab_select_host_or_self ON public.listing_collaborators FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: listing_collaborators collab_update_host_remove; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY collab_update_host_remove ON public.listing_collaborators FOR UPDATE USING ((listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: listing_collaborators collab_update_self_accept_decline; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY collab_update_self_accept_decline ON public.listing_collaborators FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: collaborator_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collaborator_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: collaborator_payment_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collaborator_payment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_product_content creator manages own content; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "creator manages own content" ON public.digital_product_content USING ((product_id IN ( SELECT digital_products.id
   FROM public.digital_products
  WHERE (digital_products.creator_id = auth.uid())))) WITH CHECK ((product_id IN ( SELECT digital_products.id
   FROM public.digital_products
  WHERE (digital_products.creator_id = auth.uid()))));


--
-- Name: creator_availability; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_commitments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_commitments ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_debts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_debts ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_earnings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_media; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_media ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_memberships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_memberships creator_memberships_owner_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY creator_memberships_owner_all ON public.creator_memberships USING ((auth.uid() = creator_id)) WITH CHECK ((auth.uid() = creator_id));


--
-- Name: creator_memberships creator_memberships_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY creator_memberships_public_read ON public.creator_memberships FOR SELECT USING (is_active);


--
-- Name: creator_promo_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.creator_promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: csp_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: data_deletion_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_product_content; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.digital_product_content ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_purchases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.digital_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: dj_wish_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dj_wish_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: dj_wishes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dj_wishes ENABLE ROW LEVEL SECURITY;

--
-- Name: email_broadcasts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_follows ENABLE ROW LEVEL SECURITY;

--
-- Name: event_access_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_access_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: event_instructors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_instructors ENABLE ROW LEVEL SECURITY;

--
-- Name: event_revenue_shares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_revenue_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: event_settlement_payouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_settlement_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: event_settlement_supplements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_settlement_supplements ENABLE ROW LEVEL SECURITY;

--
-- Name: event_waitlist; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: gage_agreements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gage_agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: gage_agreements gage_insert_party; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY gage_insert_party ON public.gage_agreements FOR INSERT WITH CHECK (((host_id = ( SELECT auth.uid() AS uid)) OR (collaborator_user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: gage_agreements gage_select_party; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY gage_select_party ON public.gage_agreements FOR SELECT USING (((host_id = ( SELECT auth.uid() AS uid)) OR (collaborator_user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: gage_agreements gage_update_party; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY gage_update_party ON public.gage_agreements FOR UPDATE USING (((host_id = ( SELECT auth.uid() AS uid)) OR (collaborator_user_id = ( SELECT auth.uid() AS uid)))) WITH CHECK (((host_id = ( SELECT auth.uid() AS uid)) OR (collaborator_user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: gig_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gig_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: gigs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

--
-- Name: collaborator_invites invite_delete_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY invite_delete_host ON public.collaborator_invites FOR DELETE USING ((listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: collaborator_invites invite_insert_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY invite_insert_host ON public.collaborator_invites FOR INSERT WITH CHECK (((invited_by = ( SELECT auth.uid() AS uid)) AND (listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: collaborator_invites invite_select_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY invite_select_host ON public.collaborator_invites FOR SELECT USING (((invited_by = ( SELECT auth.uid() AS uid)) OR (listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: collaborator_invites invite_update_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY invite_update_host ON public.collaborator_invites FOR UPDATE USING (((invited_by = ( SELECT auth.uid() AS uid)) OR (listing_id IN ( SELECT listings.id
   FROM public.listings
  WHERE (listings.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: creator_earnings kreatoren laser sin egen ersattning; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "kreatoren laser sin egen ersattning" ON public.creator_earnings FOR SELECT TO authenticated USING ((creator_id = auth.uid()));


--
-- Name: listen_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listen_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_collaborators; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.membership_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_entries membership_entries_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY membership_entries_read ON public.membership_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.memberships m
     JOIN public.creator_memberships cm ON ((cm.id = m.creator_membership_id)))
  WHERE ((m.id = membership_entries.membership_id) AND ((m.member_id = auth.uid()) OR (cm.creator_id = auth.uid()))))));


--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships memberships_self_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY memberships_self_read ON public.memberships FOR SELECT USING (((auth.uid() = member_id) OR (EXISTS ( SELECT 1
   FROM public.creator_memberships cm
  WHERE ((cm.id = memberships.creator_membership_id) AND (cm.creator_id = auth.uid()))))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_creator_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_creator_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_dac7_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_dac7_records ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_payouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_track_changes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_track_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_users ENABLE ROW LEVEL SECURITY;

--
-- Name: ob_venue_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ob_venue_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: openclaw_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.openclaw_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: token_ledger own ledger read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own ledger read" ON public.token_ledger FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: ob_creator_profiles own ob_creator_profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own ob_creator_profile" ON public.ob_creator_profiles TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: ob_track_changes own ob_track_changes read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own ob_track_changes read" ON public.ob_track_changes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: ob_users own ob_user; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own ob_user" ON public.ob_users TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: ob_venue_profiles own ob_venue_profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own ob_venue_profile" ON public.ob_venue_profiles TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profile_preferences own prefs delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own prefs delete" ON public.profile_preferences FOR DELETE USING ((auth.uid() = profile_id));


--
-- Name: profile_preferences own prefs insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own prefs insert" ON public.profile_preferences FOR INSERT WITH CHECK ((auth.uid() = profile_id));


--
-- Name: profile_preferences own prefs select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own prefs select" ON public.profile_preferences FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: profile_preferences own prefs update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own prefs update" ON public.profile_preferences FOR UPDATE USING ((auth.uid() = profile_id)) WITH CHECK ((auth.uid() = profile_id));


--
-- Name: push_subscriptions own push subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own push subscriptions" ON public.push_subscriptions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: capability_unlocks own unlocks read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own unlocks read" ON public.capability_unlocks FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: ob_bookings party can read ob_booking; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "party can read ob_booking" ON public.ob_bookings FOR SELECT TO authenticated USING (((venue_id = auth.uid()) OR (creator_id = auth.uid())));


--
-- Name: ob_payouts party can read ob_payout; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "party can read ob_payout" ON public.ob_payouts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ob_bookings b
  WHERE ((b.id = ob_payouts.booking_id) AND ((b.venue_id = auth.uid()) OR (b.creator_id = auth.uid()))))));


--
-- Name: pass_redemptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pass_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: payee_f_tax_checks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payee_f_tax_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: collaborator_payment_requests payreq_insert_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payreq_insert_self ON public.collaborator_payment_requests FOR INSERT WITH CHECK ((collaborator_id IN ( SELECT listing_collaborators.id
   FROM public.listing_collaborators
  WHERE ((listing_collaborators.user_id = ( SELECT auth.uid() AS uid)) AND (listing_collaborators.status = 'accepted'::text)))));


--
-- Name: collaborator_payment_requests payreq_select_self_or_host; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payreq_select_self_or_host ON public.collaborator_payment_requests FOR SELECT USING (((collaborator_id IN ( SELECT listing_collaborators.id
   FROM public.listing_collaborators
  WHERE (listing_collaborators.user_id = ( SELECT auth.uid() AS uid)))) OR (collaborator_id IN ( SELECT lc.id
   FROM (public.listing_collaborators lc
     JOIN public.listings l ON ((l.id = lc.listing_id)))
  WHERE (l.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: collaborator_payment_requests payreq_update_host_or_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payreq_update_host_or_self ON public.collaborator_payment_requests FOR UPDATE USING (((collaborator_id IN ( SELECT listing_collaborators.id
   FROM public.listing_collaborators
  WHERE (listing_collaborators.user_id = ( SELECT auth.uid() AS uid)))) OR (collaborator_id IN ( SELECT lc.id
   FROM (public.listing_collaborators lc
     JOIN public.listings l ON ((l.id = lc.listing_id)))
  WHERE (l.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: payroll_shadow_lines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payroll_shadow_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: point_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: premium_grants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profile_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_uses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: account_credits read own credit; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "read own credit" ON public.account_credits FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: referral_clicks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_capabilities see own admin capabilities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "see own admin capabilities" ON public.admin_capabilities FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ob_dac7_records seller can read own ob_dac7; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "seller can read own ob_dac7" ON public.ob_dac7_records FOR SELECT TO authenticated USING ((seller_id = auth.uid()));


--
-- Name: series_access_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.series_access_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: series_collaborators; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.series_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: settlement_statements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.settlement_statements ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_processed_stripe_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shop_processed_stripe_events ENABLE ROW LEVEL SECURITY;

--
-- Name: social_connections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: student_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: taxi_shifts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.taxi_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: taxi_signups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.taxi_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: taxi_vouchers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.taxi_vouchers ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_attendees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ticket_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_attendees ticket_attendees read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ticket_attendees read" ON public.ticket_attendees FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = ticket_attendees.booking_id) AND ((b.creator_id = auth.uid()) OR (b.customer_id = auth.uid()))))));


--
-- Name: ticket_pools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ticket_pools ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_type_pools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ticket_type_pools ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_types ticket_types owner manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ticket_types owner manage" ON public.ticket_types USING ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = ticket_types.listing_id) AND (l.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = ticket_types.listing_id) AND (l.user_id = auth.uid())))));


--
-- Name: ticket_types ticket_types public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ticket_types public read" ON public.ticket_types FOR SELECT USING (true);


--
-- Name: tips; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

--
-- Name: tips tips_recipient_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tips_recipient_select ON public.tips FOR SELECT USING ((recipient_id = auth.uid()));


--
-- Name: token_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: training_buddy_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.training_buddy_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_points; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

--
-- Name: user_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: user_rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: venue_marketing_consents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.venue_marketing_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: venue_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.venue_members ENABLE ROW LEVEL SECURITY;

--
-- Name: venue_revenue_share_defaults; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.venue_revenue_share_defaults ENABLE ROW LEVEL SECURITY;

--
-- Name: venues; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_approvals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.volunteer_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: volunteer_voucher_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.volunteer_voucher_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: venue_members Ägaren hanterar sitt team; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Ägaren hanterar sitt team" ON public.venue_members USING ((venue_profile_id = auth.uid())) WITH CHECK ((venue_profile_id = auth.uid()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION affiliate_on_first_listing(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.affiliate_on_first_listing() FROM PUBLIC;
GRANT ALL ON FUNCTION public.affiliate_on_first_listing() TO service_role;


--
-- Name: FUNCTION award_points(p_user_id uuid, p_action text, p_points integer, p_source_id uuid, p_source_type text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.award_points(p_user_id uuid, p_action text, p_points integer, p_source_id uuid, p_source_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.award_points(p_user_id uuid, p_action text, p_points integer, p_source_id uuid, p_source_type text) TO service_role;


--
-- Name: FUNCTION claim_stripe_event(p_event_id text, p_session_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.claim_stripe_event(p_event_id text, p_session_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_stripe_event(p_event_id text, p_session_id text) TO service_role;


--
-- Name: FUNCTION confirm_venue_listing(p_listing uuid, p_confirm boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.confirm_venue_listing(p_listing uuid, p_confirm boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_venue_listing(p_listing uuid, p_confirm boolean) TO authenticated;
GRANT ALL ON FUNCTION public.confirm_venue_listing(p_listing uuid, p_confirm boolean) TO service_role;


--
-- Name: FUNCTION consume_access_code(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.consume_access_code(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_access_code(p_id uuid) TO service_role;


--
-- Name: FUNCTION count_referral_click(p_code text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.count_referral_click(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.count_referral_click(p_code text) TO service_role;


--
-- Name: FUNCTION current_user_admin_capabilities(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.current_user_admin_capabilities() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_user_admin_capabilities() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_admin_capabilities() TO service_role;


--
-- Name: FUNCTION get_creator_commission(p_creator_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_creator_commission(p_creator_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_creator_commission(p_creator_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_creator_commission(p_creator_id uuid) TO service_role;


--
-- Name: FUNCTION grant_monthly_allowance(p_profile uuid, p_amount integer, p_period text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.grant_monthly_allowance(p_profile uuid, p_amount integer, p_period text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.grant_monthly_allowance(p_profile uuid, p_amount integer, p_period text) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_updated_at() TO anon;
GRANT ALL ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;


--
-- Name: FUNCTION has_stripe_connect(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.has_stripe_connect(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_stripe_connect(p_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_stripe_connect(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_stripe_connect(p_id uuid) TO service_role;


--
-- Name: FUNCTION increment_creator_promo_uses(p_code text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_creator_promo_uses(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_creator_promo_uses(p_code text) TO service_role;


--
-- Name: FUNCTION increment_promo_uses(promo_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_promo_uses(promo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_promo_uses(promo_id uuid) TO service_role;


--
-- Name: FUNCTION increment_tickets_sold(p_listing uuid, p_n integer, p_ticket_type uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.increment_tickets_sold(p_listing uuid, p_n integer, p_ticket_type uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_tickets_sold(p_listing uuid, p_n integer, p_ticket_type uuid) TO service_role;


--
-- Name: FUNCTION inherit_listing_vat_rate(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.inherit_listing_vat_rate() FROM PUBLIC;
GRANT ALL ON FUNCTION public.inherit_listing_vat_rate() TO service_role;


--
-- Name: FUNCTION inherit_standing_rules(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.inherit_standing_rules() FROM PUBLIC;
GRANT ALL ON FUNCTION public.inherit_standing_rules() TO service_role;


--
-- Name: FUNCTION instructor_profile_ready(p_uid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.instructor_profile_ready(p_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.instructor_profile_ready(p_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.instructor_profile_ready(p_uid uuid) TO service_role;


--
-- Name: FUNCTION is_approved_instructor(p_uid uuid, p_listing uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_approved_instructor(p_uid uuid, p_listing uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_approved_instructor(p_uid uuid, p_listing uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_approved_instructor(p_uid uuid, p_listing uuid) TO service_role;


--
-- Name: FUNCTION is_bankid_cleared(uid uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_bankid_cleared(uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_bankid_cleared(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_bankid_cleared(uid uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_bankid_cleared(uid uuid) TO anon;


--
-- Name: FUNCTION is_current_user_admin(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_current_user_admin() TO service_role;


--
-- Name: FUNCTION materialize_series_access_codes(p_listing uuid, p_code text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.materialize_series_access_codes(p_listing uuid, p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.materialize_series_access_codes(p_listing uuid, p_code text) TO service_role;


--
-- Name: FUNCTION min_rate(rates jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.min_rate(rates jsonb) TO anon;
GRANT ALL ON FUNCTION public.min_rate(rates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.min_rate(rates jsonb) TO service_role;


--
-- Name: FUNCTION protect_profile_payee_columns(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.protect_profile_payee_columns() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_profile_payee_columns() TO anon;
GRANT ALL ON FUNCTION public.protect_profile_payee_columns() TO authenticated;
GRANT ALL ON FUNCTION public.protect_profile_payee_columns() TO service_role;


--
-- Name: FUNCTION protect_profile_privileged_columns(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_profile_privileged_columns() TO service_role;


--
-- Name: FUNCTION protect_stripe_account_rebind(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.protect_stripe_account_rebind() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_stripe_account_rebind() TO service_role;


--
-- Name: FUNCTION redeem_access_code(p_listing uuid, p_code text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.redeem_access_code(p_listing uuid, p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_access_code(p_listing uuid, p_code text) TO service_role;


--
-- Name: FUNCTION release_access_code(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.release_access_code(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_access_code(p_id uuid) TO service_role;


--
-- Name: FUNCTION release_stripe_event(p_event_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.release_stripe_event(p_event_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_stripe_event(p_event_id text) TO service_role;


--
-- Name: FUNCTION require_bankid_for_public_creator(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.require_bankid_for_public_creator() FROM PUBLIC;
GRANT ALL ON FUNCTION public.require_bankid_for_public_creator() TO service_role;


--
-- Name: FUNCTION reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer) TO service_role;


--
-- Name: FUNCTION security_report(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.security_report() FROM PUBLIC;
GRANT ALL ON FUNCTION public.security_report() TO service_role;


--
-- Name: FUNCTION soft_delete_account(p_user_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.soft_delete_account(p_user_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.soft_delete_account(p_user_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION unlock_capability(p_profile uuid, p_capability text, p_listing uuid, p_cost integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.unlock_capability(p_profile uuid, p_capability text, p_listing uuid, p_cost integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unlock_capability(p_profile uuid, p_capability text, p_listing uuid, p_cost integer) TO service_role;


--
-- Name: FUNCTION update_openclaw_tasks_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_openclaw_tasks_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_openclaw_tasks_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_openclaw_tasks_updated_at() TO service_role;


--
-- Name: FUNCTION user_storage_bytes(p_user uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.user_storage_bytes(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_storage_bytes(p_user uuid) TO service_role;


--
-- Name: FUNCTION venue_consent_count(p_venue uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.venue_consent_count(p_venue uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.venue_consent_count(p_venue uuid) TO authenticated;
GRANT ALL ON FUNCTION public.venue_consent_count(p_venue uuid) TO service_role;


--
-- Name: TABLE account_credits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.account_credits TO anon;
GRANT ALL ON TABLE public.account_credits TO authenticated;
GRANT ALL ON TABLE public.account_credits TO service_role;


--
-- Name: TABLE admin_capabilities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_capabilities TO anon;
GRANT ALL ON TABLE public.admin_capabilities TO authenticated;
GRANT ALL ON TABLE public.admin_capabilities TO service_role;


--
-- Name: TABLE affiliate_payouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.affiliate_payouts TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.affiliate_payouts TO authenticated;
GRANT ALL ON TABLE public.affiliate_payouts TO service_role;


--
-- Name: TABLE affiliate_rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.affiliate_rewards TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.affiliate_rewards TO authenticated;
GRANT ALL ON TABLE public.affiliate_rewards TO service_role;


--
-- Name: TABLE agreement_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agreement_events TO anon;
GRANT ALL ON TABLE public.agreement_events TO authenticated;
GRANT ALL ON TABLE public.agreement_events TO service_role;


--
-- Name: TABLE agreements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agreements TO anon;
GRANT ALL ON TABLE public.agreements TO authenticated;
GRANT ALL ON TABLE public.agreements TO service_role;


--
-- Name: TABLE app_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_config TO anon;
GRANT ALL ON TABLE public.app_config TO authenticated;
GRANT ALL ON TABLE public.app_config TO service_role;


--
-- Name: TABLE archived_deleted_rows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.archived_deleted_rows TO anon;
GRANT ALL ON TABLE public.archived_deleted_rows TO authenticated;
GRANT ALL ON TABLE public.archived_deleted_rows TO service_role;


--
-- Name: SEQUENCE archived_deleted_rows_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.archived_deleted_rows_id_seq TO anon;
GRANT ALL ON SEQUENCE public.archived_deleted_rows_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.archived_deleted_rows_id_seq TO service_role;


--
-- Name: TABLE bastu_interest; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bastu_interest TO anon;
GRANT ALL ON TABLE public.bastu_interest TO authenticated;
GRANT ALL ON TABLE public.bastu_interest TO service_role;


--
-- Name: TABLE booking_queue; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.booking_queue TO anon;
GRANT ALL ON TABLE public.booking_queue TO authenticated;
GRANT ALL ON TABLE public.booking_queue TO service_role;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: TABLE buddy_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buddy_likes TO anon;
GRANT ALL ON TABLE public.buddy_likes TO authenticated;
GRANT ALL ON TABLE public.buddy_likes TO service_role;


--
-- Name: TABLE buddy_matches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buddy_matches TO anon;
GRANT ALL ON TABLE public.buddy_matches TO authenticated;
GRANT ALL ON TABLE public.buddy_matches TO service_role;


--
-- Name: TABLE calendar_import_hidden; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.calendar_import_hidden TO authenticated;
GRANT ALL ON TABLE public.calendar_import_hidden TO service_role;


--
-- Name: TABLE capability_unlocks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.capability_unlocks TO anon;
GRANT ALL ON TABLE public.capability_unlocks TO authenticated;
GRANT ALL ON TABLE public.capability_unlocks TO service_role;


--
-- Name: TABLE collaborator_invites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collaborator_invites TO anon;
GRANT ALL ON TABLE public.collaborator_invites TO authenticated;
GRANT ALL ON TABLE public.collaborator_invites TO service_role;


--
-- Name: TABLE collaborator_payment_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collaborator_payment_requests TO anon;
GRANT ALL ON TABLE public.collaborator_payment_requests TO authenticated;
GRANT ALL ON TABLE public.collaborator_payment_requests TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE creator_availability; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_availability TO anon;
GRANT ALL ON TABLE public.creator_availability TO authenticated;
GRANT ALL ON TABLE public.creator_availability TO service_role;


--
-- Name: TABLE creator_commitments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_commitments TO authenticated;
GRANT ALL ON TABLE public.creator_commitments TO service_role;


--
-- Name: TABLE creator_debts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_debts TO anon;
GRANT ALL ON TABLE public.creator_debts TO authenticated;
GRANT ALL ON TABLE public.creator_debts TO service_role;


--
-- Name: TABLE creator_earnings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_earnings TO anon;
GRANT ALL ON TABLE public.creator_earnings TO authenticated;
GRANT ALL ON TABLE public.creator_earnings TO service_role;


--
-- Name: TABLE creator_media; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_media TO anon;
GRANT ALL ON TABLE public.creator_media TO authenticated;
GRANT ALL ON TABLE public.creator_media TO service_role;


--
-- Name: TABLE creator_memberships; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_memberships TO anon;
GRANT ALL ON TABLE public.creator_memberships TO authenticated;
GRANT ALL ON TABLE public.creator_memberships TO service_role;


--
-- Name: TABLE creator_promo_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.creator_promo_codes TO anon;
GRANT ALL ON TABLE public.creator_promo_codes TO authenticated;
GRANT ALL ON TABLE public.creator_promo_codes TO service_role;


--
-- Name: TABLE credit_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.credit_ledger TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.credit_ledger TO authenticated;
GRANT ALL ON TABLE public.credit_ledger TO service_role;


--
-- Name: TABLE csp_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.csp_reports TO anon;
GRANT ALL ON TABLE public.csp_reports TO authenticated;
GRANT ALL ON TABLE public.csp_reports TO service_role;


--
-- Name: TABLE data_deletion_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.data_deletion_requests TO anon;
GRANT ALL ON TABLE public.data_deletion_requests TO authenticated;
GRANT ALL ON TABLE public.data_deletion_requests TO service_role;


--
-- Name: TABLE digital_product_content; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.digital_product_content TO anon;
GRANT ALL ON TABLE public.digital_product_content TO authenticated;
GRANT ALL ON TABLE public.digital_product_content TO service_role;


--
-- Name: TABLE digital_products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.digital_products TO anon;
GRANT ALL ON TABLE public.digital_products TO authenticated;
GRANT ALL ON TABLE public.digital_products TO service_role;


--
-- Name: TABLE digital_purchases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.digital_purchases TO anon;
GRANT ALL ON TABLE public.digital_purchases TO authenticated;
GRANT ALL ON TABLE public.digital_purchases TO service_role;


--
-- Name: TABLE dj_wish_votes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dj_wish_votes TO service_role;


--
-- Name: TABLE dj_wishes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dj_wishes TO service_role;


--
-- Name: TABLE email_broadcasts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_broadcasts TO anon;
GRANT ALL ON TABLE public.email_broadcasts TO authenticated;
GRANT ALL ON TABLE public.email_broadcasts TO service_role;


--
-- Name: TABLE email_follows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_follows TO service_role;


--
-- Name: TABLE event_access_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_access_codes TO anon;
GRANT ALL ON TABLE public.event_access_codes TO authenticated;
GRANT ALL ON TABLE public.event_access_codes TO service_role;


--
-- Name: TABLE event_instructors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_instructors TO anon;
GRANT ALL ON TABLE public.event_instructors TO authenticated;
GRANT ALL ON TABLE public.event_instructors TO service_role;


--
-- Name: TABLE event_revenue_shares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_revenue_shares TO anon;
GRANT ALL ON TABLE public.event_revenue_shares TO authenticated;
GRANT ALL ON TABLE public.event_revenue_shares TO service_role;


--
-- Name: TABLE event_settlement_payouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_settlement_payouts TO anon;
GRANT ALL ON TABLE public.event_settlement_payouts TO authenticated;
GRANT ALL ON TABLE public.event_settlement_payouts TO service_role;


--
-- Name: TABLE event_settlement_supplements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_settlement_supplements TO anon;
GRANT ALL ON TABLE public.event_settlement_supplements TO authenticated;
GRANT ALL ON TABLE public.event_settlement_supplements TO service_role;


--
-- Name: TABLE event_waitlist; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_waitlist TO anon;
GRANT ALL ON TABLE public.event_waitlist TO authenticated;
GRANT ALL ON TABLE public.event_waitlist TO service_role;


--
-- Name: TABLE favorites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.favorites TO anon;
GRANT ALL ON TABLE public.favorites TO authenticated;
GRANT ALL ON TABLE public.favorites TO service_role;


--
-- Name: TABLE follows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.follows TO anon;
GRANT ALL ON TABLE public.follows TO authenticated;
GRANT ALL ON TABLE public.follows TO service_role;


--
-- Name: TABLE gage_agreements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gage_agreements TO anon;
GRANT ALL ON TABLE public.gage_agreements TO authenticated;
GRANT ALL ON TABLE public.gage_agreements TO service_role;


--
-- Name: TABLE gig_applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gig_applications TO anon;
GRANT ALL ON TABLE public.gig_applications TO authenticated;
GRANT ALL ON TABLE public.gig_applications TO service_role;


--
-- Name: TABLE gigs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gigs TO anon;
GRANT ALL ON TABLE public.gigs TO authenticated;
GRANT ALL ON TABLE public.gigs TO service_role;


--
-- Name: TABLE listen_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listen_documents TO anon;
GRANT ALL ON TABLE public.listen_documents TO authenticated;
GRANT ALL ON TABLE public.listen_documents TO service_role;


--
-- Name: TABLE listing_collaborators; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_collaborators TO anon;
GRANT ALL ON TABLE public.listing_collaborators TO authenticated;
GRANT ALL ON TABLE public.listing_collaborators TO service_role;


--
-- Name: TABLE listings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listings TO anon;
GRANT ALL ON TABLE public.listings TO authenticated;
GRANT ALL ON TABLE public.listings TO service_role;


--
-- Name: TABLE membership_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.membership_entries TO anon;
GRANT ALL ON TABLE public.membership_entries TO authenticated;
GRANT ALL ON TABLE public.membership_entries TO service_role;


--
-- Name: TABLE memberships; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.memberships TO anon;
GRANT ALL ON TABLE public.memberships TO authenticated;
GRANT ALL ON TABLE public.memberships TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE ob_bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_bookings TO anon;
GRANT ALL ON TABLE public.ob_bookings TO authenticated;
GRANT ALL ON TABLE public.ob_bookings TO service_role;


--
-- Name: TABLE ob_creator_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_creator_profiles TO anon;
GRANT ALL ON TABLE public.ob_creator_profiles TO authenticated;
GRANT ALL ON TABLE public.ob_creator_profiles TO service_role;


--
-- Name: TABLE ob_dac7_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_dac7_records TO anon;
GRANT ALL ON TABLE public.ob_dac7_records TO authenticated;
GRANT ALL ON TABLE public.ob_dac7_records TO service_role;


--
-- Name: TABLE ob_payouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_payouts TO anon;
GRANT ALL ON TABLE public.ob_payouts TO authenticated;
GRANT ALL ON TABLE public.ob_payouts TO service_role;


--
-- Name: TABLE ob_track_changes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_track_changes TO anon;
GRANT ALL ON TABLE public.ob_track_changes TO authenticated;
GRANT ALL ON TABLE public.ob_track_changes TO service_role;


--
-- Name: TABLE ob_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_users TO anon;
GRANT ALL ON TABLE public.ob_users TO authenticated;
GRANT ALL ON TABLE public.ob_users TO service_role;


--
-- Name: TABLE ob_venue_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ob_venue_profiles TO anon;
GRANT ALL ON TABLE public.ob_venue_profiles TO authenticated;
GRANT ALL ON TABLE public.ob_venue_profiles TO service_role;


--
-- Name: TABLE openclaw_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.openclaw_tasks TO anon;
GRANT ALL ON TABLE public.openclaw_tasks TO authenticated;
GRANT ALL ON TABLE public.openclaw_tasks TO service_role;


--
-- Name: TABLE pass_redemptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pass_redemptions TO service_role;


--
-- Name: TABLE payee_f_tax_checks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payee_f_tax_checks TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE payouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payouts TO anon;
GRANT ALL ON TABLE public.payouts TO authenticated;
GRANT ALL ON TABLE public.payouts TO service_role;


--
-- Name: TABLE payroll_shadow_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payroll_shadow_lines TO service_role;


--
-- Name: TABLE point_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.point_events TO anon;
GRANT ALL ON TABLE public.point_events TO authenticated;
GRANT ALL ON TABLE public.point_events TO service_role;


--
-- Name: TABLE post_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_likes TO anon;
GRANT ALL ON TABLE public.post_likes TO authenticated;
GRANT ALL ON TABLE public.post_likes TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;


--
-- Name: TABLE premium_grants; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.premium_grants TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.premium_grants TO authenticated;
GRANT ALL ON TABLE public.premium_grants TO service_role;


--
-- Name: TABLE profile_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profile_preferences TO anon;
GRANT ALL ON TABLE public.profile_preferences TO authenticated;
GRANT ALL ON TABLE public.profile_preferences TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(id) ON TABLE public.profiles TO anon;
GRANT SELECT(id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.full_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(full_name) ON TABLE public.profiles TO anon;
GRANT SELECT(full_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(avatar_url) ON TABLE public.profiles TO anon;
GRANT SELECT(avatar_url) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.bio; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(bio) ON TABLE public.profiles TO anon;
GRANT SELECT(bio) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.website; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(website) ON TABLE public.profiles TO anon;
GRANT SELECT(website) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.category; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(category) ON TABLE public.profiles TO anon;
GRANT SELECT(category) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.location; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(location) ON TABLE public.profiles TO anon;
GRANT SELECT(location) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.hourly_rate; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(hourly_rate) ON TABLE public.profiles TO anon;
GRANT SELECT(hourly_rate) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.is_public; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(is_public) ON TABLE public.profiles TO anon;
GRANT SELECT(is_public) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.created_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(created_at) ON TABLE public.profiles TO anon;
GRANT SELECT(created_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.updated_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(updated_at) ON TABLE public.profiles TO anon;
GRANT SELECT(updated_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.tier; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(tier) ON TABLE public.profiles TO anon;
GRANT SELECT(tier) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.facebook_page_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(facebook_page_id) ON TABLE public.profiles TO anon;
GRANT SELECT(facebook_page_id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.facebook_page_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(facebook_page_name) ON TABLE public.profiles TO anon;
GRANT SELECT(facebook_page_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.role; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(role) ON TABLE public.profiles TO anon;
GRANT SELECT(role) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(categories) ON TABLE public.profiles TO anon;
GRANT SELECT(categories) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(locations) ON TABLE public.profiles TO anon;
GRANT SELECT(locations) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(rates) ON TABLE public.profiles TO anon;
GRANT SELECT(rates) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.websites; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(websites) ON TABLE public.profiles TO anon;
GRANT SELECT(websites) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.social_instagram; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(social_instagram) ON TABLE public.profiles TO anon;
GRANT SELECT(social_instagram) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.social_x; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(social_x) ON TABLE public.profiles TO anon;
GRANT SELECT(social_x) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.social_facebook; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(social_facebook) ON TABLE public.profiles TO anon;
GRANT SELECT(social_facebook) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.contact_email; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(contact_email) ON TABLE public.profiles TO anon;
GRANT SELECT(contact_email) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.contact_phone; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(contact_phone) ON TABLE public.profiles TO anon;
GRANT SELECT(contact_phone) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.slug; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(slug) ON TABLE public.profiles TO anon;
GRANT SELECT(slug) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_logo_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_logo_url) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_logo_url) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_brand_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_brand_name) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_brand_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_accent_color; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_accent_color) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_accent_color) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_enabled; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_enabled) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_enabled) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_primary_color; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_primary_color) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_primary_color) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_accent_color_2; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_accent_color_2) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_accent_color_2) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.whitelabel_accent_color_3; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(whitelabel_accent_color_3) ON TABLE public.profiles TO anon;
GRANT SELECT(whitelabel_accent_color_3) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.instagram_user_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(instagram_user_id) ON TABLE public.profiles TO anon;
GRANT SELECT(instagram_user_id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.instagram_username; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(instagram_username) ON TABLE public.profiles TO anon;
GRANT SELECT(instagram_username) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.tiktok_user_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(tiktok_user_id) ON TABLE public.profiles TO anon;
GRANT SELECT(tiktok_user_id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.tiktok_username; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(tiktok_username) ON TABLE public.profiles TO anon;
GRANT SELECT(tiktok_username) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.bankid_verified_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(bankid_verified_at) ON TABLE public.profiles TO anon;
GRANT SELECT(bankid_verified_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.bankid_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(bankid_name) ON TABLE public.profiles TO anon;
GRANT SELECT(bankid_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.creator_subcategory; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(creator_subcategory) ON TABLE public.profiles TO anon;
GRANT SELECT(creator_subcategory) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.dance_styles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(dance_styles) ON TABLE public.profiles TO anon;
GRANT SELECT(dance_styles) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.dance_languages; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(dance_languages) ON TABLE public.profiles TO anon;
GRANT SELECT(dance_languages) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.dance_experience_years; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(dance_experience_years) ON TABLE public.profiles TO anon;
GRANT SELECT(dance_experience_years) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.offers_coaching; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(offers_coaching) ON TABLE public.profiles TO anon;
GRANT SELECT(offers_coaching) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.coaching_hourly_rate_sek; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(coaching_hourly_rate_sek) ON TABLE public.profiles TO anon;
GRANT SELECT(coaching_hourly_rate_sek) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.coaching_specialties; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(coaching_specialties) ON TABLE public.profiles TO anon;
GRANT SELECT(coaching_specialties) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.coaching_bio; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(coaching_bio) ON TABLE public.profiles TO anon;
GRANT SELECT(coaching_bio) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.company_name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(company_name) ON TABLE public.profiles TO anon;
GRANT SELECT(company_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.company_verified_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(company_verified_at) ON TABLE public.profiles TO anon;
GRANT SELECT(company_verified_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.is_marketplace_verified; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(is_marketplace_verified) ON TABLE public.profiles TO anon;
GRANT SELECT(is_marketplace_verified) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.coaching_title; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(coaching_title) ON TABLE public.profiles TO anon;
GRANT SELECT(coaching_title) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.coaching_formats; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(coaching_formats) ON TABLE public.profiles TO anon;
GRANT SELECT(coaching_formats) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.cancellation_hours; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(cancellation_hours) ON TABLE public.profiles TO anon;
GRANT SELECT(cancellation_hours) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.coaching_credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(coaching_credentials) ON TABLE public.profiles TO anon;
GRANT SELECT(coaching_credentials) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE promo_code_uses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promo_code_uses TO anon;
GRANT ALL ON TABLE public.promo_code_uses TO authenticated;
GRANT ALL ON TABLE public.promo_code_uses TO service_role;


--
-- Name: TABLE promo_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promo_codes TO anon;
GRANT ALL ON TABLE public.promo_codes TO authenticated;
GRANT ALL ON TABLE public.promo_codes TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE referral_clicks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.referral_clicks TO service_role;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reviews TO anon;
GRANT ALL ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;


--
-- Name: TABLE rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rewards TO anon;
GRANT ALL ON TABLE public.rewards TO authenticated;
GRANT ALL ON TABLE public.rewards TO service_role;


--
-- Name: TABLE series_access_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.series_access_codes TO anon;
GRANT ALL ON TABLE public.series_access_codes TO authenticated;
GRANT ALL ON TABLE public.series_access_codes TO service_role;


--
-- Name: TABLE series_collaborators; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.series_collaborators TO anon;
GRANT ALL ON TABLE public.series_collaborators TO authenticated;
GRANT ALL ON TABLE public.series_collaborators TO service_role;


--
-- Name: TABLE settlement_statements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.settlement_statements TO service_role;


--
-- Name: TABLE shop_processed_stripe_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shop_processed_stripe_events TO anon;
GRANT ALL ON TABLE public.shop_processed_stripe_events TO authenticated;
GRANT ALL ON TABLE public.shop_processed_stripe_events TO service_role;


--
-- Name: TABLE social_connections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.social_connections TO anon;
GRANT ALL ON TABLE public.social_connections TO authenticated;
GRANT ALL ON TABLE public.social_connections TO service_role;


--
-- Name: TABLE student_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.student_notes TO authenticated;
GRANT ALL ON TABLE public.student_notes TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE taxi_shifts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.taxi_shifts TO service_role;


--
-- Name: TABLE taxi_signups; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.taxi_signups TO service_role;


--
-- Name: TABLE taxi_vouchers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.taxi_vouchers TO service_role;


--
-- Name: TABLE ticket_attendees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ticket_attendees TO anon;
GRANT ALL ON TABLE public.ticket_attendees TO authenticated;
GRANT ALL ON TABLE public.ticket_attendees TO service_role;


--
-- Name: TABLE ticket_pools; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ticket_pools TO authenticated;
GRANT ALL ON TABLE public.ticket_pools TO service_role;
GRANT SELECT ON TABLE public.ticket_pools TO anon;


--
-- Name: TABLE ticket_type_pools; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ticket_type_pools TO authenticated;
GRANT ALL ON TABLE public.ticket_type_pools TO service_role;
GRANT SELECT ON TABLE public.ticket_type_pools TO anon;


--
-- Name: TABLE ticket_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ticket_types TO anon;
GRANT ALL ON TABLE public.ticket_types TO authenticated;
GRANT ALL ON TABLE public.ticket_types TO service_role;


--
-- Name: TABLE tips; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tips TO anon;
GRANT ALL ON TABLE public.tips TO authenticated;
GRANT ALL ON TABLE public.tips TO service_role;


--
-- Name: TABLE token_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.token_ledger TO anon;
GRANT ALL ON TABLE public.token_ledger TO authenticated;
GRANT ALL ON TABLE public.token_ledger TO service_role;


--
-- Name: SEQUENCE token_ledger_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.token_ledger_id_seq TO anon;
GRANT ALL ON SEQUENCE public.token_ledger_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.token_ledger_id_seq TO service_role;


--
-- Name: TABLE training_buddy_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.training_buddy_profiles TO anon;
GRANT ALL ON TABLE public.training_buddy_profiles TO authenticated;
GRANT ALL ON TABLE public.training_buddy_profiles TO service_role;


--
-- Name: TABLE user_blocks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_blocks TO anon;
GRANT ALL ON TABLE public.user_blocks TO authenticated;
GRANT ALL ON TABLE public.user_blocks TO service_role;


--
-- Name: TABLE user_points; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_points TO anon;
GRANT ALL ON TABLE public.user_points TO authenticated;
GRANT ALL ON TABLE public.user_points TO service_role;


--
-- Name: TABLE user_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_reports TO anon;
GRANT ALL ON TABLE public.user_reports TO authenticated;
GRANT ALL ON TABLE public.user_reports TO service_role;


--
-- Name: TABLE user_rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_rewards TO anon;
GRANT ALL ON TABLE public.user_rewards TO authenticated;
GRANT ALL ON TABLE public.user_rewards TO service_role;


--
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_settings TO anon;
GRANT ALL ON TABLE public.user_settings TO authenticated;
GRANT ALL ON TABLE public.user_settings TO service_role;


--
-- Name: TABLE venue_marketing_consents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.venue_marketing_consents TO authenticated;
GRANT ALL ON TABLE public.venue_marketing_consents TO service_role;


--
-- Name: TABLE venue_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.venue_members TO authenticated;
GRANT ALL ON TABLE public.venue_members TO service_role;


--
-- Name: TABLE venue_revenue_share_defaults; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.venue_revenue_share_defaults TO anon;
GRANT ALL ON TABLE public.venue_revenue_share_defaults TO authenticated;
GRANT ALL ON TABLE public.venue_revenue_share_defaults TO service_role;


--
-- Name: TABLE venues; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.venues TO anon;
GRANT ALL ON TABLE public.venues TO authenticated;
GRANT ALL ON TABLE public.venues TO service_role;


--
-- Name: TABLE volunteer_approvals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.volunteer_approvals TO service_role;


--
-- Name: TABLE volunteer_voucher_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.volunteer_voucher_settings TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--


--
-- PostgreSQL database dump complete
--

-- ---------------------------------------------------------------------------
-- Tillägg till baslinjen: det som produktionen har utanför schemat public.
-- Hämtat ur produktionens katalog 2026-11-23 (pg_policies, storage.buckets,
-- pg_trigger på auth.users). Bara struktur, inga uppgifter om användare.
-- ---------------------------------------------------------------------------

-- Ny användare i auth.users => profilrad. Utan den fallerar varje främmande
-- nyckel mot profiles.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lagringsbuckets (samma gränser som i produktionen)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('avatars',        'avatars',        true,  5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('event-images',   'event-images',   true,  5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('listing-images', 'listing-images', true,  5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('creator-media',  'creator-media',  true,  52428800,   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
  ('digital-content','digital-content',false, 5368709120, NULL)
ON CONFLICT (id) DO NOTHING;

-- Policyer på storage.objects
create policy "Authenticated users can upload" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'event-images'::text])));
create policy "Authenticated users can upload event images" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'event-images'::text));
create policy "Users can delete own avatar" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can delete own event images" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can update own avatar" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can update own event images" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can update own files" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'event-images'::text])) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Users can upload own avatar" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can upload own media" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'creator-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "creator-media_auth_insert_own" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'creator-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "digital-content own delete" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'digital-content'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "digital-content own insert" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'digital-content'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "digital-content own update" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'digital-content'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "event-images_auth_delete_own" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "event-images_auth_update_own" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- Standardrättigheterna på igen, som i produktionen, för kommande migrationer.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
