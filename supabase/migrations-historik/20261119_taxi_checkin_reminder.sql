-- Påminnelse till volontären när passet börjar: "Checka in nu".
-- Självincheckningen fanns redan (/app/taxi/[id], 30 min före passet till
-- slutet), men ingen visste om den. Sammy fick en varning 12 nov för ett pass
-- han var på, bara för att ingen checkade in honom. Kolumnen gör påminnelsen
-- idempotent: den skickas en gång per anmälan.
alter table public.taxi_signups
  add column if not exists checkin_reminded_at timestamptz;
