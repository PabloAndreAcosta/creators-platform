-- Kassa blir en volontärroll, på samma villkor som de andra.
ALTER TABLE public.taxi_shifts DROP CONSTRAINT IF EXISTS taxi_shifts_role_check;
ALTER TABLE public.taxi_shifts
  ADD CONSTRAINT taxi_shifts_role_check
  CHECK (role IN ('taxi_dancer', 'instructor', 'door_host', 'cashier', 'photographer', 'helper'));
