-- Paid instructor mini-sessions at open events (The Kiz Lab).
-- A host opens an event to instructors; paying dance-instructor creators join;
-- attendees buy 15/30/45/60 minute credits redeemed on-site.

-- Host opens an event to instructors
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS open_to_instructors BOOLEAN NOT NULL DEFAULT false;

-- Minute-credit columns on bookings (mirror dances_total / dances_redeemed)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS minutes_total INTEGER,
  ADD COLUMN IF NOT EXISTS minutes_redeemed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_minutes_redeemed_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_minutes_redeemed_check CHECK (minutes_redeemed >= 0);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_minutes_redeemed_within_total;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_minutes_redeemed_within_total
    CHECK (minutes_total IS NULL OR minutes_redeemed <= minutes_total);

-- Allow the new booking_type value (existing CHECK only permits manual/ticket)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_type_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_type_check
    CHECK (booking_type = ANY (ARRAY['manual'::text, 'ticket'::text, 'instructor_minutes'::text]));

-- Which instructors have opted into which open event
CREATE TABLE IF NOT EXISTS public.event_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_event_instructors_listing
  ON public.event_instructors (listing_id);

ALTER TABLE public.event_instructors ENABLE ROW LEVEL SECURITY;

-- READ: instructor reads own row; anyone reads instructors of an active+open
-- event (public event page lists them); the host reads its event's instructors.
DROP POLICY IF EXISTS "Read instructors of open events" ON public.event_instructors;
CREATE POLICY "Read instructors of open events" ON public.event_instructors
  FOR SELECT USING (
    instructor_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.is_active = true
        AND l.open_to_instructors = true
    )
    OR EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.user_id = (SELECT auth.uid())
    )
  );

-- INSERT: only the instructor, only when eligible, only on open+active events.
DROP POLICY IF EXISTS "Eligible instructor joins open event" ON public.event_instructors;
CREATE POLICY "Eligible instructor joins open event" ON public.event_instructors
  FOR INSERT WITH CHECK (
    instructor_id = (SELECT auth.uid())
    AND public.is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('creator', 'kreator')
        AND p.offers_coaching = true
        AND p.coaching_hourly_rate_sek IS NOT NULL
        AND p.coaching_hourly_rate_sek > 0
        AND p.stripe_account_id IS NOT NULL
        AND p.tier IN ('guld', 'premium')
    )
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.is_active = true
        AND l.open_to_instructors = true
    )
  );

-- DELETE: instructor removes own row; host removes an instructor from own event.
DROP POLICY IF EXISTS "Instructor or host removes instructor row" ON public.event_instructors;
CREATE POLICY "Instructor or host removes instructor row" ON public.event_instructors
  FOR DELETE USING (
    instructor_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.user_id = (SELECT auth.uid())
    )
  );
