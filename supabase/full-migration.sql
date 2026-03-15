-- ==========================================
-- Usha Creators Platform - Full Consolidated Migration
-- Generated: 2026-03-15
--
-- This file combines ALL migrations into a single idempotent script
-- that can be safely run on a completely fresh Supabase database.
--
-- Final schema reflects the LATEST membership model:
--   Roles:  publik, kreator, upplevelse
--   Tiers:  gratis, guld, premium
--   Plans:  publik_guld, publik_premium, kreator_guld, kreator_premium,
--           upplevelse_guld, upplevelse_premium
--   Commission: gratis 15%, guld 8%, premium 3%
--
-- Source migrations (in order):
--   1.  supabase/migration.sql
--   2.  supabase/migrations/20260216_add_tiers_and_payouts.sql
--   3.  supabase/migrations/20260222_fix_constraints_and_add_columns.sql
--   4.  supabase/migrations/20260304_add_role_to_profiles.sql
--   5.  supabase/migrations/20260310_unified_membership.sql
--   6.  supabase/migrations/20260312_facebook_events.sql
--   7.  supabase/migration-stripe-checkout.sql
--   8.  supabase/migration-critical-fixes.sql
--   9.  supabase/migration-event-datetime.sql
--  10.  supabase/migration-event-images.sql
--  11.  supabase/migration-ticket-purchases.sql
--  12.  supabase/migration-reviews.sql
--  13.  supabase/migration-user-settings.sql
--  14.  supabase/migration-favorites.sql
--  15.  supabase/migration-notifications.sql
--  16.  supabase/migration-messages.sql
--  17.  supabase/migrations/20260315_cleanup_legacy_tiers.sql
-- ==========================================


-- ==========================================
-- SECTION 0: Extensions
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ==========================================
-- SECTION 1: PROFILES
-- ==========================================
-- Roles: publik (default), kreator, upplevelse
-- Tiers: gratis (default), guld, premium

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  category TEXT,                -- 'dance', 'music', 'photo', etc.
  location TEXT,
  hourly_rate INTEGER,
  role TEXT DEFAULT 'publik'
    CHECK (role IN ('publik', 'kreator', 'upplevelse')),
  tier TEXT DEFAULT 'gratis'
    CHECK (tier IN ('gratis', 'guld', 'premium')),
  is_public BOOLEAN DEFAULT false,
  stripe_account_id TEXT,       -- Stripe Connect Express account ID for payouts
  -- Facebook integration
  facebook_page_id TEXT,
  facebook_page_name TEXT,
  facebook_page_access_token TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (for databases where profiles was created by an earlier migration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'publik';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'gratis';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook_page_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT;

COMMENT ON COLUMN public.profiles.tier IS
  'Creator tier: gratis (15% commission), guld (8%), premium (3%)';
COMMENT ON COLUMN public.profiles.stripe_account_id IS
  'Stripe Connect Express account ID for creator payouts';


-- ==========================================
-- SECTION 2: SUBSCRIPTIONS
-- ==========================================
-- Plans follow the role_tier format (e.g. publik_guld, kreator_premium)

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL
    CHECK (plan IN (
      'publik_guld', 'publik_premium',
      'kreator_guld', 'kreator_premium',
      'upplevelse_guld', 'upplevelse_premium'
    )),
  status TEXT NOT NULL
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing'))
    DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ==========================================
-- SECTION 3: PAYMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL,      -- in ore (SEK cents)
  currency TEXT DEFAULT 'sek',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ==========================================
-- SECTION 4: LISTINGS (Creator services / events)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price INTEGER,                -- in SEK
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  -- Tier & early access
  event_tier VARCHAR(1) NOT NULL DEFAULT 'a'
    CHECK (event_tier IN ('a', 'b', 'c')),
  release_to_gold_at TIMESTAMPTZ,
  capacity INT,                 -- max bookings (NULL = unlimited)
  -- Event details
  event_date DATE,
  event_time TIME,
  event_location TEXT,
  image_url TEXT,
  -- Facebook integration
  facebook_event_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (for databases where listings was created by an earlier migration)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_tier VARCHAR(1) DEFAULT 'a';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS release_to_gold_at TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS capacity INT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_time TIME;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_location TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS facebook_event_id TEXT;

COMMENT ON COLUMN public.listings.event_tier IS
  'Dynamic discount tier: a = full price, b = moderate discount, c = max discount';
COMMENT ON COLUMN public.listings.release_to_gold_at IS
  'When this listing becomes available to Guld/Premium members (early access)';
COMMENT ON COLUMN public.listings.capacity IS
  'Maximum number of bookings for this listing (NULL = unlimited)';


-- ==========================================
-- SECTION 5: BOOKINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled'))
    DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  -- Ticket purchase fields
  stripe_payment_id TEXT,
  amount_paid INTEGER,
  booking_type TEXT DEFAULT 'manual'
    CHECK (booking_type IN ('manual', 'ticket')),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (for databases where bookings was created by an earlier migration)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount_paid INTEGER;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment
  ON public.bookings (stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;


-- ==========================================
-- SECTION 6: BOOKING QUEUE (Waitlist)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.booking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_booked BOOLEAN NOT NULL DEFAULT false,
  auto_booked_at TIMESTAMPTZ,
  UNIQUE (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_queue_listing
  ON public.booking_queue (listing_id, position);

COMMENT ON TABLE public.booking_queue IS
  'Waitlist queue for fully booked events. Auto-books when spots open.';


-- ==========================================
-- SECTION 7: PAYOUTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_gross DECIMAL(10,2) NOT NULL,
  amount_commission DECIMAL(10,2) NOT NULL,
  amount_net DECIMAL(10,2) NOT NULL,
  payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('batch', 'instant')),
  stripe_payout_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'paid', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  CHECK (amount_net = amount_gross - amount_commission),
  CHECK (amount_gross > 0),
  CHECK (amount_commission >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator
  ON public.payouts (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_status
  ON public.payouts (status) WHERE status != 'paid';

COMMENT ON TABLE public.payouts IS
  'Creator payout records. Commission based on tier: gratis 15%, guld 8%, premium 3%.';


-- ==========================================
-- SECTION 8: REVIEWS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_creator ON public.reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON public.reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);

COMMENT ON TABLE public.reviews IS 'Customer reviews for completed bookings';


-- ==========================================
-- SECTION 9: USER SETTINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  -- Notification preferences
  notif_booking_new BOOLEAN DEFAULT true NOT NULL,
  notif_booking_confirmed BOOLEAN DEFAULT true NOT NULL,
  notif_booking_canceled BOOLEAN DEFAULT true NOT NULL,
  notif_payout BOOLEAN DEFAULT true NOT NULL,
  notif_marketing BOOLEAN DEFAULT false NOT NULL,
  -- Privacy preferences
  privacy_public_profile BOOLEAN DEFAULT true NOT NULL,
  privacy_show_location BOOLEAN DEFAULT true NOT NULL,
  privacy_show_reviews BOOLEAN DEFAULT true NOT NULL,
  privacy_booking_history BOOLEAN DEFAULT false NOT NULL,
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.user_settings IS 'User notification and privacy preferences';


-- ==========================================
-- SECTION 10: FAVORITES / WISHLIST
-- ==========================================

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON public.favorites(listing_id);

COMMENT ON TABLE public.favorites IS 'User wishlist / saved listings';


-- ==========================================
-- SECTION 11: NOTIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,           -- 'booking_new', 'booking_confirmed', 'booking_canceled', 'payout', 'review', 'queue_promoted'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,                    -- optional deep link (e.g. /dashboard/bookings)
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, is_read, created_at DESC);

COMMENT ON TABLE public.notifications IS 'In-app notification feed';


-- ==========================================
-- SECTION 12: CONVERSATIONS (Messaging)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_a, participant_b),
  CHECK (participant_a < participant_b)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_a
  ON public.conversations (participant_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b
  ON public.conversations (participant_b, last_message_at DESC);


-- ==========================================
-- SECTION 13: MESSAGES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (conversation_id, is_read) WHERE NOT is_read;


-- ==========================================
-- SECTION 14: ROW LEVEL SECURITY - Enable
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- SECTION 15: RLS POLICIES
-- ==========================================
-- Uses DO blocks to avoid errors if policies already exist.

DO $$
BEGIN

  -- ─── PROFILES ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable') THEN
    CREATE POLICY "Public profiles are viewable" ON public.profiles
      FOR SELECT USING (is_public = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;

  -- ─── SUBSCRIPTIONS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can view own subscription') THEN
    CREATE POLICY "Users can view own subscription" ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- ─── PAYMENTS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Users can view own payments') THEN
    CREATE POLICY "Users can view own payments" ON public.payments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- ─── LISTINGS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'Active listings are viewable') THEN
    CREATE POLICY "Active listings are viewable" ON public.listings
      FOR SELECT USING (is_active = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'Users can manage own listings') THEN
    CREATE POLICY "Users can manage own listings" ON public.listings
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- ─── BOOKINGS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Users can view own bookings') THEN
    CREATE POLICY "Users can view own bookings" ON public.bookings
      FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = customer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Customers can create bookings') THEN
    CREATE POLICY "Customers can create bookings" ON public.bookings
      FOR INSERT WITH CHECK (auth.uid() = customer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Creators can update bookings') THEN
    CREATE POLICY "Creators can update bookings" ON public.bookings
      FOR UPDATE USING (auth.uid() = creator_id);
  END IF;

  -- ─── BOOKING QUEUE ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_queue' AND policyname = 'Users can view own queue entries') THEN
    CREATE POLICY "Users can view own queue entries" ON public.booking_queue
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_queue' AND policyname = 'Creators can view queue for their listings') THEN
    CREATE POLICY "Creators can view queue for their listings" ON public.booking_queue
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.listings
          WHERE listings.id = booking_queue.listing_id
          AND listings.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_queue' AND policyname = 'Users can join queue') THEN
    CREATE POLICY "Users can join queue" ON public.booking_queue
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_queue' AND policyname = 'Users can leave queue') THEN
    CREATE POLICY "Users can leave queue" ON public.booking_queue
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- ─── PAYOUTS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payouts' AND policyname = 'Creators can view own payouts') THEN
    CREATE POLICY "Creators can view own payouts" ON public.payouts
      FOR SELECT USING (auth.uid() = creator_id);
  END IF;

  -- ─── REVIEWS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view reviews') THEN
    CREATE POLICY "Anyone can view reviews" ON public.reviews
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can create reviews for their completed bookings') THEN
    CREATE POLICY "Users can create reviews for their completed bookings" ON public.reviews
      FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can update own reviews') THEN
    CREATE POLICY "Users can update own reviews" ON public.reviews
      FOR UPDATE USING (auth.uid() = reviewer_id);
  END IF;

  -- ─── USER SETTINGS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can view own settings') THEN
    CREATE POLICY "Users can view own settings" ON public.user_settings
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can upsert own settings') THEN
    CREATE POLICY "Users can upsert own settings" ON public.user_settings
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can update own settings') THEN
    CREATE POLICY "Users can update own settings" ON public.user_settings
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- ─── FAVORITES ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can view own favorites') THEN
    CREATE POLICY "Users can view own favorites" ON public.favorites
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can add favorites') THEN
    CREATE POLICY "Users can add favorites" ON public.favorites
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can remove own favorites') THEN
    CREATE POLICY "Users can remove own favorites" ON public.favorites
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- ─── NOTIFICATIONS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications" ON public.notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications') THEN
    CREATE POLICY "Users can update own notifications" ON public.notifications
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- ─── CONVERSATIONS ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can view own conversations') THEN
    CREATE POLICY "Users can view own conversations" ON public.conversations
      FOR SELECT USING (auth.uid() = participant_a OR auth.uid() = participant_b);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can create conversations') THEN
    CREATE POLICY "Users can create conversations" ON public.conversations
      FOR INSERT WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can update own conversations') THEN
    CREATE POLICY "Users can update own conversations" ON public.conversations
      FOR UPDATE USING (auth.uid() = participant_a OR auth.uid() = participant_b);
  END IF;

  -- ─── MESSAGES ───

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view messages in own conversations') THEN
    CREATE POLICY "Users can view messages in own conversations" ON public.messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can send messages in own conversations') THEN
    CREATE POLICY "Users can send messages in own conversations" ON public.messages
      FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Recipients can mark messages as read') THEN
    CREATE POLICY "Recipients can mark messages as read" ON public.messages
      FOR UPDATE USING (
        sender_id != auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
        )
      );
  END IF;

END $$;


-- ==========================================
-- SECTION 16: FUNCTIONS
-- ==========================================

-- Commission rate based on tier (gratis/guld/premium model)
CREATE OR REPLACE FUNCTION public.get_creator_commission(p_creator_id UUID)
RETURNS DECIMAL AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_creator_commission IS
  'Returns commission rate (decimal) for a creator based on their tier: gratis=15%, guld=8%, premium=3%';

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'publik')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic updated_at handler
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- SECTION 17: TRIGGERS
-- ==========================================
-- Drop-and-recreate to ensure idempotency.

-- Auth trigger: auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.listings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.bookings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();


-- ==========================================
-- Done. All tables, indexes, RLS policies,
-- functions, and triggers are now in place.
-- ==========================================
