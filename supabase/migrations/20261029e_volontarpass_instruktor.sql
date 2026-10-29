-- Instruktör blir en volontärroll, på samma villkor som de andra.
--
-- Samtidigt tas taxi_shifts.kind bort: den kom från en parallell gren
-- (20261029c, taxi/instructor) som ersätts av role (20261029d). Kolumnen har
-- aldrig lästs av någon kod i main.
ALTER TABLE public.taxi_shifts DROP CONSTRAINT IF EXISTS taxi_shifts_role_check;
ALTER TABLE public.taxi_shifts
  ADD CONSTRAINT taxi_shifts_role_check
  CHECK (role IN ('taxi_dancer', 'instructor', 'door_host', 'photographer', 'helper'));
ALTER TABLE public.taxi_shifts DROP COLUMN IF EXISTS kind;
