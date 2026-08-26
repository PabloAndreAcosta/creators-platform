


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."award_points"("p_user_id" "uuid", "p_action" "text", "p_points" integer, "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_source_type" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."award_points"("p_user_id" "uuid", "p_action" "text", "p_points" integer, "p_source_id" "uuid", "p_source_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_stripe_event"("p_event_id" "text", "p_session_id" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.shop_processed_stripe_events (event_id, session_id)
  values (p_event_id, p_session_id);
  return true;
exception when unique_violation then
  return false;
end;
$$;


ALTER FUNCTION "public"."claim_stripe_event"("p_event_id" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_access_code"("p_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.event_access_codes
  SET used_count = used_count + 1
  WHERE id = p_id
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses);
$$;


ALTER FUNCTION "public"."consume_access_code"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_admin_capabilities"() RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."current_user_admin_capabilities"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_creator_commission"("p_creator_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_creator_commission"("p_creator_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_creator_commission"("p_creator_id" "uuid") IS 'Returns commission rate (decimal) for a creator based on their tier: gratis=15%, guld=8%, premium=3%';



CREATE OR REPLACE FUNCTION "public"."grant_monthly_allowance"("p_profile" "uuid", "p_amount" integer, "p_period" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."grant_monthly_allowance"("p_profile" "uuid", "p_amount" integer, "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
  resolved_is_company BOOLEAN;
  resolved_locale TEXT;
BEGIN
  resolved_role := CASE
    WHEN new.raw_user_meta_data->>'role' IN ('creator', 'experience', 'customer')
      THEN new.raw_user_meta_data->>'role'
    ELSE 'customer'
  END;

  resolved_subcategory := CASE
    WHEN resolved_role = 'creator'
      AND new.raw_user_meta_data->>'creator_subcategory' IN ('general', 'taxi_dancer')
      THEN new.raw_user_meta_data->>'creator_subcategory'
    ELSE 'general'
  END;

  resolved_is_company := (
    resolved_role = 'creator'
    AND new.raw_user_meta_data->>'is_company' = 'true'
  );

  resolved_locale := CASE
    WHEN new.raw_user_meta_data->>'locale' IN ('sv', 'en', 'es')
      THEN new.raw_user_meta_data->>'locale'
    ELSE NULL
  END;

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
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_stripe_connect"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_id
      AND p.is_public = true
      AND p.stripe_account_id IS NOT NULL
  );
$$;


ALTER FUNCTION "public"."has_stripe_connect"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_creator_promo_uses"("p_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.creator_promo_codes
  SET times_used = times_used + 1
  WHERE code = upper(btrim(p_code))
    AND is_active = true
    AND (max_uses IS NULL OR times_used < max_uses);
END;
$$;


ALTER FUNCTION "public"."increment_creator_promo_uses"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_promo_uses"("promo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  BEGIN
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1
    WHERE id = promo_id;
  END;
  $$;


ALTER FUNCTION "public"."increment_promo_uses"("promo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_tickets_sold"("p_listing" "uuid", "p_n" integer DEFAULT 1, "p_ticket_type" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."increment_tickets_sold"("p_listing" "uuid", "p_n" integer, "p_ticket_type" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_bankid_cleared"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid
      AND (
        p.role = 'customer'
        OR p.bankid_verified_at IS NOT NULL
        OR p.bankid_grandfathered_at IS NOT NULL
      )
  );
$$;


ALTER FUNCTION "public"."is_bankid_cleared"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."min_rate"("rates" "jsonb") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(MIN(value::int), 0) FROM jsonb_each_text(rates);
$$;


ALTER FUNCTION "public"."min_rate"("rates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_privileged_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.tier := OLD.tier;
  NEW.role := OLD.role;
  NEW.is_admin := OLD.is_admin;
  NEW.creator_subcategory := OLD.creator_subcategory;
  NEW.stripe_account_id := OLD.stripe_account_id;
  NEW.bankid_verified_at := OLD.bankid_verified_at;
  NEW.bankid_personal_number := OLD.bankid_personal_number;
  NEW.bankid_name := OLD.bankid_name;
  NEW.bankid_grandfathered_at := OLD.bankid_grandfathered_at;
  NEW.stripe_card_payments_enabled := OLD.stripe_card_payments_enabled;
  NEW.stripe_charges_enabled := OLD.stripe_charges_enabled;
  NEW.stripe_details_submitted := OLD.stripe_details_submitted;
  NEW.is_usha_owned_seller := OLD.is_usha_owned_seller;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_profile_privileged_columns"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."protect_profile_privileged_columns"() IS 'Defense-in-depth: prevents authenticated users from elevating tier/role/is_admin or tampering with BankID/Stripe-derived columns via direct PATCH /profiles. Service role bypasses.';



CREATE OR REPLACE FUNCTION "public"."redeem_access_code"("p_listing" "uuid", "p_code" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.event_access_codes
  SET used_count = used_count + 1
  WHERE listing_id = p_listing
    AND code = upper(btrim(p_code))
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses)
  RETURNING id;
$$;


ALTER FUNCTION "public"."redeem_access_code"("p_listing" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_access_code"("p_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.event_access_codes
  SET used_count = greatest(used_count - 1, 0)
  WHERE id = p_id;
$$;


ALTER FUNCTION "public"."release_access_code"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_stripe_event"("p_event_id" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.shop_processed_stripe_events where event_id = p_event_id;
$$;


ALTER FUNCTION "public"."release_stripe_event"("p_event_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_bankid_for_public_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."require_bankid_for_public_creator"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."require_bankid_for_public_creator"() IS 'Defense-in-depth: prevents creator/experience profiles from being made public without BankID verification. Service role bypasses.';



CREATE OR REPLACE FUNCTION "public"."reserve_ticket"("p_listing" "uuid", "p_ticket_type" "uuid" DEFAULT NULL::"uuid", "p_n" integer DEFAULT 1) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cap integer; sold integer;
  tcap integer; tsold integer;
  n integer := greatest(coalesce(p_n, 1), 1);
BEGIN
  -- Lås och kontrollera event-nivån först (stabil låsordning: listing → typ).
  SELECT capacity, coalesce(tickets_sold, 0) INTO cap, sold
    FROM public.listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cap IS NOT NULL AND sold + n > cap THEN RETURN false; END IF;

  -- Om en biljettyp anges: kontrollera/uppdatera även dess egen kapacitet.
  IF p_ticket_type IS NOT NULL THEN
    SELECT capacity, coalesce(tickets_sold, 0) INTO tcap, tsold
      FROM public.ticket_types
      WHERE id = p_ticket_type AND listing_id = p_listing FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF tcap IS NOT NULL AND tsold + n > tcap THEN RETURN false; END IF;
    UPDATE public.ticket_types
      SET tickets_sold = coalesce(tickets_sold, 0) + n
      WHERE id = p_ticket_type;
  END IF;

  -- Rulla alltid upp event-räknaren så sold_out/kapacitet blir korrekt.
  UPDATE public.listings
    SET tickets_sold = coalesce(tickets_sold, 0) + n
    WHERE id = p_listing;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."reserve_ticket"("p_listing" "uuid", "p_ticket_type" "uuid", "p_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_account"("p_user_id" "uuid", "p_reason" "text" DEFAULT 'user-requested'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."soft_delete_account"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlock_capability"("p_profile" "uuid", "p_capability" "text", "p_listing" "uuid", "p_cost" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."unlock_capability"("p_profile" "uuid", "p_capability" "text", "p_listing" "uuid", "p_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_openclaw_tasks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_openclaw_tasks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_storage_bytes"("p_user" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id in ('creator-media','listing-images','event-images','avatars')
    and (o.owner = p_user or o.name like p_user::text || '/%');
$$;


ALTER FUNCTION "public"."user_storage_bytes"("p_user" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_capabilities" (
    "user_id" "uuid" NOT NULL,
    "capability" "text" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_capabilities_known" CHECK (("capability" = ANY (ARRAY['creators'::"text", 'promo'::"text"])))
);


ALTER TABLE "public"."admin_capabilities" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_capabilities" IS 'One slice of the admin surface granted to a user. is_admin=true implies all of them.';



COMMENT ON COLUMN "public"."admin_capabilities"."granted_by" IS 'Who granted it — a permission with no trail is a permission nobody owns.';



CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_config" IS 'Server-side runtime config (e.g. matching_access). Read via service_role with a short in-process cache. RLS enabled with no policies => locked to service_role.';



CREATE TABLE IF NOT EXISTS "public"."archived_deleted_rows" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "row_data" "jsonb" NOT NULL,
    "reason" "text",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."archived_deleted_rows" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."archived_deleted_rows_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."archived_deleted_rows_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."archived_deleted_rows_id_seq" OWNED BY "public"."archived_deleted_rows"."id";



CREATE TABLE IF NOT EXISTS "public"."bastu_interest" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "postal_code" "text",
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bastu_interest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_booked" boolean DEFAULT false NOT NULL,
    "auto_booked_at" timestamp with time zone
);


ALTER TABLE "public"."booking_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_queue" IS 'Waitlist queue for fully booked events. Auto-books when spots open.';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_payment_id" "text",
    "amount_paid" integer,
    "booking_type" "text" DEFAULT 'manual'::"text",
    "guest_count" integer DEFAULT 1,
    "special_requests" "text",
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "checked_in_at" timestamp with time zone,
    "guest_email" "text",
    "guest_name" "text",
    "dances_total" integer,
    "dances_redeemed" integer DEFAULT 0 NOT NULL,
    "agreed_price" integer,
    "reminder_sent_at" timestamp with time zone,
    "reminder_soon_sent_at" timestamp with time zone,
    "minutes_total" integer,
    "minutes_redeemed" integer DEFAULT 0 NOT NULL,
    "scanned_by" "uuid",
    "is_free" boolean DEFAULT false NOT NULL,
    "refunded_at" timestamp with time zone,
    "refund_amount" integer,
    "stripe_refund_id" "text",
    "ticket_type_id" "uuid",
    "ticket_type_name" "text",
    "platform_fee_amount" integer,
    CONSTRAINT "bookings_agreed_price_check" CHECK ((("agreed_price" IS NULL) OR ("agreed_price" >= 0))),
    CONSTRAINT "bookings_booking_type_check" CHECK (("booking_type" = ANY (ARRAY['manual'::"text", 'ticket'::"text", 'instructor_minutes'::"text"]))),
    CONSTRAINT "bookings_dances_redeemed_check" CHECK (("dances_redeemed" >= 0)),
    CONSTRAINT "bookings_dances_redeemed_within_total" CHECK ((("dances_total" IS NULL) OR ("dances_redeemed" <= "dances_total"))),
    CONSTRAINT "bookings_minutes_redeemed_check" CHECK (("minutes_redeemed" >= 0)),
    CONSTRAINT "bookings_minutes_redeemed_within_total" CHECK ((("minutes_total" IS NULL) OR ("minutes_redeemed" <= "minutes_total"))),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'completed'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."platform_fee_amount" IS 'Usha application_fee for this order in öre (commission + service fee). Null/0 for free tickets. Used by the organizer settlement report.';



CREATE TABLE IF NOT EXISTS "public"."buddy_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_user" "uuid" NOT NULL,
    "to_user" "uuid" NOT NULL,
    "action" "text" DEFAULT 'like'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_likes_action_check" CHECK (("action" = ANY (ARRAY['like'::"text", 'pass'::"text"]))),
    CONSTRAINT "buddy_likes_check" CHECK (("from_user" <> "to_user"))
);


ALTER TABLE "public"."buddy_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_matches_check" CHECK (("user_a" < "user_b"))
);


ALTER TABLE "public"."buddy_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capability_unlocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "capability" "text" NOT NULL,
    "scope" "text" DEFAULT 'event'::"text" NOT NULL,
    "listing_id" "uuid",
    "expires_at" timestamp with time zone,
    "locked_active" boolean DEFAULT true NOT NULL,
    "source" "text" DEFAULT 'token'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."capability_unlocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collaborator_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" NOT NULL,
    "invited_email" "text",
    "invited_phone" "text",
    "invited_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "accepted_user_id" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_user_id" "uuid",
    CONSTRAINT "collaborator_invites_role_check" CHECK (("role" = ANY (ARRAY['creator'::"text", 'taxi_dancer'::"text", 'volunteer'::"text", 'co_host'::"text"]))),
    CONSTRAINT "collaborator_invites_target_check" CHECK ((("invited_email" IS NOT NULL) OR ("invited_phone" IS NOT NULL) OR ("invited_user_id" IS NOT NULL)))
);


ALTER TABLE "public"."collaborator_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collaborator_payment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid" NOT NULL,
    "amount_sek" integer NOT NULL,
    "currency" "text" DEFAULT 'SEK'::"text" NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "decision_note" "text",
    "paid_at" timestamp with time zone,
    "paid_note" "text",
    CONSTRAINT "collaborator_payment_requests_amount_sek_check" CHECK (("amount_sek" >= 0)),
    CONSTRAINT "collaborator_payment_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'declined'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."collaborator_payment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "participant_a" "uuid" NOT NULL,
    "participant_b" "uuid" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversations_check" CHECK (("participant_a" < "participant_b"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "available_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_time" time without time zone,
    "end_time" time without time zone,
    CONSTRAINT "check_time_slot" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time"))))
);


ALTER TABLE "public"."creator_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_media" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "thumbnail_url" "text",
    "caption" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_hero" boolean DEFAULT false,
    "section" "text",
    CONSTRAINT "creator_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text", 'instagram'::"text", 'instagram-profile'::"text", 'vimeo'::"text", 'youtube'::"text"])))
);


ALTER TABLE "public"."creator_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_promo_codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "discount_percent" integer DEFAULT 0,
    "discount_amount" integer DEFAULT 0,
    "max_uses" integer,
    "times_used" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "creator_promo_codes_discount_percent_check" CHECK ((("discount_percent" >= 0) AND ("discount_percent" <= 100)))
);


ALTER TABLE "public"."creator_promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."csp_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_uri" "text",
    "referrer" "text",
    "violated_directive" "text",
    "effective_directive" "text",
    "blocked_uri" "text",
    "source_file" "text",
    "line_number" integer,
    "column_number" integer,
    "status_code" integer,
    "disposition" "text",
    "user_agent" "text",
    "raw" "jsonb"
);


ALTER TABLE "public"."csp_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."csp_reports" IS 'CSP (Content-Security-Policy) violation reports collected from the Report-Only policy. Inserted by /api/csp-report via service_role; read for analysis before promoting CSP to enforced. RLS enabled with no policies => locked to service_role only.';



CREATE TABLE IF NOT EXISTS "public"."data_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "external_user_id" "text" NOT NULL,
    "confirmation_code" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."data_deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_product_content" (
    "product_id" "uuid" NOT NULL,
    "video_url" "text",
    "file_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."digital_product_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price" integer DEFAULT 0 NOT NULL,
    "product_type" "text" NOT NULL,
    "thumbnail_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "digital_products_product_type_check" CHECK (("product_type" = ANY (ARRAY['video'::"text", 'course'::"text", 'download'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."digital_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_purchases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "amount_paid" integer NOT NULL,
    "stripe_payment_id" "text",
    "promo_code" "text",
    "creator_promo_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."digital_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "cta_label" "text",
    "cta_url" "text",
    "audience" "text" DEFAULT 'waitlist'::"text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_access_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text",
    "max_uses" integer,
    "used_count" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discount_price" integer,
    CONSTRAINT "event_access_codes_discount_price_check" CHECK ((("discount_price" IS NULL) OR ("discount_price" > 0)))
);


ALTER TABLE "public"."event_access_codes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_access_codes"."discount_price" IS 'NULL = gratis biljett (team/VIP). Satt (kr) = betald biljett till detta slutpris via Stripe.';



CREATE TABLE IF NOT EXISTS "public"."event_instructors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "instructor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_instructors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "name" "text",
    "email" "text" NOT NULL,
    "source" "text",
    "unsubscribe_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unsubscribed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone,
    "released_notified_at" timestamp with time zone
);


ALTER TABLE "public"."event_waitlist" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_waitlist"."notified_at" IS 'When this person was emailed that a seat opened up (refund/cancel freed capacity). Null = not yet notified; used to walk the FIFO list one seat at a time.';



COMMENT ON COLUMN "public"."event_waitlist"."released_notified_at" IS 'When this person was emailed that tickets were released / went on sale. Null = not yet notified. Separate from notified_at (refund seat-freed flow).';



CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


COMMENT ON TABLE "public"."favorites" IS 'User wishlist / saved listings';



CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "followed_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gage_agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "collaborator_user_id" "uuid" NOT NULL,
    "amount_ore" integer NOT NULL,
    "proposed_by" "text" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "note" "text",
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_transfer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agreed_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    CONSTRAINT "gage_agreements_amount_ore_check" CHECK (("amount_ore" > 0)),
    CONSTRAINT "gage_agreements_proposed_by_check" CHECK (("proposed_by" = ANY (ARRAY['host'::"text", 'crew'::"text"]))),
    CONSTRAINT "gage_agreements_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'agreed'::"text", 'paid'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."gage_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gig_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "applicant_id" "uuid" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gig_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."gig_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gigs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "arranger_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" "date" NOT NULL,
    "event_time" time without time zone,
    "venue" "text",
    "venue_address" "text",
    "proposed_price" integer NOT NULL,
    "perks" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gigs_proposed_price_check" CHECK (("proposed_price" >= 0)),
    CONSTRAINT "gigs_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'filled'::"text", 'closed'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."gigs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'invited'::"text" NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "can_scan" boolean DEFAULT false NOT NULL,
    "can_manage" boolean DEFAULT false NOT NULL,
    CONSTRAINT "listing_collaborators_role_check" CHECK (("role" = ANY (ARRAY['creator'::"text", 'taxi_dancer'::"text", 'volunteer'::"text", 'co_host'::"text"]))),
    CONSTRAINT "listing_collaborators_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'accepted'::"text", 'declined'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."listing_collaborators" OWNER TO "postgres";


COMMENT ON COLUMN "public"."listing_collaborators"."can_manage" IS 'Co-organizer: may administer the event (edit/broadcast/stats/crew/codes) but never money or ownership. Granted by the owner.';



CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "price" integer,
    "duration_minutes" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "event_tier" character varying(1) DEFAULT 'a'::character varying NOT NULL,
    "release_to_gold_at" timestamp with time zone,
    "facebook_event_id" "text",
    "image_url" "text",
    "event_date" "date",
    "event_time" time without time zone,
    "event_location" "text",
    "capacity" integer,
    "listing_type" "text" DEFAULT 'service'::"text",
    "min_guests" integer DEFAULT 1,
    "max_guests" integer,
    "experience_details" "jsonb" DEFAULT '{}'::"jsonb",
    "event_lat" double precision,
    "event_lng" double precision,
    "event_place_id" "text",
    "event_end_time" time without time zone,
    "is_promoted" boolean DEFAULT false,
    "promoted_until" timestamp with time zone,
    "slug" "text",
    "dance_count" integer,
    "followers_notified_at" timestamp with time zone,
    "series_id" "uuid",
    "series_slug" "text",
    "fb_auto_post" boolean DEFAULT false NOT NULL,
    "fb_reminder_posted_at" timestamp with time zone,
    "open_to_instructors" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_reason" "text",
    "event_city" "text",
    "event_venue" "text",
    "is_public" boolean DEFAULT true NOT NULL,
    "early_bird_start" timestamp with time zone,
    "early_bird_end" timestamp with time zone,
    "early_bird_price" numeric,
    "public_sale_at" timestamp with time zone,
    "tickets_sold" integer DEFAULT 0 NOT NULL,
    "image_url_square" "text",
    "content_language" "text",
    "organizer_name" "text",
    "service_fee_mode" "text" DEFAULT 'buyer'::"text" NOT NULL,
    CONSTRAINT "listings_dance_count_check" CHECK ((("dance_count" IS NULL) OR ("dance_count" > 0))),
    CONSTRAINT "listings_event_tier_check" CHECK ((("event_tier")::"text" = ANY ((ARRAY['a'::character varying, 'b'::character varying, 'c'::character varying])::"text"[]))),
    CONSTRAINT "listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['service'::"text", 'event'::"text", 'table_reservation'::"text", 'spa_treatment'::"text", 'group_activity'::"text", 'dance_package'::"text", 'coaching_session'::"text", 'b2b_offering'::"text"]))),
    CONSTRAINT "listings_service_fee_mode_check" CHECK (("service_fee_mode" = ANY (ARRAY['buyer'::"text", 'absorb'::"text"])))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."listings"."event_tier" IS 'Dynamic discount tier: a = full price, b = moderate discount, c = max discount';



COMMENT ON COLUMN "public"."listings"."release_to_gold_at" IS 'When this listing becomes available to Guld/Premium members (early access)';



COMMENT ON COLUMN "public"."listings"."capacity" IS 'Maximum number of bookings for this listing (NULL = unlimited)';



COMMENT ON COLUMN "public"."listings"."is_public" IS 'Olistat event om false: nåbart via direktlänk (slug) men dolt från marknadsplats/browse. Gating sker i app-queries, ej RLS.';



COMMENT ON COLUMN "public"."listings"."image_url_square" IS 'Valfri kvadratisk variant av bannern som visas på mobil; null → använd image_url.';



COMMENT ON COLUMN "public"."listings"."content_language" IS 'Tvingat visningsspråk för event-sidan (sv|en); null = följ besökarens locale.';



COMMENT ON COLUMN "public"."listings"."organizer_name" IS 'Visad arrangör/organizer på event-sidan; null = använd kontoägarens namn.';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_content_check" CHECK ((("char_length"("content") > 0) AND ("char_length"("content") <= 2000)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title_key" "text",
    "body_key" "text",
    "params" "jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'In-app notification feed';



COMMENT ON COLUMN "public"."notifications"."title_key" IS 'i18n key under serverNotifications for the heading; null = use the frozen title.';



COMMENT ON COLUMN "public"."notifications"."body_key" IS 'i18n key under serverNotifications for the body; null = use the frozen message.';



COMMENT ON COLUMN "public"."notifications"."params" IS 'Values interpolated into title_key/body_key, e.g. {"service":"Salsa 101"}.';



CREATE TABLE IF NOT EXISTS "public"."ob_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "amount_gross" integer NOT NULL,
    "commission" integer NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "vat_on_commission_only" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "commission_not_exceeding_gross" CHECK (("commission" <= "amount_gross")),
    CONSTRAINT "ob_bookings_amount_gross_check" CHECK (("amount_gross" >= 0)),
    CONSTRAINT "ob_bookings_commission_check" CHECK (("commission" >= 0)),
    CONSTRAINT "ob_bookings_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'accepted'::"text", 'in_escrow'::"text", 'completed'::"text", 'settled'::"text", 'disputed'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."ob_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ob_creator_profiles" (
    "user_id" "uuid" NOT NULL,
    "track" "text" NOT NULL,
    "org_no" "text",
    "fskatt_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "fskatt_checked_at" timestamp with time zone,
    "vat_no" "text",
    "stripe_account_id" "text",
    "eor_worker_id" "text",
    "bank_account" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ob_creator_profiles_fskatt_status_check" CHECK (("fskatt_status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'unknown'::"text"]))),
    CONSTRAINT "ob_creator_profiles_track_check" CHECK (("track" = ANY (ARRAY['C1'::"text", 'C2'::"text", 'C3'::"text", 'C4'::"text"])))
);


ALTER TABLE "public"."ob_creator_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ob_dac7_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "quarter" smallint NOT NULL,
    "year" smallint NOT NULL,
    "consideration" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'SEK'::"text" NOT NULL,
    CONSTRAINT "ob_dac7_records_quarter_check" CHECK ((("quarter" >= 1) AND ("quarter" <= 4)))
);


ALTER TABLE "public"."ob_dac7_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ob_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "state" "text" DEFAULT 'pending'::"text" NOT NULL,
    "kind" "text" DEFAULT 'payout'::"text" NOT NULL,
    "gross" integer DEFAULT 0 NOT NULL,
    "tax" integer DEFAULT 0 NOT NULL,
    "fees" integer DEFAULT 0 NOT NULL,
    "commission" integer DEFAULT 0 NOT NULL,
    "net" integer DEFAULT 0 NOT NULL,
    "released_at" timestamp with time zone,
    CONSTRAINT "ob_payouts_kind_check" CHECK (("kind" = ANY (ARRAY['payout'::"text", 'expense_reimbursement'::"text"]))),
    CONSTRAINT "ob_payouts_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'eor'::"text"]))),
    CONSTRAINT "ob_payouts_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'held'::"text", 'released'::"text", 'paid'::"text", 'blocked'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ob_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ob_track_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "from_track" "text" NOT NULL,
    "to_track" "text" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ob_track_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ob_users" (
    "id" "uuid" NOT NULL,
    "bankid_verified" boolean DEFAULT false NOT NULL,
    "name" "text",
    "personal_no" "text",
    "email" "text",
    "phone" "text",
    "tax_residence_country" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ob_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ob_venue_profiles" (
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "org_no" "text" NOT NULL,
    "vat_no" "text",
    "billing_info" "text",
    "po_reference" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ob_venue_profiles_type_check" CHECK (("type" = ANY (ARRAY['V1'::"text", 'V2'::"text", 'V3'::"text"])))
);


ALTER TABLE "public"."ob_venue_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."openclaw_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "task_type" "text" NOT NULL,
    "priority" integer DEFAULT 5,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "assigned_to" "text" DEFAULT 'openclaw'::"text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "execution_log" "jsonb" DEFAULT '[]'::"jsonb",
    "result" "text",
    "error_message" "text",
    "repo_path" "text",
    "branch" "text" DEFAULT 'main'::"text",
    "files_affected" "text"[],
    "requires_approval" boolean DEFAULT false,
    "approved_by" "text",
    "approved_at" timestamp with time zone,
    "dry_run" boolean DEFAULT true,
    "max_tokens" integer DEFAULT 5000,
    "created_by" "text" NOT NULL,
    "tags" "text"[]
);


ALTER TABLE "public"."openclaw_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_payment_id" "text",
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'sek'::"text",
    "status" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_method" "text",
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['succeeded'::"text", 'pending'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payments"."payment_method" IS 'Stripe payment_method_details.type used for this payment (e.g. card, swish, klarna). NULL = unknown/no charge.';



CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "amount_gross" numeric(10,2) NOT NULL,
    "amount_commission" numeric(10,2) NOT NULL,
    "amount_net" numeric(10,2) NOT NULL,
    "payout_type" character varying(20) NOT NULL,
    "stripe_payout_id" character varying(255),
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "payouts_amount_commission_check" CHECK (("amount_commission" >= (0)::numeric)),
    CONSTRAINT "payouts_amount_gross_check" CHECK (("amount_gross" > (0)::numeric)),
    CONSTRAINT "payouts_check" CHECK (("amount_net" = ("amount_gross" - "amount_commission"))),
    CONSTRAINT "payouts_payout_type_check" CHECK ((("payout_type")::"text" = ANY ((ARRAY['batch'::character varying, 'instant'::character varying])::"text"[]))),
    CONSTRAINT "payouts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_transit'::character varying, 'paid'::character varying, 'failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."payouts" IS 'Creator payout records. Commission based on tier: gratis 15%, guld 8%, premium 3%.';



CREATE TABLE IF NOT EXISTS "public"."point_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "points" integer NOT NULL,
    "source_id" "uuid",
    "source_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "point_events_action_check" CHECK (("action" = ANY (ARRAY['like_given'::"text", 'like_received'::"text", 'follow_given'::"text", 'follow_received'::"text", 'booking_made'::"text", 'booking_received'::"text", 'review_written'::"text", 'review_received'::"text", 'post_created'::"text", 'referral_signup'::"text", 'profile_completed'::"text"])))
);


ALTER TABLE "public"."point_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "image_url" "text",
    "listing_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_preferences" (
    "profile_id" "uuid" NOT NULL,
    "dance_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "skill_level" "text",
    "city" "text",
    "radius_km" integer DEFAULT 25 NOT NULL,
    "looking_for" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "visible_in_matching" boolean DEFAULT true NOT NULL,
    "onboarding_completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_preferences" IS 'Per-profile matching preferences collected via onboarding; editable in Profile. visible_in_matching is the opt-out for appearing as a match candidate.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "website" "text",
    "category" "text",
    "location" "text",
    "hourly_rate" integer,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tier" character varying(20) DEFAULT 'silver'::character varying NOT NULL,
    "stripe_account_id" "text",
    "facebook_page_id" "text",
    "facebook_page_name" "text",
    "facebook_page_access_token" "text",
    "role" "text" DEFAULT 'publik'::"text",
    "calendar_sync_token" "uuid",
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "locations" "text"[] DEFAULT '{}'::"text"[],
    "rates" "jsonb" DEFAULT '{}'::"jsonb",
    "websites" "text"[] DEFAULT '{}'::"text"[],
    "social_instagram" "text",
    "social_x" "text",
    "social_facebook" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "slug" "text",
    "whitelabel_logo_url" "text",
    "whitelabel_brand_name" "text",
    "whitelabel_accent_color" "text",
    "whitelabel_enabled" boolean DEFAULT false,
    "whitelabel_primary_color" "text",
    "whitelabel_accent_color_2" "text",
    "whitelabel_accent_color_3" "text",
    "instagram_user_id" "text",
    "instagram_username" "text",
    "instagram_access_token" "text",
    "tiktok_user_id" "text",
    "tiktok_username" "text",
    "tiktok_access_token" "text",
    "tiktok_refresh_token" "text",
    "bankid_verified_at" timestamp with time zone,
    "bankid_personal_number" "text",
    "bankid_name" "text",
    "referral_code" "text",
    "referred_by" "uuid",
    "is_admin" boolean DEFAULT false,
    "creator_subcategory" "text" DEFAULT 'general'::"text",
    "dance_styles" "text"[],
    "dance_languages" "text"[],
    "dance_experience_years" integer,
    "offers_coaching" boolean DEFAULT false,
    "coaching_hourly_rate_sek" integer,
    "coaching_specialties" "text"[],
    "coaching_bio" "text",
    "bankid_grandfathered_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "archived_reason" "text",
    "org_number" "text",
    "company_name" "text",
    "company_verified_at" timestamp with time zone,
    "company_verification_method" "text",
    "is_marketplace_verified" boolean GENERATED ALWAYS AS (
CASE
    WHEN ("role" = ANY (ARRAY['venue'::"text", 'experience'::"text", 'upplevelse'::"text"])) THEN (("company_verified_at" IS NOT NULL) OR ("bankid_verified_at" IS NOT NULL))
    WHEN ("role" = ANY (ARRAY['creator'::"text", 'kreator'::"text"])) THEN ("bankid_verified_at" IS NOT NULL)
    ELSE false
END) STORED,
    "deleted_at" timestamp with time zone,
    "deleted_reason" "text",
    "stripe_card_payments_enabled" boolean DEFAULT false NOT NULL,
    "stripe_charges_enabled" boolean DEFAULT false NOT NULL,
    "stripe_details_submitted" boolean DEFAULT false NOT NULL,
    "is_usha_owned_seller" boolean DEFAULT false NOT NULL,
    "terms_url" "text",
    "is_company" boolean DEFAULT false NOT NULL,
    "locale" "text",
    CONSTRAINT "profiles_coaching_hourly_rate_sek_check" CHECK ((("coaching_hourly_rate_sek" IS NULL) OR ("coaching_hourly_rate_sek" >= 0))),
    CONSTRAINT "profiles_creator_subcategory_check" CHECK (("creator_subcategory" = ANY (ARRAY['general'::"text", 'taxi_dancer'::"text"]))),
    CONSTRAINT "profiles_dance_experience_years_check" CHECK ((("dance_experience_years" IS NULL) OR ("dance_experience_years" >= 0))),
    CONSTRAINT "profiles_subcategory_requires_creator" CHECK ((("creator_subcategory" = 'general'::"text") OR (("creator_subcategory" = 'taxi_dancer'::"text") AND ("role" = 'creator'::"text")))),
    CONSTRAINT "profiles_tier_check" CHECK ((("tier")::"text" = ANY ((ARRAY['silver'::character varying, 'gold'::character varying, 'platinum'::character varying, 'gratis'::character varying, 'guld'::character varying, 'premium'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."tier" IS 'Creator tier: gratis (15% commission), guld (8%), premium (3%)';



COMMENT ON COLUMN "public"."profiles"."stripe_account_id" IS 'Stripe Connect Express account ID for creator payouts';



COMMENT ON COLUMN "public"."profiles"."bankid_grandfathered_at" IS 'Set for creator/experience users who registered before BankID enforcement (2026-05-05). They retain commercial-action access without re-verifying.';



COMMENT ON COLUMN "public"."profiles"."stripe_card_payments_enabled" IS 'Stripe Connect card_payments capability is active — required before on_behalf_of (merchant-of-record shift to the organizer).';



COMMENT ON COLUMN "public"."profiles"."is_usha_owned_seller" IS 'Seller is Usha itself → principal/gross accounting flow, not third-party/net.';



COMMENT ON COLUMN "public"."profiles"."terms_url" IS 'Organizer purchase-terms URL, shown at checkout and stamped on the charge as the consent record.';



COMMENT ON COLUMN "public"."profiles"."is_company" IS 'Creator sells as a company (chosen at signup) → gets org.nr verification + company receipt/MoR path.';



COMMENT ON COLUMN "public"."profiles"."locale" IS 'UI language this person reads the app in (sv|en|es); null = fall back to English.';



CREATE TABLE IF NOT EXISTS "public"."promo_code_uses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "promo_code_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "used_for" "text" NOT NULL,
    "reference_id" "text",
    "discount_amount" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "promo_code_uses_used_for_check" CHECK (("used_for" = ANY (ARRAY['subscription'::"text", 'ticket'::"text"])))
);


ALTER TABLE "public"."promo_code_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "discount_type" "text" DEFAULT 'percent'::"text" NOT NULL,
    "discount_value" numeric NOT NULL,
    "scope" "text" DEFAULT 'both'::"text" NOT NULL,
    "allowed_plans" "text"[],
    "max_uses" integer,
    "current_uses" integer DEFAULT 0,
    "max_uses_per_user" integer DEFAULT 1,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "stripe_coupon_id" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "promo_codes_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "promo_codes_discount_value_check" CHECK (("discount_value" > (0)::numeric)),
    CONSTRAINT "promo_codes_scope_check" CHECK (("scope" = ANY (ARRAY['subscription'::"text", 'ticket'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."promo_codes" IS 'Rabattkoder. Läsbara under RLS endast för sin egen skapare; inlösen och validering går via service-role i src/lib/promo/validate.ts.';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locale" "text"
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."push_subscriptions"."locale" IS 'UI language this device subscribed in (sv|en|es); null = fall back to English.';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."reviews" IS 'Customer reviews for completed bookings';



CREATE TABLE IF NOT EXISTS "public"."rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name_sv" "text" NOT NULL,
    "description_sv" "text" NOT NULL,
    "reward_type" "text" NOT NULL,
    "required_level" integer NOT NULL,
    "icon" "text",
    "discount_percent" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rewards_reward_type_check" CHECK (("reward_type" = ANY (ARRAY['badge'::"text", 'discount'::"text", 'early_access'::"text", 'feature'::"text"])))
);


ALTER TABLE "public"."rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_processed_stripe_events" (
    "event_id" "text" NOT NULL,
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_processed_stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "instagram_user_id" "text",
    "instagram_username" "text",
    "instagram_access_token" "text",
    "facebook_page_id" "text",
    "facebook_page_name" "text",
    "facebook_page_access_token" "text",
    "tiktok_user_id" "text",
    "tiktok_username" "text",
    "tiktok_access_token" "text",
    "tiktok_refresh_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "facebook_user_id" "text",
    "instagram_token_expires_at" timestamp with time zone,
    "facebook_token_expires_at" timestamp with time zone,
    "tiktok_token_expires_at" timestamp with time zone,
    "tiktok_refresh_token_expires_at" timestamp with time zone
);


ALTER TABLE "public"."social_connections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."social_connections"."instagram_token_expires_at" IS 'När instagram_access_token slutar gälla. IG long-lived = 60 dagar. NULL = okänd/ingen utgång.';



COMMENT ON COLUMN "public"."social_connections"."facebook_token_expires_at" IS 'När facebook_page_access_token slutar gälla. NULL = ingen utgång (sidtoken från long-lived användartoken).';



COMMENT ON COLUMN "public"."social_connections"."tiktok_token_expires_at" IS 'När tiktok_access_token slutar gälla. TikTok access token = 24h, förnyas via tiktok_refresh_token.';



COMMENT ON COLUMN "public"."social_connections"."tiktok_refresh_token_expires_at" IS 'När tiktok_refresh_token slutar gälla (~365 dagar). Avgör om kopplingen lever; access-tokenet förnyas automatiskt.';



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan" "text" NOT NULL,
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['publik_guld'::"text", 'publik_premium'::"text", 'kreator_guld'::"text", 'kreator_premium'::"text", 'upplevelse_guld'::"text", 'upplevelse_premium'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'past_due'::"text", 'trialing'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "idx" integer NOT NULL,
    "name" "text",
    "checked_in_at" timestamp with time zone,
    "scanned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ticket_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" integer DEFAULT 0 NOT NULL,
    "capacity" integer,
    "tickets_sold" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_types_capacity_check" CHECK ((("capacity" IS NULL) OR ("capacity" > 0))),
    CONSTRAINT "ticket_types_price_check" CHECK (("price" >= 0)),
    CONSTRAINT "ticket_types_tickets_sold_check" CHECK (("tickets_sold" >= 0))
);


ALTER TABLE "public"."ticket_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "tipper_email" "text",
    "amount_ore" integer NOT NULL,
    "message" "text",
    "stripe_session_id" "text",
    "status" "text" DEFAULT 'paid'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tips_amount_ore_check" CHECK (("amount_ore" > 0))
);


ALTER TABLE "public"."tips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."token_ledger" (
    "id" bigint NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."token_ledger" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."token_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."token_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."token_ledger_id_seq" OWNED BY "public"."token_ledger"."id";



CREATE TABLE IF NOT EXISTS "public"."training_buddy_profiles" (
    "profile_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "dance_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "style_levels" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "buddy_role" "text" DEFAULT 'both'::"text" NOT NULL,
    "availability" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "city" "text",
    "lat" double precision,
    "lon" double precision,
    "radius_km" integer DEFAULT 25 NOT NULL,
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agreed_adult" boolean DEFAULT false NOT NULL,
    CONSTRAINT "training_buddy_profiles_bio_check" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 500))),
    CONSTRAINT "training_buddy_profiles_buddy_role_check" CHECK (("buddy_role" = ANY (ARRAY['leader'::"text", 'follower'::"text", 'both'::"text"]))),
    CONSTRAINT "training_buddy_profiles_radius_km_check" CHECK ((("radius_km" >= 1) AND ("radius_km" <= 500)))
);


ALTER TABLE "public"."training_buddy_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_points" (
    "user_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "current_level" integer DEFAULT 1 NOT NULL,
    "points_this_week" integer DEFAULT 0 NOT NULL,
    "points_this_month" integer DEFAULT 0 NOT NULL,
    "week_start" "date" DEFAULT ("date_trunc"('week'::"text", "now"()))::"date" NOT NULL,
    "month_start" "date" DEFAULT ("date_trunc"('month'::"text", "now"()))::"date" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text", 'actioned'::"text"])))
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_id" "uuid" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "notif_booking_new" boolean DEFAULT true NOT NULL,
    "notif_booking_confirmed" boolean DEFAULT true NOT NULL,
    "notif_booking_canceled" boolean DEFAULT true NOT NULL,
    "notif_payout" boolean DEFAULT true NOT NULL,
    "notif_marketing" boolean DEFAULT false NOT NULL,
    "privacy_public_profile" boolean DEFAULT true NOT NULL,
    "privacy_show_location" boolean DEFAULT true NOT NULL,
    "privacy_show_reviews" boolean DEFAULT true NOT NULL,
    "privacy_booking_history" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notif_creator_events" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_settings" IS 'User notification and privacy preferences';



CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "place_id" "text",
    "lat" double precision,
    "lng" double precision,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE ONLY "public"."archived_deleted_rows" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."archived_deleted_rows_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."token_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."token_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_capabilities"
    ADD CONSTRAINT "admin_capabilities_pkey" PRIMARY KEY ("user_id", "capability");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."archived_deleted_rows"
    ADD CONSTRAINT "archived_deleted_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bastu_interest"
    ADD CONSTRAINT "bastu_interest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_queue"
    ADD CONSTRAINT "booking_queue_listing_id_user_id_key" UNIQUE ("listing_id", "user_id");



ALTER TABLE ONLY "public"."booking_queue"
    ADD CONSTRAINT "booking_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_likes"
    ADD CONSTRAINT "buddy_likes_from_user_to_user_key" UNIQUE ("from_user", "to_user");



ALTER TABLE ONLY "public"."buddy_likes"
    ADD CONSTRAINT "buddy_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_matches"
    ADD CONSTRAINT "buddy_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_matches"
    ADD CONSTRAINT "buddy_matches_user_a_user_b_key" UNIQUE ("user_a", "user_b");



ALTER TABLE ONLY "public"."capability_unlocks"
    ADD CONSTRAINT "capability_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborator_invites"
    ADD CONSTRAINT "collaborator_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborator_invites"
    ADD CONSTRAINT "collaborator_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."collaborator_payment_requests"
    ADD CONSTRAINT "collaborator_payment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_a_participant_b_key" UNIQUE ("participant_a", "participant_b");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_availability"
    ADD CONSTRAINT "creator_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_media"
    ADD CONSTRAINT "creator_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_promo_codes"
    ADD CONSTRAINT "creator_promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."creator_promo_codes"
    ADD CONSTRAINT "creator_promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."csp_reports"
    ADD CONSTRAINT "csp_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_confirmation_code_key" UNIQUE ("confirmation_code");



ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_product_content"
    ADD CONSTRAINT "digital_product_content_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_purchases"
    ADD CONSTRAINT "digital_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_purchases"
    ADD CONSTRAINT "digital_purchases_product_id_buyer_id_key" UNIQUE ("product_id", "buyer_id");



ALTER TABLE ONLY "public"."email_broadcasts"
    ADD CONSTRAINT "email_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_access_codes"
    ADD CONSTRAINT "event_access_codes_listing_code_key" UNIQUE ("listing_id", "code");



ALTER TABLE ONLY "public"."event_access_codes"
    ADD CONSTRAINT "event_access_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_instructors"
    ADD CONSTRAINT "event_instructors_listing_id_instructor_id_key" UNIQUE ("listing_id", "instructor_id");



ALTER TABLE ONLY "public"."event_instructors"
    ADD CONSTRAINT "event_instructors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_listing_email_key" UNIQUE ("listing_id", "email");



ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_listing_id_key" UNIQUE ("user_id", "listing_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_followed_id_key" UNIQUE ("follower_id", "followed_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gage_agreements"
    ADD CONSTRAINT "gage_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gig_applications"
    ADD CONSTRAINT "gig_applications_gig_id_applicant_id_key" UNIQUE ("gig_id", "applicant_id");



ALTER TABLE ONLY "public"."gig_applications"
    ADD CONSTRAINT "gig_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gigs"
    ADD CONSTRAINT "gigs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_collaborators"
    ADD CONSTRAINT "listing_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_collaborators"
    ADD CONSTRAINT "listing_collaborators_unique" UNIQUE ("listing_id", "user_id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ob_bookings"
    ADD CONSTRAINT "ob_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ob_creator_profiles"
    ADD CONSTRAINT "ob_creator_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ob_dac7_records"
    ADD CONSTRAINT "ob_dac7_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ob_dac7_records"
    ADD CONSTRAINT "ob_dac7_records_seller_id_quarter_year_key" UNIQUE ("seller_id", "quarter", "year");



ALTER TABLE ONLY "public"."ob_payouts"
    ADD CONSTRAINT "ob_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ob_track_changes"
    ADD CONSTRAINT "ob_track_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ob_users"
    ADD CONSTRAINT "ob_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ob_venue_profiles"
    ADD CONSTRAINT "ob_venue_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."openclaw_tasks"
    ADD CONSTRAINT "openclaw_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stripe_payment_id_key" UNIQUE ("stripe_payment_id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_events"
    ADD CONSTRAINT "point_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_preferences"
    ADD CONSTRAINT "profile_preferences_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_code_uses"
    ADD CONSTRAINT "promo_code_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_code_uses"
    ADD CONSTRAINT "promo_code_uses_promo_code_id_user_id_reference_id_key" UNIQUE ("promo_code_id", "user_id", "reference_id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."shop_processed_stripe_events"
    ADD CONSTRAINT "shop_processed_stripe_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."ticket_attendees"
    ADD CONSTRAINT "ticket_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_stripe_session_id_key" UNIQUE ("stripe_session_id");



ALTER TABLE ONLY "public"."token_ledger"
    ADD CONSTRAINT "token_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_buddy_profiles"
    ADD CONSTRAINT "training_buddy_profiles_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_points"
    ADD CONSTRAINT "user_points_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_user_id_reward_id_key" UNIQUE ("user_id", "reward_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_place_id_key" UNIQUE ("place_id");



CREATE UNIQUE INDEX "bastu_interest_site_email_idx" ON "public"."bastu_interest" USING "btree" ("site_slug", "lower"("email"));



CREATE INDEX "bastu_interest_site_idx" ON "public"."bastu_interest" USING "btree" ("site_slug");



CREATE UNIQUE INDEX "bookings_free_ticket_customer_key" ON "public"."bookings" USING "btree" ("listing_id", "customer_id") WHERE (("booking_type" = 'ticket'::"text") AND ("amount_paid" = 0) AND ("customer_id" IS NOT NULL) AND ("status" <> 'canceled'::"text"));



CREATE UNIQUE INDEX "bookings_stripe_payment_id_key" ON "public"."bookings" USING "btree" ("stripe_payment_id") WHERE ("stripe_payment_id" IS NOT NULL);



CREATE INDEX "capability_unlocks_listing_idx" ON "public"."capability_unlocks" USING "btree" ("listing_id");



CREATE INDEX "capability_unlocks_profile_idx" ON "public"."capability_unlocks" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "capability_unlocks_uniq" ON "public"."capability_unlocks" USING "btree" ("profile_id", "capability", "listing_id") NULLS NOT DISTINCT;



CREATE INDEX "collaborator_invites_invited_user_id_idx" ON "public"."collaborator_invites" USING "btree" ("invited_user_id") WHERE ("invited_user_id" IS NOT NULL);



CREATE INDEX "csp_reports_created_at_idx" ON "public"."csp_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "csp_reports_directive_idx" ON "public"."csp_reports" USING "btree" ("effective_directive");



CREATE INDEX "email_broadcasts_listing_idx" ON "public"."email_broadcasts" USING "btree" ("listing_id", "created_at" DESC);



CREATE INDEX "event_access_codes_listing_idx" ON "public"."event_access_codes" USING "btree" ("listing_id");



CREATE INDEX "event_waitlist_listing_idx" ON "public"."event_waitlist" USING "btree" ("listing_id");



CREATE INDEX "event_waitlist_release_pending_idx" ON "public"."event_waitlist" USING "btree" ("listing_id") WHERE (("released_notified_at" IS NULL) AND ("unsubscribed_at" IS NULL));



CREATE UNIQUE INDEX "gage_active_unique" ON "public"."gage_agreements" USING "btree" ("listing_id", "collaborator_user_id") WHERE ("status" = ANY (ARRAY['proposed'::"text", 'agreed'::"text"]));



CREATE INDEX "gage_collaborator_idx" ON "public"."gage_agreements" USING "btree" ("collaborator_user_id");



CREATE INDEX "gage_listing_idx" ON "public"."gage_agreements" USING "btree" ("listing_id");



CREATE INDEX "idx_admin_capabilities_user" ON "public"."admin_capabilities" USING "btree" ("user_id");



CREATE INDEX "idx_booking_queue_listing" ON "public"."booking_queue" USING "btree" ("listing_id", "position");



CREATE INDEX "idx_bookings_creator" ON "public"."bookings" USING "btree" ("creator_id", "created_at" DESC);



CREATE INDEX "idx_bookings_customer" ON "public"."bookings" USING "btree" ("customer_id", "scheduled_at");



CREATE INDEX "idx_bookings_reminder_pending" ON "public"."bookings" USING "btree" ("scheduled_at") WHERE (("reminder_sent_at" IS NULL) AND ("status" = 'confirmed'::"text"));



CREATE INDEX "idx_bookings_reminder_soon_pending" ON "public"."bookings" USING "btree" ("scheduled_at") WHERE (("reminder_soon_sent_at" IS NULL) AND ("status" = 'confirmed'::"text"));



CREATE INDEX "idx_bookings_stripe_payment" ON "public"."bookings" USING "btree" ("stripe_payment_id") WHERE ("stripe_payment_id" IS NOT NULL);



CREATE INDEX "idx_buddy_active" ON "public"."training_buddy_profiles" USING "btree" ("is_active") WHERE "is_active";



CREATE INDEX "idx_buddy_likes_from" ON "public"."buddy_likes" USING "btree" ("from_user");



CREATE INDEX "idx_buddy_likes_to" ON "public"."buddy_likes" USING "btree" ("to_user");



CREATE INDEX "idx_buddy_matches_a" ON "public"."buddy_matches" USING "btree" ("user_a");



CREATE INDEX "idx_buddy_matches_b" ON "public"."buddy_matches" USING "btree" ("user_b");



CREATE INDEX "idx_collaborator_invites_listing" ON "public"."collaborator_invites" USING "btree" ("listing_id");



CREATE INDEX "idx_collaborator_invites_token" ON "public"."collaborator_invites" USING "btree" ("token");



CREATE INDEX "idx_conversations_participant_a" ON "public"."conversations" USING "btree" ("participant_a", "last_message_at" DESC);



CREATE INDEX "idx_conversations_participant_b" ON "public"."conversations" USING "btree" ("participant_b", "last_message_at" DESC);



CREATE INDEX "idx_creator_availability_user_date" ON "public"."creator_availability" USING "btree" ("user_id", "available_date");



CREATE INDEX "idx_creator_media_user" ON "public"."creator_media" USING "btree" ("user_id", "sort_order");



CREATE INDEX "idx_creator_promo_code" ON "public"."creator_promo_codes" USING "btree" ("code");



CREATE INDEX "idx_creator_promo_creator" ON "public"."creator_promo_codes" USING "btree" ("creator_id");



CREATE INDEX "idx_data_deletion_requests_external_user" ON "public"."data_deletion_requests" USING "btree" ("provider", "external_user_id");



CREATE INDEX "idx_digital_products_creator" ON "public"."digital_products" USING "btree" ("creator_id");



CREATE INDEX "idx_event_instructors_listing" ON "public"."event_instructors" USING "btree" ("listing_id");



CREATE INDEX "idx_favorites_listing" ON "public"."favorites" USING "btree" ("listing_id");



CREATE INDEX "idx_favorites_user" ON "public"."favorites" USING "btree" ("user_id");



CREATE INDEX "idx_follows_followed" ON "public"."follows" USING "btree" ("followed_id");



CREATE INDEX "idx_follows_follower" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_gig_applications_applicant" ON "public"."gig_applications" USING "btree" ("applicant_id");



CREATE INDEX "idx_gig_applications_gig" ON "public"."gig_applications" USING "btree" ("gig_id");



CREATE INDEX "idx_gigs_arranger" ON "public"."gigs" USING "btree" ("arranger_id");



CREATE INDEX "idx_gigs_status_event_date" ON "public"."gigs" USING "btree" ("status", "event_date") WHERE ("status" = 'open'::"text");



CREATE INDEX "idx_listing_collaborators_listing" ON "public"."listing_collaborators" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_collaborators_user_status" ON "public"."listing_collaborators" USING "btree" ("user_id", "status");



CREATE INDEX "idx_listings_followers_notify_pending" ON "public"."listings" USING "btree" ("created_at") WHERE (("followers_notified_at" IS NULL) AND ("is_active" = true) AND ("listing_type" = 'event'::"text"));



CREATE INDEX "idx_listings_listing_type" ON "public"."listings" USING "btree" ("listing_type");



CREATE INDEX "idx_listings_promoted" ON "public"."listings" USING "btree" ("is_promoted", "promoted_until");



CREATE INDEX "idx_listings_public" ON "public"."listings" USING "btree" ("is_active", "is_public") WHERE ("is_active" AND "is_public");



CREATE INDEX "idx_listings_series_id" ON "public"."listings" USING "btree" ("series_id") WHERE ("series_id" IS NOT NULL);



CREATE INDEX "idx_listings_series_slug" ON "public"."listings" USING "btree" ("series_slug") WHERE ("series_slug" IS NOT NULL);



CREATE UNIQUE INDEX "idx_listings_slug" ON "public"."listings" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_listings_user" ON "public"."listings" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_unread" ON "public"."messages" USING "btree" ("conversation_id", "is_read") WHERE (NOT "is_read");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_openclaw_tasks_created_at" ON "public"."openclaw_tasks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_openclaw_tasks_priority" ON "public"."openclaw_tasks" USING "btree" ("priority");



CREATE INDEX "idx_openclaw_tasks_status" ON "public"."openclaw_tasks" USING "btree" ("status");



CREATE INDEX "idx_payment_requests_collab_status" ON "public"."collaborator_payment_requests" USING "btree" ("collaborator_id", "status");



CREATE INDEX "idx_payouts_creator" ON "public"."payouts" USING "btree" ("creator_id", "created_at" DESC);



CREATE INDEX "idx_payouts_status" ON "public"."payouts" USING "btree" ("status") WHERE (("status")::"text" <> 'paid'::"text");



CREATE INDEX "idx_point_events_source" ON "public"."point_events" USING "btree" ("source_type", "source_id");



CREATE UNIQUE INDEX "idx_point_events_unique_source" ON "public"."point_events" USING "btree" ("user_id", "action", "source_id") WHERE ("source_id" IS NOT NULL);



CREATE INDEX "idx_point_events_user" ON "public"."point_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_post_likes_post_id" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_profiles_bankid_personal_number" ON "public"."profiles" USING "btree" ("bankid_personal_number") WHERE ("bankid_personal_number" IS NOT NULL);



CREATE INDEX "idx_profiles_calendar_sync_token" ON "public"."profiles" USING "btree" ("calendar_sync_token") WHERE ("calendar_sync_token" IS NOT NULL);



CREATE INDEX "idx_profiles_creator_subcategory" ON "public"."profiles" USING "btree" ("creator_subcategory") WHERE ("creator_subcategory" <> 'general'::"text");



CREATE INDEX "idx_profiles_offers_coaching" ON "public"."profiles" USING "btree" ("offers_coaching") WHERE ("offers_coaching" = true);



CREATE UNIQUE INDEX "idx_profiles_referral_code" ON "public"."profiles" USING "btree" ("referral_code") WHERE ("referral_code" IS NOT NULL);



CREATE INDEX "idx_promo_codes_code" ON "public"."promo_codes" USING "btree" ("code") WHERE ("is_active" = true);



CREATE INDEX "idx_push_subs_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_reviews_creator" ON "public"."reviews" USING "btree" ("creator_id");



CREATE INDEX "idx_reviews_listing" ON "public"."reviews" USING "btree" ("listing_id");



CREATE INDEX "idx_reviews_reviewer" ON "public"."reviews" USING "btree" ("reviewer_id");



CREATE INDEX "idx_social_connections_facebook_user_id" ON "public"."social_connections" USING "btree" ("facebook_user_id") WHERE ("facebook_user_id" IS NOT NULL);



CREATE INDEX "idx_ticket_attendees_booking" ON "public"."ticket_attendees" USING "btree" ("booking_id");



CREATE INDEX "idx_ticket_types_listing" ON "public"."ticket_types" USING "btree" ("listing_id");



CREATE INDEX "idx_user_blocks_blocked" ON "public"."user_blocks" USING "btree" ("blocked_id");



CREATE INDEX "idx_user_blocks_blocker" ON "public"."user_blocks" USING "btree" ("blocker_id");



CREATE INDEX "idx_user_reports_status" ON "public"."user_reports" USING "btree" ("status");



CREATE INDEX "idx_venues_city" ON "public"."venues" USING "btree" ("city");



CREATE INDEX "profile_preferences_city_idx" ON "public"."profile_preferences" USING "btree" ("lower"("city"));



CREATE INDEX "profiles_slug_idx" ON "public"."profiles" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_slug_unique" ON "public"."profiles" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "tips_recipient_idx" ON "public"."tips" USING "btree" ("recipient_id", "created_at" DESC);



CREATE UNIQUE INDEX "token_ledger_allowance_uq" ON "public"."token_ledger" USING "btree" ("ref") WHERE ("reason" = 'allowance'::"text");



CREATE INDEX "token_ledger_profile_idx" ON "public"."token_ledger" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "token_ledger_purchase_uq" ON "public"."token_ledger" USING "btree" ("ref") WHERE ("reason" = 'purchase'::"text");



CREATE INDEX "token_ledger_ref_idx" ON "public"."token_ledger" USING "btree" ("ref");



CREATE UNIQUE INDEX "unique_availability_slot" ON "public"."creator_availability" USING "btree" ("user_id", "available_date", COALESCE("start_time", '00:00:00'::time without time zone));



CREATE UNIQUE INDEX "uq_payments_stripe_payment_id" ON "public"."payments" USING "btree" ("stripe_payment_id") WHERE ("stripe_payment_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "openclaw_tasks_updated_at" BEFORE UPDATE ON "public"."openclaw_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_openclaw_tasks_updated_at"();



CREATE OR REPLACE TRIGGER "protect_profile_privileged_columns_trigger" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_privileged_columns"();



CREATE OR REPLACE TRIGGER "require_bankid_for_public_creator_trigger" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."require_bankid_for_public_creator"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."payouts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."promo_codes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."social_connections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."admin_capabilities"
    ADD CONSTRAINT "admin_capabilities_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_capabilities"
    ADD CONSTRAINT "admin_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_queue"
    ADD CONSTRAINT "booking_queue_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_queue"
    ADD CONSTRAINT "booking_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_likes"
    ADD CONSTRAINT "buddy_likes_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_likes"
    ADD CONSTRAINT "buddy_likes_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_matches"
    ADD CONSTRAINT "buddy_matches_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_matches"
    ADD CONSTRAINT "buddy_matches_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capability_unlocks"
    ADD CONSTRAINT "capability_unlocks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capability_unlocks"
    ADD CONSTRAINT "capability_unlocks_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_invites"
    ADD CONSTRAINT "collaborator_invites_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collaborator_invites"
    ADD CONSTRAINT "collaborator_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_invites"
    ADD CONSTRAINT "collaborator_invites_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_invites"
    ADD CONSTRAINT "collaborator_invites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_payment_requests"
    ADD CONSTRAINT "collaborator_payment_requests_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."listing_collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_a_fkey" FOREIGN KEY ("participant_a") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_b_fkey" FOREIGN KEY ("participant_b") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_availability"
    ADD CONSTRAINT "creator_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_media"
    ADD CONSTRAINT "creator_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_promo_codes"
    ADD CONSTRAINT "creator_promo_codes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_product_content"
    ADD CONSTRAINT "digital_product_content_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_products"
    ADD CONSTRAINT "digital_products_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_purchases"
    ADD CONSTRAINT "digital_purchases_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_purchases"
    ADD CONSTRAINT "digital_purchases_creator_promo_id_fkey" FOREIGN KEY ("creator_promo_id") REFERENCES "public"."creator_promo_codes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."digital_purchases"
    ADD CONSTRAINT "digital_purchases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_broadcasts"
    ADD CONSTRAINT "email_broadcasts_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_broadcasts"
    ADD CONSTRAINT "email_broadcasts_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_access_codes"
    ADD CONSTRAINT "event_access_codes_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_instructors"
    ADD CONSTRAINT "event_instructors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_instructors"
    ADD CONSTRAINT "event_instructors_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gage_agreements"
    ADD CONSTRAINT "gage_agreements_collaborator_user_id_fkey" FOREIGN KEY ("collaborator_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gage_agreements"
    ADD CONSTRAINT "gage_agreements_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gage_agreements"
    ADD CONSTRAINT "gage_agreements_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gig_applications"
    ADD CONSTRAINT "gig_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gig_applications"
    ADD CONSTRAINT "gig_applications_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gigs"
    ADD CONSTRAINT "gigs_arranger_id_fkey" FOREIGN KEY ("arranger_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_collaborators"
    ADD CONSTRAINT "listing_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listing_collaborators"
    ADD CONSTRAINT "listing_collaborators_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_collaborators"
    ADD CONSTRAINT "listing_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ob_bookings"
    ADD CONSTRAINT "ob_bookings_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."ob_users"("id");



ALTER TABLE ONLY "public"."ob_bookings"
    ADD CONSTRAINT "ob_bookings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."ob_users"("id");



ALTER TABLE ONLY "public"."ob_creator_profiles"
    ADD CONSTRAINT "ob_creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ob_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ob_dac7_records"
    ADD CONSTRAINT "ob_dac7_records_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."ob_users"("id");



ALTER TABLE ONLY "public"."ob_payouts"
    ADD CONSTRAINT "ob_payouts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."ob_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ob_track_changes"
    ADD CONSTRAINT "ob_track_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ob_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ob_users"
    ADD CONSTRAINT "ob_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ob_venue_profiles"
    ADD CONSTRAINT "ob_venue_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ob_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."point_events"
    ADD CONSTRAINT "point_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_preferences"
    ADD CONSTRAINT "profile_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."promo_code_uses"
    ADD CONSTRAINT "promo_code_uses_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_code_uses"
    ADD CONSTRAINT "promo_code_uses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_attendees"
    ADD CONSTRAINT "ticket_attendees_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_attendees"
    ADD CONSTRAINT "ticket_attendees_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_ledger"
    ADD CONSTRAINT "token_ledger_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_buddy_profiles"
    ADD CONSTRAINT "training_buddy_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_points"
    ADD CONSTRAINT "user_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Active listings are viewable" ON "public"."listings" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active products" ON "public"."digital_products" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active promo codes" ON "public"."creator_promo_codes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active rewards" ON "public"."rewards" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view follow counts" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Anyone can view media" ON "public"."creator_media" FOR SELECT USING (true);



CREATE POLICY "Anyone can view post likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view posts" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Anyone can view reviews" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can view user points" ON "public"."user_points" FOR SELECT USING (true);



CREATE POLICY "Anyone can view venues" ON "public"."venues" FOR SELECT USING (true);



CREATE POLICY "Anyone reads open gigs" ON "public"."gigs" FOR SELECT USING ((("status" = 'open'::"text") OR ("arranger_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Authors can delete own posts" ON "public"."posts" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authors can update own posts" ON "public"."posts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Availability is publicly readable" ON "public"."creator_availability" FOR SELECT USING (true);



CREATE POLICY "Buyers can view own purchases" ON "public"."digital_purchases" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "buyer_id"));



CREATE POLICY "Cleared sellers manage own listings" ON "public"."listings" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND "public"."is_bankid_cleared"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['creator'::"text", 'kreator'::"text", 'venue'::"text", 'upplevelse'::"text", 'experience'::"text"]))))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND "public"."is_bankid_cleared"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['creator'::"text", 'kreator'::"text", 'venue'::"text", 'upplevelse'::"text", 'experience'::"text"])))))));



CREATE POLICY "Cleared taxi dancer applies" ON "public"."gig_applications" FOR INSERT WITH CHECK ((("applicant_id" = "auth"."uid"()) AND "public"."is_bankid_cleared"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'creator'::"text") AND ("p"."creator_subcategory" = 'taxi_dancer'::"text"))))));



CREATE POLICY "Cleared venue manages own gigs" ON "public"."gigs" USING ((("arranger_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_bankid_cleared"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['venue'::"text", 'experience'::"text", 'upplevelse'::"text"]))))))) WITH CHECK ((("arranger_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_bankid_cleared"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['venue'::"text", 'experience'::"text", 'upplevelse'::"text"])))))));



CREATE POLICY "Creators and venues can create posts" ON "public"."posts" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['creator'::"text", 'venue'::"text", 'kreator'::"text", 'experience'::"text", 'upplevelse'::"text"])))))));



CREATE POLICY "Creators can manage own products" ON "public"."digital_products" USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Creators can manage own promo codes" ON "public"."creator_promo_codes" USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Creators can update bookings" ON "public"."bookings" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Creators can view own payouts" ON "public"."payouts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Creators can view queue for their listings" ON "public"."booking_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."listings"
  WHERE (("listings"."id" = "booking_queue"."listing_id") AND ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Creators can view sales of own products" ON "public"."digital_purchases" FOR SELECT USING (("product_id" IN ( SELECT "digital_products"."id"
   FROM "public"."digital_products"
  WHERE ("digital_products"."creator_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Customers can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Eligible instructor joins open event" ON "public"."event_instructors" FOR INSERT WITH CHECK ((("instructor_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_bankid_cleared"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['creator'::"text", 'kreator'::"text"])) AND ("p"."offers_coaching" = true) AND ("p"."coaching_hourly_rate_sek" IS NOT NULL) AND ("p"."coaching_hourly_rate_sek" > 0) AND ("p"."stripe_account_id" IS NOT NULL) AND (("p"."tier")::"text" = ANY ((ARRAY['guld'::character varying, 'premium'::character varying])::"text"[]))))) AND (EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_instructors"."listing_id") AND ("l"."is_active" = true) AND ("l"."open_to_instructors" = true))))));



CREATE POLICY "Hosts manage own access codes" ON "public"."event_access_codes" USING ((EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_access_codes"."listing_id") AND ("l"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_access_codes"."listing_id") AND ("l"."user_id" = "auth"."uid"())))));



CREATE POLICY "Hosts read own broadcasts" ON "public"."email_broadcasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "email_broadcasts"."listing_id") AND ("l"."user_id" = "auth"."uid"())))));



CREATE POLICY "Hosts read own event waitlist" ON "public"."event_waitlist" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_waitlist"."listing_id") AND ("l"."user_id" = "auth"."uid"())))));



CREATE POLICY "Instructor or host removes instructor row" ON "public"."event_instructors" FOR DELETE USING ((("instructor_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_instructors"."listing_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Owner full access" ON "public"."openclaw_tasks" USING (("created_by" = 'pabloacostagomez_84556'::"text"));



CREATE POLICY "Public profiles are viewable" ON "public"."profiles" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Read instructors of open events" ON "public"."event_instructors" FOR SELECT USING ((("instructor_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_instructors"."listing_id") AND ("l"."is_active" = true) AND ("l"."open_to_instructors" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "event_instructors"."listing_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Read own applications" ON "public"."gig_applications" FOR SELECT USING ((("applicant_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."gigs" "g"
  WHERE (("g"."id" = "gig_applications"."gig_id") AND ("g"."arranger_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Recipients can mark messages as read" ON "public"."messages" FOR UPDATE USING ((("sender_id" <> ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("c"."participant_b" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Service role manages bookings" ON "public"."bookings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Update own application or applications to own gig" ON "public"."gig_applications" FOR UPDATE USING ((("applicant_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."gigs" "g"
  WHERE (("g"."id" = "gig_applications"."gig_id") AND ("g"."arranger_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((("applicant_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."gigs" "g"
  WHERE (("g"."id" = "gig_applications"."gig_id") AND ("g"."arranger_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can add favorites" ON "public"."favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add own availability" ON "public"."creator_availability" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create conversations" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() = "participant_a") OR ("auth"."uid"() = "participant_b")));



CREATE POLICY "Users can create reviews for their completed bookings" ON "public"."reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own social connections" ON "public"."social_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own reports" ON "public"."user_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can join queue" ON "public"."booking_queue" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can leave queue" ON "public"."booking_queue" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can like posts" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own follows" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can manage own media" ON "public"."creator_media" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own blocks" ON "public"."user_blocks" USING ((( SELECT "auth"."uid"() AS "uid") = "blocker_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



CREATE POLICY "Users can read their own promo codes" ON "public"."promo_codes" FOR SELECT USING ((("is_active" = true) AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can record own promo usage" ON "public"."promo_code_uses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove own availability" ON "public"."creator_availability" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can remove own favorites" ON "public"."favorites" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can send messages in own conversations" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_a" = "auth"."uid"()) OR ("c"."participant_b" = "auth"."uid"())))))));



CREATE POLICY "Users can unfollow" ON "public"."follows" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Users can unlike posts" ON "public"."post_likes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "participant_a") OR (( SELECT "auth"."uid"() AS "uid") = "participant_b")));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own reviews" ON "public"."reviews" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "reviewer_id"));



CREATE POLICY "Users can update own settings" ON "public"."user_settings" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own social connections" ON "public"."social_connections" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can upsert own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view messages in own conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("c"."participant_b" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view own bookings" ON "public"."bookings" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "creator_id") OR (( SELECT "auth"."uid"() AS "uid") = "customer_id")));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "participant_a") OR (( SELECT "auth"."uid"() AS "uid") = "participant_b")));



CREATE POLICY "Users can view own favorites" ON "public"."favorites" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own payments" ON "public"."payments" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own payouts" ON "public"."payouts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Users can view own point events" ON "public"."point_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own promo usage" ON "public"."promo_code_uses" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own queue entries" ON "public"."booking_queue" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own rewards" ON "public"."user_rewards" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own settings" ON "public"."user_settings" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own social connections" ON "public"."social_connections" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own reports" ON "public"."user_reports" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "reporter_id"));



ALTER TABLE "public"."admin_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archived_deleted_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bastu_interest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy profile own delete" ON "public"."training_buddy_profiles" FOR DELETE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "buddy profile own insert" ON "public"."training_buddy_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "buddy profile own select" ON "public"."training_buddy_profiles" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "buddy profile own update" ON "public"."training_buddy_profiles" FOR UPDATE USING (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."buddy_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_likes own insert" ON "public"."buddy_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "from_user"));



CREATE POLICY "buddy_likes own update" ON "public"."buddy_likes" FOR UPDATE USING (("auth"."uid"() = "from_user")) WITH CHECK (("auth"."uid"() = "from_user"));



CREATE POLICY "buddy_likes party select" ON "public"."buddy_likes" FOR SELECT USING ((("auth"."uid"() = "from_user") OR ("auth"."uid"() = "to_user")));



ALTER TABLE "public"."buddy_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_matches party select" ON "public"."buddy_matches" FOR SELECT USING ((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")));



CREATE POLICY "buyers read purchased content" ON "public"."digital_product_content" FOR SELECT USING (("product_id" IN ( SELECT "digital_purchases"."product_id"
   FROM "public"."digital_purchases"
  WHERE ("digital_purchases"."buyer_id" = "auth"."uid"()))));



ALTER TABLE "public"."capability_unlocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collab_delete_host" ON "public"."listing_collaborators" FOR DELETE USING (("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "collab_insert_host" ON "public"."listing_collaborators" FOR INSERT WITH CHECK (("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "collab_select_host_or_self" ON "public"."listing_collaborators" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "collab_update_host_remove" ON "public"."listing_collaborators" FOR UPDATE USING (("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "collab_update_self_accept_decline" ON "public"."listing_collaborators" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."collaborator_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_payment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "creator manages own content" ON "public"."digital_product_content" USING (("product_id" IN ( SELECT "digital_products"."id"
   FROM "public"."digital_products"
  WHERE ("digital_products"."creator_id" = "auth"."uid"())))) WITH CHECK (("product_id" IN ( SELECT "digital_products"."id"
   FROM "public"."digital_products"
  WHERE ("digital_products"."creator_id" = "auth"."uid"()))));



ALTER TABLE "public"."creator_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."csp_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."digital_product_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."digital_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."digital_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_access_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_instructors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gage_agreements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gage_insert_party" ON "public"."gage_agreements" FOR INSERT WITH CHECK ((("host_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("collaborator_user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "gage_select_party" ON "public"."gage_agreements" FOR SELECT USING ((("host_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("collaborator_user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "gage_update_party" ON "public"."gage_agreements" FOR UPDATE USING ((("host_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("collaborator_user_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("host_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("collaborator_user_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."gig_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gigs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invite_delete_host" ON "public"."collaborator_invites" FOR DELETE USING (("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "invite_insert_host" ON "public"."collaborator_invites" FOR INSERT WITH CHECK ((("invited_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "invite_select_host" ON "public"."collaborator_invites" FOR SELECT USING ((("invited_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "invite_update_host" ON "public"."collaborator_invites" FOR UPDATE USING ((("invited_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("listing_id" IN ( SELECT "listings"."id"
   FROM "public"."listings"
  WHERE ("listings"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."listing_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_creator_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_dac7_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_track_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ob_venue_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."openclaw_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own ledger read" ON "public"."token_ledger" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "own ob_creator_profile" ON "public"."ob_creator_profiles" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "own ob_track_changes read" ON "public"."ob_track_changes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "own ob_user" ON "public"."ob_users" TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "own ob_venue_profile" ON "public"."ob_venue_profiles" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "own prefs delete" ON "public"."profile_preferences" FOR DELETE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "own prefs insert" ON "public"."profile_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "own prefs select" ON "public"."profile_preferences" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "own prefs update" ON "public"."profile_preferences" FOR UPDATE USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "own push subscriptions" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "own unlocks read" ON "public"."capability_unlocks" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "party can read ob_booking" ON "public"."ob_bookings" FOR SELECT TO "authenticated" USING ((("venue_id" = "auth"."uid"()) OR ("creator_id" = "auth"."uid"())));



CREATE POLICY "party can read ob_payout" ON "public"."ob_payouts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ob_bookings" "b"
  WHERE (("b"."id" = "ob_payouts"."booking_id") AND (("b"."venue_id" = "auth"."uid"()) OR ("b"."creator_id" = "auth"."uid"()))))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payreq_insert_self" ON "public"."collaborator_payment_requests" FOR INSERT WITH CHECK (("collaborator_id" IN ( SELECT "listing_collaborators"."id"
   FROM "public"."listing_collaborators"
  WHERE (("listing_collaborators"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("listing_collaborators"."status" = 'accepted'::"text")))));



CREATE POLICY "payreq_select_self_or_host" ON "public"."collaborator_payment_requests" FOR SELECT USING ((("collaborator_id" IN ( SELECT "listing_collaborators"."id"
   FROM "public"."listing_collaborators"
  WHERE ("listing_collaborators"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("collaborator_id" IN ( SELECT "lc"."id"
   FROM ("public"."listing_collaborators" "lc"
     JOIN "public"."listings" "l" ON (("l"."id" = "lc"."listing_id")))
  WHERE ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "payreq_update_host_or_self" ON "public"."collaborator_payment_requests" FOR UPDATE USING ((("collaborator_id" IN ( SELECT "listing_collaborators"."id"
   FROM "public"."listing_collaborators"
  WHERE ("listing_collaborators"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("collaborator_id" IN ( SELECT "lc"."id"
   FROM ("public"."listing_collaborators" "lc"
     JOIN "public"."listings" "l" ON (("l"."id" = "lc"."listing_id")))
  WHERE ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."point_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_code_uses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rewards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "see own admin capabilities" ON "public"."admin_capabilities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "seller can read own ob_dac7" ON "public"."ob_dac7_records" FOR SELECT TO "authenticated" USING (("seller_id" = "auth"."uid"()));



ALTER TABLE "public"."shop_processed_stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_attendees read" ON "public"."ticket_attendees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "ticket_attendees"."booking_id") AND (("b"."creator_id" = "auth"."uid"()) OR ("b"."customer_id" = "auth"."uid"()))))));



ALTER TABLE "public"."ticket_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_types owner manage" ON "public"."ticket_types" USING ((EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "ticket_types"."listing_id") AND ("l"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."listings" "l"
  WHERE (("l"."id" = "ticket_types"."listing_id") AND ("l"."user_id" = "auth"."uid"())))));



CREATE POLICY "ticket_types public read" ON "public"."ticket_types" FOR SELECT USING (true);



ALTER TABLE "public"."tips" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tips_recipient_select" ON "public"."tips" FOR SELECT USING (("recipient_id" = "auth"."uid"()));



ALTER TABLE "public"."token_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_buddy_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_action" "text", "p_points" integer, "p_source_id" "uuid", "p_source_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_action" "text", "p_points" integer, "p_source_id" "uuid", "p_source_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_stripe_event"("p_event_id" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_stripe_event"("p_event_id" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_stripe_event"("p_event_id" "text", "p_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_access_code"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_access_code"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_admin_capabilities"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_admin_capabilities"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_admin_capabilities"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_admin_capabilities"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_creator_commission"("p_creator_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_creator_commission"("p_creator_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_creator_commission"("p_creator_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_monthly_allowance"("p_profile" "uuid", "p_amount" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_monthly_allowance"("p_profile" "uuid", "p_amount" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_stripe_connect"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_stripe_connect"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_stripe_connect"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_stripe_connect"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_creator_promo_uses"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_creator_promo_uses"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_promo_uses"("promo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_promo_uses"("promo_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_tickets_sold"("p_listing" "uuid", "p_n" integer, "p_ticket_type" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_tickets_sold"("p_listing" "uuid", "p_n" integer, "p_ticket_type" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_bankid_cleared"("uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_bankid_cleared"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_bankid_cleared"("uid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_bankid_cleared"("uid" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."is_current_user_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."min_rate"("rates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."min_rate"("rates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min_rate"("rates" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_privileged_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_privileged_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_access_code"("p_listing" "uuid", "p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_access_code"("p_listing" "uuid", "p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_access_code"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_access_code"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_stripe_event"("p_event_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."release_stripe_event"("p_event_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_stripe_event"("p_event_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."require_bankid_for_public_creator"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."require_bankid_for_public_creator"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_ticket"("p_listing" "uuid", "p_ticket_type" "uuid", "p_n" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_ticket"("p_listing" "uuid", "p_ticket_type" "uuid", "p_n" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_account"("p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_account"("p_user_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."unlock_capability"("p_profile" "uuid", "p_capability" "text", "p_listing" "uuid", "p_cost" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unlock_capability"("p_profile" "uuid", "p_capability" "text", "p_listing" "uuid", "p_cost" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_openclaw_tasks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_openclaw_tasks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_openclaw_tasks_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_storage_bytes"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_storage_bytes"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_storage_bytes"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_storage_bytes"("p_user" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."admin_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."admin_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."archived_deleted_rows" TO "anon";
GRANT ALL ON TABLE "public"."archived_deleted_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."archived_deleted_rows" TO "service_role";



GRANT ALL ON SEQUENCE "public"."archived_deleted_rows_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."archived_deleted_rows_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."archived_deleted_rows_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bastu_interest" TO "anon";
GRANT ALL ON TABLE "public"."bastu_interest" TO "authenticated";
GRANT ALL ON TABLE "public"."bastu_interest" TO "service_role";



GRANT ALL ON TABLE "public"."booking_queue" TO "anon";
GRANT ALL ON TABLE "public"."booking_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_queue" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_likes" TO "anon";
GRANT ALL ON TABLE "public"."buddy_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_likes" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_matches" TO "anon";
GRANT ALL ON TABLE "public"."buddy_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_matches" TO "service_role";



GRANT ALL ON TABLE "public"."capability_unlocks" TO "anon";
GRANT ALL ON TABLE "public"."capability_unlocks" TO "authenticated";
GRANT ALL ON TABLE "public"."capability_unlocks" TO "service_role";



GRANT ALL ON TABLE "public"."collaborator_invites" TO "anon";
GRANT ALL ON TABLE "public"."collaborator_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborator_invites" TO "service_role";



GRANT ALL ON TABLE "public"."collaborator_payment_requests" TO "anon";
GRANT ALL ON TABLE "public"."collaborator_payment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborator_payment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."creator_availability" TO "anon";
GRANT ALL ON TABLE "public"."creator_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_availability" TO "service_role";



GRANT ALL ON TABLE "public"."creator_media" TO "anon";
GRANT ALL ON TABLE "public"."creator_media" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_media" TO "service_role";



GRANT ALL ON TABLE "public"."creator_promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."creator_promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."csp_reports" TO "anon";
GRANT ALL ON TABLE "public"."csp_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."csp_reports" TO "service_role";



GRANT ALL ON TABLE "public"."data_deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."digital_product_content" TO "anon";
GRANT ALL ON TABLE "public"."digital_product_content" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_product_content" TO "service_role";



GRANT ALL ON TABLE "public"."digital_products" TO "anon";
GRANT ALL ON TABLE "public"."digital_products" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_products" TO "service_role";



GRANT ALL ON TABLE "public"."digital_purchases" TO "anon";
GRANT ALL ON TABLE "public"."digital_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."email_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."email_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."event_access_codes" TO "anon";
GRANT ALL ON TABLE "public"."event_access_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."event_access_codes" TO "service_role";



GRANT ALL ON TABLE "public"."event_instructors" TO "anon";
GRANT ALL ON TABLE "public"."event_instructors" TO "authenticated";
GRANT ALL ON TABLE "public"."event_instructors" TO "service_role";



GRANT ALL ON TABLE "public"."event_waitlist" TO "anon";
GRANT ALL ON TABLE "public"."event_waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."event_waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."gage_agreements" TO "anon";
GRANT ALL ON TABLE "public"."gage_agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."gage_agreements" TO "service_role";



GRANT ALL ON TABLE "public"."gig_applications" TO "anon";
GRANT ALL ON TABLE "public"."gig_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."gig_applications" TO "service_role";



GRANT ALL ON TABLE "public"."gigs" TO "anon";
GRANT ALL ON TABLE "public"."gigs" TO "authenticated";
GRANT ALL ON TABLE "public"."gigs" TO "service_role";



GRANT ALL ON TABLE "public"."listing_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."listing_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."ob_bookings" TO "anon";
GRANT ALL ON TABLE "public"."ob_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."ob_creator_profiles" TO "anon";
GRANT ALL ON TABLE "public"."ob_creator_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_creator_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."ob_dac7_records" TO "anon";
GRANT ALL ON TABLE "public"."ob_dac7_records" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_dac7_records" TO "service_role";



GRANT ALL ON TABLE "public"."ob_payouts" TO "anon";
GRANT ALL ON TABLE "public"."ob_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."ob_track_changes" TO "anon";
GRANT ALL ON TABLE "public"."ob_track_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_track_changes" TO "service_role";



GRANT ALL ON TABLE "public"."ob_users" TO "anon";
GRANT ALL ON TABLE "public"."ob_users" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_users" TO "service_role";



GRANT ALL ON TABLE "public"."ob_venue_profiles" TO "anon";
GRANT ALL ON TABLE "public"."ob_venue_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."ob_venue_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."openclaw_tasks" TO "anon";
GRANT ALL ON TABLE "public"."openclaw_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."openclaw_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."point_events" TO "anon";
GRANT ALL ON TABLE "public"."point_events" TO "authenticated";
GRANT ALL ON TABLE "public"."point_events" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profile_preferences" TO "anon";
GRANT ALL ON TABLE "public"."profile_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_preferences" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("bio") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("bio") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("website") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("website") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("category") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("category") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("location") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("location") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("hourly_rate") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("hourly_rate") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("is_public") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("is_public") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("tier") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("tier") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("facebook_page_id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("facebook_page_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("facebook_page_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("facebook_page_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("role") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("categories") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("categories") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("locations") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("locations") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("rates") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("rates") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("websites") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("websites") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("social_instagram") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("social_instagram") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("social_x") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("social_x") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("social_facebook") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("social_facebook") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("contact_email") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("contact_email") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("contact_phone") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("contact_phone") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("slug") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("slug") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_logo_url") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_logo_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_brand_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_brand_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_accent_color") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_accent_color") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_enabled") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_enabled") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_primary_color") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_primary_color") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_accent_color_2") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_accent_color_2") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("whitelabel_accent_color_3") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("whitelabel_accent_color_3") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("instagram_user_id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("instagram_user_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("instagram_username") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("instagram_username") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("tiktok_user_id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("tiktok_user_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("tiktok_username") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("tiktok_username") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("bankid_verified_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("bankid_verified_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("bankid_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("bankid_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("creator_subcategory") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("creator_subcategory") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("dance_styles") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("dance_styles") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("dance_languages") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("dance_languages") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("dance_experience_years") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("dance_experience_years") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("offers_coaching") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("offers_coaching") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("coaching_hourly_rate_sek") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("coaching_hourly_rate_sek") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("coaching_specialties") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("coaching_specialties") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("coaching_bio") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("coaching_bio") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("company_name") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("company_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("company_verified_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("company_verified_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("is_marketplace_verified") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("is_marketplace_verified") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."promo_code_uses" TO "anon";
GRANT ALL ON TABLE "public"."promo_code_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_code_uses" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."rewards" TO "anon";
GRANT ALL ON TABLE "public"."rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."rewards" TO "service_role";



GRANT ALL ON TABLE "public"."shop_processed_stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."shop_processed_stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_processed_stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."social_connections" TO "anon";
GRANT ALL ON TABLE "public"."social_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."social_connections" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_attendees" TO "anon";
GRANT ALL ON TABLE "public"."ticket_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_types" TO "anon";
GRANT ALL ON TABLE "public"."ticket_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_types" TO "service_role";



GRANT ALL ON TABLE "public"."tips" TO "anon";
GRANT ALL ON TABLE "public"."tips" TO "authenticated";
GRANT ALL ON TABLE "public"."tips" TO "service_role";



GRANT ALL ON TABLE "public"."token_ledger" TO "anon";
GRANT ALL ON TABLE "public"."token_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."token_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."token_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."token_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."token_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."training_buddy_profiles" TO "anon";
GRANT ALL ON TABLE "public"."training_buddy_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."training_buddy_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_points" TO "anon";
GRANT ALL ON TABLE "public"."user_points" TO "authenticated";
GRANT ALL ON TABLE "public"."user_points" TO "service_role";



GRANT ALL ON TABLE "public"."user_reports" TO "anon";
GRANT ALL ON TABLE "public"."user_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."user_reports" TO "service_role";



GRANT ALL ON TABLE "public"."user_rewards" TO "anon";
GRANT ALL ON TABLE "public"."user_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."user_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








--
-- Sandbox addendum: the trigger that creates a profile on signup.
--
-- `supabase db dump --schema public` captures handle_new_user() (it lives in
-- public) but NOT this trigger, because the trigger hangs off auth.users and
-- the auth schema is not dumped. Without it a locally created user has no
-- profile row, and every foreign key into profiles fails. Recreated here so the
-- sandbox behaves like production on signup.
--
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
