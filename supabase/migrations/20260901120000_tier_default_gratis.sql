-- profiles.tier hade standardvärdet 'silver' — ett värde appen inte känner till.
--
-- Kolumnen fick sitt default innan nivåerna döptes om till gratis/guld/premium,
-- och ingen flyttade med defaultet. Registreringstriggern sätter inte tier alls,
-- så VARJE nytt konto sedan dess har fått 'silver'. 21 av 40 profiler hade det.
--
-- Det gick obemärkt eftersom de flesta ställen behandlar en okänd nivå som
-- gratis, vilket råkar bli rätt. Men inte alla: /app/events/insights och
-- /app/events/[id]/stats gör `if (tier === "gratis")` och släpper alltså in den
-- vars tier är något annat — en gratisanvändare med 'silver' fick
-- betalfunktioner. Fel åt andra hållet, och lika mycket fel.
--
-- Ingen av de berörda har någon prenumeration — kontrollerat före ändringen —
-- så ingen som betalat nedgraderas här.

alter table public.profiles alter column tier set default 'gratis';
alter table public.profiles alter column role set default 'customer';

-- OBS: protect_profile_privileged_columns skriver tillbaka tier och role för
-- alla utom service_role, TYST och utan fel. En UPDATE här utan att stänga av
-- den ser ut att lyckas men gör ingenting — vilket är precis vad som hände
-- första gången den här migrationen kördes.
alter table public.profiles disable trigger protect_profile_privileged_columns_trigger;

-- Normalisera allt okänt i stället för att räkna upp kända skräpvärden. Listan
-- över gamla namn är inte känd i förväg, och en uppräkning missar nästa.
update public.profiles
   set tier = case
     when tier in ('gold') then 'guld'
     when tier in ('platinum','enterprise') then 'premium'
     else 'gratis'
   end
 where tier is null or tier not in ('gratis','guld','premium');

alter table public.profiles enable trigger protect_profile_privileged_columns_trigger;

-- Hindra att det glider igen. Nivåerna är tre, och en fjärde ska inte kunna
-- smyga in via ett default eller en direkt skrivning.
alter table public.profiles drop constraint if exists profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check check (tier in ('gratis','guld','premium'));
