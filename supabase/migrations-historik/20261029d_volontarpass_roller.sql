-- Volontärpass: varje pass har en roll. Taxipassen var bara för taxidansare;
-- samma incheckning, avbokningsregler och matkupong gäller nu fler sorters
-- volontärer. Befintliga pass blir taxidansarpass.
ALTER TABLE public.taxi_shifts
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'taxi_dancer'
  CHECK (role IN ('taxi_dancer', 'door_host', 'photographer', 'helper'));
