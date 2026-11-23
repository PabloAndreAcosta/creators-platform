-- ==========================================
-- Points & Rewards System
-- Gamification for user engagement
-- ==========================================

-- ─── POINT EVENTS (immutable log) ───
CREATE TABLE IF NOT EXISTS public.point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'like_given',
    'like_received',
    'follow_given',
    'follow_received',
    'booking_made',
    'booking_received',
    'review_written',
    'review_received',
    'post_created',
    'referral_signup',
    'profile_completed'
  )),
  points INTEGER NOT NULL,
  source_id UUID,
  source_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_point_events_user ON public.point_events(user_id, created_at DESC);
CREATE INDEX idx_point_events_source ON public.point_events(source_type, source_id);
CREATE UNIQUE INDEX idx_point_events_unique_source
  ON public.point_events(user_id, action, source_id)
  WHERE source_id IS NOT NULL;

-- ─── USER POINTS (materialized aggregate) ───
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  points_this_week INTEGER NOT NULL DEFAULT 0,
  points_this_month INTEGER NOT NULL DEFAULT 0,
  week_start DATE NOT NULL DEFAULT date_trunc('week', now())::date,
  month_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─── REWARDS ───
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_sv TEXT NOT NULL,
  description_sv TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('badge', 'discount', 'early_access', 'feature')),
  required_level INTEGER NOT NULL,
  icon TEXT,
  discount_percent INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, reward_id)
);

-- ─── RLS ───
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own point events" ON public.point_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view user points" ON public.user_points
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view active rewards" ON public.rewards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view own rewards" ON public.user_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- ─── AWARD POINTS FUNCTION ───
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_action TEXT,
  p_points INTEGER,
  p_source_id UUID DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_new_total INTEGER;
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_week_start DATE := date_trunc('week', now())::date;
  v_month_start DATE := date_trunc('month', now())::date;
  v_inserted BOOLEAN;
BEGIN
  -- Insert point event (unique index prevents duplicates)
  INSERT INTO public.point_events (user_id, action, points, source_id, source_type)
  VALUES (p_user_id, p_action, p_points, p_source_id, p_source_type)
  ON CONFLICT (user_id, action, source_id) WHERE source_id IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT v_inserted THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;

  -- Upsert user_points
  INSERT INTO public.user_points (user_id, total_points, points_this_week, points_this_month, week_start, month_start)
  VALUES (p_user_id, p_points, p_points, p_points, v_week_start, v_month_start)
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = user_points.total_points + p_points,
    points_this_week = CASE
      WHEN user_points.week_start = v_week_start THEN user_points.points_this_week + p_points
      ELSE p_points
    END,
    points_this_month = CASE
      WHEN user_points.month_start = v_month_start THEN user_points.points_this_month + p_points
      ELSE p_points
    END,
    week_start = v_week_start,
    month_start = v_month_start,
    updated_at = now()
  RETURNING total_points, current_level INTO v_new_total, v_old_level;

  -- Calculate new level
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

  -- Update level if changed
  IF v_new_level != v_old_level THEN
    UPDATE public.user_points SET current_level = v_new_level WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'total_points', v_new_total,
    'new_level', v_new_level,
    'old_level', v_old_level,
    'leveled_up', v_new_level > v_old_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── SEED REWARDS ───
INSERT INTO public.rewards (slug, name_sv, description_sv, reward_type, required_level, icon, discount_percent) VALUES
  ('badge_utforskare',     'Utforskare',           'Du har börjat din resa på Usha!',           'badge',        2, 'compass',     NULL),
  ('rabatt_5_procent',     '5% rabatt',            '5% rabatt på din nästa bokning',             'discount',     3, 'percent',     5),
  ('early_access_events',  'Tidig tillgång',       'Se nya evenemang innan alla andra',          'early_access', 4, 'clock',       NULL),
  ('badge_dedikerad',      'Dedikerad',            'Du är en av de mest aktiva på Usha!',        'badge',        5, 'star',        NULL),
  ('rabatt_10_procent',    '10% rabatt',           '10% rabatt på bokningar',                    'discount',     6, 'percent',     10),
  ('priority_support',     'Prioriterad support',  'Få svar snabbare från vårt team',            'feature',      7, 'headphones',  NULL),
  ('badge_legend',         'Legend',               'En av de mest engagerade användarna någonsin','badge',        8, 'trophy',      NULL),
  ('rabatt_15_procent',    '15% VIP-rabatt',       'Exklusiv 15% rabatt som VIP-medlem',         'discount',     9, 'crown',       15);
