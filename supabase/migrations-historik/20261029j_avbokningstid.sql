-- Avbokningstid per säljare (kreatör eller venue): hur många timmar före start
-- köparen senast får avboka själv. NULL = ingen gräns. Efter gränsen kan bara
-- säljaren avboka, och då återbetalas allt som förut.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancellation_hours integer
    CHECK (cancellation_hours IS NULL OR cancellation_hours BETWEEN 1 AND 720);

-- Visas för köparen på evenemangs- och tjänstesidor.
GRANT SELECT (cancellation_hours) ON public.profiles TO anon, authenticated;
