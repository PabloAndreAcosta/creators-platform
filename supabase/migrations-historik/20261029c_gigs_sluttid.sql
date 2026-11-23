-- Ett uppdrag är ett pass inom kvällen (t.ex. 17–19), inte hela kvällen.
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS event_end_time time;
