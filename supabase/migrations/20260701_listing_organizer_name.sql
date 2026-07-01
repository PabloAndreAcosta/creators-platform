-- Anna-feedback: visa den faktiska arrangören (t.ex. "Anna Jois - Joy Nation")
-- på event-sidan i stället för/utöver kontoägaren (som pga betal-beta ligger på
-- plattformskontot). null = visa kontoägarens namn (nuvarande beteende).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS organizer_name text;

COMMENT ON COLUMN public.listings.organizer_name IS
  'Visad arrangör/organizer på event-sidan; null = använd kontoägarens namn.';
