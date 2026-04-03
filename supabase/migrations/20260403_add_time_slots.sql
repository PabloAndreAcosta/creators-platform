-- Add time slot columns to creator_availability
ALTER TABLE public.creator_availability
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- Drop old unique constraint (date-only)
ALTER TABLE public.creator_availability
  DROP CONSTRAINT IF EXISTS creator_availability_user_id_available_date_key;

-- New unique constraint including time (NULL = all day = 00:00)
CREATE UNIQUE INDEX IF NOT EXISTS unique_availability_slot
  ON public.creator_availability (user_id, available_date, COALESCE(start_time, '00:00:00'));

-- Ensure both times are set or both null, and end > start
ALTER TABLE public.creator_availability
  ADD CONSTRAINT check_time_slot
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  );
