# Incidenthantering

## Vad räknas
Obehörig åtkomst, läcka eller förlust av personuppgifter, driftstopp som
påverkar användare, felaktiga betalningar, utskick utan samtycke, läckt
hemlighet. Även tillbud som inte ledde till skada.

## Steg
1. **Stoppa.** Begränsa skadan först: stäng funktionen, rotera nyckeln, rulla tillbaka deployen.
2. **Säkra spår.** Spara loggar, tidsstämplar, skärmbilder innan de försvinner.
3. **Bedöm.** Personuppgifter inblandade? Hur många? Risk för de registrerade? Beslut om IMY-anmälan inom 72 timmar från upptäckt (VD beslutar, teknikansvarig underlag).
4. **Informera.** Berörda användare när det finns risk för dem; partners (t.ex. lokalen) när deras verksamhet påverkas. Klart språk, vad som hänt och vad de bör göra.
5. **Rätta.** Orsaken, inte symtomet. Ändringen går samma väg som all kod.
6. **Dokumentera** i `docs/sakerhet/incidenter/` inom ett dygn enligt mallen.
7. **Lär.** Riskregistret och kontrollprogrammet uppdateras om incidenten visade en lucka.

## Kontakt
Externa rapporter om sårbarheter kommer via privacy@usha.se (står på usha.se/sakerhet). Svar inom två arbetsdagar.
