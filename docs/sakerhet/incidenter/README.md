# Incidenter

En fil per händelse, döpt `ÅÅÅÅ-MM-DD-kort-namn.md`. Skrivs inom ett dygn,
även när det gick bra. Första incidenten dokumenterades i
`docs/marketing-consent-incident-2026-09-06.md` och är mönstret.

## Mall

```
# <Vad hände, en rad>

**När:** upptäckt <datum tid>, löst <datum tid>
**Vem berördes:** <antal personer / vilka system>
**Personuppgifter inblandade:** ja/nej – vilka
**Anmälan till IMY:** ja/nej – skäl (72-timmarsregeln gäller när risk för de registrerade finns)

## Förlopp
Vad hände, i ordning, med klockslag.

## Orsak
Den faktiska orsaken, inte symtomet.

## Åtgärd
Vad som gjordes för att stoppa det, och vad som ändrats så det inte händer igen.

## Lärdom
En eller två meningar som går att minnas.
```

## Driftstopp räknas också

Ett driftstopp utan personuppgifter är en incident (risk 2 i riskregistret).
Exempel: 2026-11-06, hela usha.se gav 500 i ~15 minuter efter att en ny
dynamisk rutt krockade med en befintlig; åtgärd: `next build` före merge och
branch protection på main.
