# Historiska migrationer (körs inte)

Allt som låg i `supabase/migrations/` före 2026-11-23. Schemat de byggde finns nu
samlat i `../migrations/20261123120000_baslinje.sql`, kontrollerat mot
produktionens katalog. Se `../BRANCHING.md`.

Filerna finns kvar för historiken: varför en kolumn finns, vilka data som
rättades och när. De ska inte köras igen, och nya migrationer läggs aldrig här.

Obs: `20261113_serviceavgift_standard_absorb.sql` kördes aldrig i produktionen
(`listings.service_fee_mode` har fortfarande standardvärdet `buyer`), och därför
inte heller i baslinjen.
