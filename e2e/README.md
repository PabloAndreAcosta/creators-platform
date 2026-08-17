# End-to-end-tester

Kör i en riktig webbläsare via Playwright, och fångar det `vitest` aldrig kan se: hydreringsfel, konsolfel och vad som faktiskt renderas efter att JavaScript har kört.

Flera buggar i den här appen levde vidare just för att de var osynliga i serverrenderad HTML — menyn som visade fel roll tills hydreringen hann ikapp, sidor som byggts utan att någon meny länkade dit.

## Köra

```bash
npm run e2e            # alla test, startar dev-servern automatiskt
npm run e2e:ui         # interaktivt läge
npx playwright test -g "rollen är rätt"   # ett urval

E2E_BASE_URL=https://usha.se npm run e2e  # mot en deploy i stället för lokalt
```

Första gången krävs webbläsaren: `npx playwright install chromium`.

## Förutsättningar

Testerna loggar in utan lösenord genom att minta en magic link med Supabase admin-API och skriva sessionen som samma SSR-cookie appen läser. Det kräver `.env.local` med `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` och `SUPABASE_SERVICE_ROLE_KEY`.

Kontot som används styrs av `E2E_EMAIL` och är annars `pablo.acosta@usha.se`, som har rollen `creator`.

## Viktigt: testerna är läsande

De körs mot den **riktiga databasen**. Därför klickar de aldrig på något som skapar bokningar, skickar mejl, rör pengar eller ändrar data. Lägg inte till sådana test här utan en separat testdatabas — ett köpflödestest skulle skapa riktiga bokningar och Stripe-anrop.

Av samma skäl körs de inte i CI: service-role-nyckeln finns inte där, och bör inte finnas.

## Vad som täcks

**`hydration.spec.ts`** — laddar appens viktigaste sidor plus tre publika och kräver noll hydreringsfel och noll konsolfel. Brus från tillägg och blockerade tredjepartsanrop filtreras bort i `helpers/console.ts`.

**`navigation.spec.ts`** — två saker:

1. Att rollen är rätt redan i serverrenderingen. Testet körs med **avstängt JavaScript**, vilket är enda sättet att se exakt vad servern skickade. Backar man rollfixen failar det med "rollflimret är tillbaka" — verifierat.
2. Att varje destination i `src/lib/navigation/registry.ts` faktiskt svarar och inte tyst skickar den inloggade till `/login`. Kompletterar coverage-testet i `src/lib/navigation`, som är statiskt.
