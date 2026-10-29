-- Eget namn på ett volontärpass. Rollen styr fortfarande reglerna (taxidansare
-- har tak på platser m.m.); namnet är bara vad passet heter för volontären.
-- NULL = rollens vanliga namn.
ALTER TABLE public.taxi_shifts
  ADD COLUMN IF NOT EXISTS role_label text
  CHECK (role_label IS NULL OR char_length(role_label) BETWEEN 1 AND 40);
