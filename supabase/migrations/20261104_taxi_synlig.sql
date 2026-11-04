-- Taxidansare syns på kvällens publika sida, så att deltagarna vet vem de kan
-- be om en dans. Förnamnet visas som standard — rollen är publik till sin natur
-- (de är där för att bli uppbjudna) och det står vid anmälan. Den som inte vill
-- synas kryssar ur rutan när hen anmäler sig.
ALTER TABLE public.taxi_signups
  ADD COLUMN IF NOT EXISTS show_on_event boolean NOT NULL DEFAULT true;
