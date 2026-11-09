# Informationssäkerhetspolicy

## Varför
Usha Platform hanterar inloggningar, betalningar och personuppgifter för
kreatörer, lokaler och publik. Förtroendet är produkten. Säkerhet är inte
ett projekt utan ett sätt att arbeta.

## Omfattning
All kod, alla konton och alla leverantörer som rör usha.se, appen och
bolagets interna verktyg (CRM, körjournal, ekonomiassistent, Verkstaden).

## Principer
1. **Minsta möjliga åtkomst.** Varje konto, nyckel och databasregel ger bara det som behövs. Radnivåsäkerhet (RLS) på varje tabell.
2. **Hemligheter bor på ett ställe.** Vercels miljövariabler (produktion) och GitHub Secrets. Aldrig i kod, chattar, mejl eller dokument.
3. **Ingen ändring utan spår.** All kod via pull request på skyddad huvudgren. Databasändringar som migrationer i repot.
4. **Mät, lita inte.** Kontrollerna i `docs/sakerhet/kontrollprogram.md` körs automatiskt varje månad; det som inte går att mäta står som "ej kontrollerat".
5. **Skriv ner det.** Beslut, incidenter och avsteg dokumenteras i repot inom ett dygn.
6. **EU först.** Data lagras i EU när leverantören erbjuder det. Leverantörer utanför EU bara med giltig överföringsgrund.

## Ansvar
- **VD** äger policyerna och beslutar om avsteg.
- **Teknikansvarig** (Pablo Acosta) äger kontrollprogrammet, nycklarna och incidenthanteringen.
- **Alla med åtkomst** följer atkomst.md och rapporterar avvikelser direkt.

## Avsteg
Ett avsteg från en policy skrivs in i `docs/sakerhet/risker.md` med skäl,
kompenserande åtgärd och datum för omprövning.
