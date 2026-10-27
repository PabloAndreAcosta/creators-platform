# Egenanställning i egen regi — anställningsformer, skyldigheter och automation

Utrett 2026-10-27 mot primärkällor (riksdagen.se, Skatteverket, Försäkringskassan, Arbetsmiljöverket, IAF, Migrationsverket). Detta är ett beslutsunderlag och ingen juridisk rådgivning. Det som är markerat **osäkert** ska bekräftas innan lön körs skarpt. Idag sköts kreatörer utan bolag via SAMekonomi FakturaLön (se `egenanstallning-gigapay.md`).

## 1. Vilken anställning får kreatören?

**Timanställning finns inte som form i lagen.** Det är ett sätt att betala, alltså timlön. Utan kollektivavtal finns bara de former som LAS 5–6 §§ räknar upp. För kreatörer passar en enda:

**Ramavtal + särskild visstidsanställning per pass.** Kreatören skriver ett ramavtal en gång, med BankID. Avtalet säger uttryckligen att Usha inte är skyldigt att erbjuda pass och att kreatören inte är skyldig att ta dem. Varje bokat pass blir sedan en egen anställning som startar och slutar med passet (AD 2008 nr 81). Vikariat och säsong passar inte.

| Kreatör | Form | Ersättning | Skatteavdrag | Arbetsgivaravgift |
|---|---|---|---|---|
| Instruktör, klass och workshop | Särskild visstid per pass | Lön + 12 % semesterersättning | 30 % eller jämkning eller tabell | 31,42 % |
| DJ eller artist, bosatt i Sverige | Samma | Gage som lön | Samma | Samma |
| Artist bosatt utomlands | Samma | Gage | A-SINK 15 % | Ja. Från EU-land med A1-intyg: nej |
| Instruktör bosatt utomlands | Samma | Lön | SINK 22,5 % (2026) | Ja (A1 avgör) |
| Coach, 15–60 min | Varje session = ett pass | Lön | Oftast 30 % | 31,42 % |
| Taxidansare och crew | Särskild visstid | Lön. En fribiljett är en förmån | 30 % | 31,42 % |
| Digital kurs | **Licensavtal**, inte anställning | Royalty per såld kurs | **Osäkert**: bekräfta med Skatteverket | Ja, om kreatören har A-skatt |
| Har redan F-skatt | **Ska inte anställas.** Säljer som näringsidkare (spår C1) | — | — | — |

Avgiften är 10,21 % för den som fyllt 67 vid årets ingång, 0 % för födda 1937 eller tidigare, och 20,81 % för 19–23-åringar (upp till 25 000 kr i månaden, 2026-04-01 till 2027-09-30). Under 1 000 kr per person och år betalas ingen avgift.

**Två regler gör att det kan bli en fast anställning av sig självt:**

- **LAS 3 §:** tre eller fler pass under samma kalendermånad gör att även dagarna *mellan* passen räknas. En instruktör som kommer varje torsdag tjänar alltså in nästan hela månaden.
- **LAS 5 a §:** mer än 12 månader särskild visstid inom fem år blir en tillsvidareanställning. För en torsdagsinstruktör händer det efter ungefär 14–15 månader.

Detta går inte att avtala bort utan kollektivavtal (2 a–2 b §§). Lösningen är att räkna tiden och varna i tid, och det gör `src/lib/payroll/las.ts`.

**Specialfall som plattformen ska spärra eller hantera:**

- **Under 18:** vårdnadshavarens samtycke krävs (AFS 2023:2). Ingen får arbeta mellan 24 och 05. 16–17-åringar ska vara klara senast 22–23. Barn under 16 kan inte ta kvällspass.
- **Medborgare utanför EU:** behöver normalt arbetstillstånd. Undantaget för artister kräver en etablerad arrangör och gäller högst 14 dagar per 12 månader.
- **Annan huvudarbetsgivare:** 30 % skatteavdrag om inte ett jämkningsbeslut finns.

## 2. Bolagets skyldigheter

| När | Vad | Kan automatiseras? |
|---|---|---|
| En gång | Registrering som arbetsgivare hos Skatteverket. Säsongsregistrering finns för den som betalar lön ibland | Nej, ett formellt beslut |
| En gång | Registerförteckning (GDPR art. 30), biträdesavtal, rättslig grund för personnummer (dataskyddslagen 3 kap. 10 §) | Delvis |
| Per kreatör | Ramavtal med BankID. Kontroll av ålder, medborgarskap och F-skatt | **Ja** |
| Per pass | Skriftlig information enligt LAS 6 c § (13 punkter). Slutdagen ska anges *när* anställningen ingås, resten senast dag 7 | **Ja.** PDF eller mejl, med kvittens loggad |
| Per pass | Riskbedömning av lokalen och samordning med lokalen (AML 3 kap. 7 d–7 g §§) | Delvis: ett samordningsavtal per lokal, en gång |
| Månadsvis | AGI senast den 12:e (i januari och augusti senare). Nolldeklaration om bolaget är registrerat. Betalning till skattekontot samma dag | **Allt utom signeringen** |
| Månadsvis | Löneutbetalning och lönebesked | **Ja.** Betalfil och lönebesked på Mina sidor |
| Löpande | Sjuklön efter 14 dagars anställning. Sjukanmälan till Försäkringskassan efter dag 14. Arbetsskada via anmalarbetsskada.se | Förifyllt, en människa skickar |
| Årligen | Lönekartläggning (diskrimineringslagen 3 kap. 8 §. Krav på skriftlig dokumentation först från 10 anställda) | Delvis |
| Löpande | Arkivering av löneunderlag i 7 år (BFL 7 kap. 2 §) | **Ja** |

**DAC7 blir enklare:** kreatörer som säljer *som anställda* hos plattformen är inte berörd verksamhet (lag 2022:1681, 2 kap. 10 §). Bara tredjepartssäljarna rapporteras.

**Formella beslut som VD och styrelse fattar:** arbetsgivarregistrering, mallar för anställningsavtal och lönenivåer, fördelning av arbetsmiljöuppgifter, avtal med lokaler och lönesystem, betalningar till Skatteverket, firmateckning och fullmakter.

**Personligt ansvar:**

- **Företrädaransvar** för obetald skatt (SFL 59 kap. 12–13 §§) träffar styrelsen och den som är *faktisk företrädare*, det vill säga har bestämmande inflytande och ett väsentligt ekonomiskt intresse (RÅ 2008 ref. 75).
- **Straffansvar för arbetsmiljöbrott** träffar den fysiska person som hade uppgiften. Det talar för en skriftlig uppgiftsfördelning.

## 3. Arkitekturen: så automatiserat som lagen tillåter

```
bokning (usha_principal)  →  avräkning (settlements/)  →  kreatörens andel
        │                                                   │
        │ kreatören har spår C2                             ▼
        ▼                                         payroll/wage.ts
 ramavtal + pass-anställning ──6 c §-PDF──▶       lön, semester, avgift, skatt
 (BankID-signerat, en gång)                                 │
        │                                                   ▼
 payroll/las.ts  ── varning vid 60 dagar kvar        lönerad per pass
                                                            │ creator-debt.ts kvittar returer
                                                            ▼
                                     månadskörning (cron-workern, den 1:a)
                                     ├─ AGI-underlag → Skatteverket API "AGD inlämning"
                                     │     → granskningslänk → BEHÖRIG PERSON SIGNERAR (BankID)
                                     ├─ betalfil pain.001 → Nordea → GODKÄNNS i banken
                                     ├─ skattebetalning bankgiro 5050-1055 + OCR
                                     ├─ lönebesked på /app (+ mejl)
                                     └─ avstämning mot Skattekonto-API
```

**Byggstenarna som redan finns:**

- **Säljflödet där Usha är säljare:** `resolvePayeeFlow`, med `usha_principal` i `checkout.ts`.
- **Delningen per kväll:** `settlements/split.ts`.
- **Saldo och skuld per kreatör:** `payouts/creator-balance.ts` och `creator-debt.ts`. Skuldfunktionen är byggd just för regeln att en utbetald lön inte kan backas.
- **Cron-klockan:** `JOBS` i `workers/cron/src/index.ts`.
- **Spår C2** i `src/lib/onboarding/`. Spåret är mock, och G4 och `EorAdapter` utgår från en extern arbetsgivare. När Usha självt är arbetsgivare behövs ett tredje flöde i stället.

**Byggstenar som måste läggas till:**

| Del | Källa | Status |
|---|---|---|
| Lönemotor: avgift per ålder, semester, skatt | `src/lib/payroll/` (denna gren) | **Byggd, med tester** |
| LAS-räknare | `src/lib/payroll/las.ts` | **Byggd, med tester** |
| Skattetabell och jämkning per personnummer | Skatteverket "Fråga om skatteavdrag" 2.0 (partner-API, kräver avtal) | Ej påbörjad |
| AGI-underlag | Skatteverket "AGD inlämning" (OAuth2, kräver avtal) eller XML-uppladdning | Ej påbörjad |
| Signering av ramavtal | Signicat Sign API v2 (BankID, XAdES). Plattformen har bara *inloggning* via Signicat idag | Ej påbörjad |
| Personnummer i klartext | Ny krypterad kolumn. Dagens `bankid_personal_number` är en HMAC-hash och kan inte användas för AGI | Ej påbörjad |
| Bankkonto för lön | Nytt fält. Idag sker utbetalning bara via Stripe | Ej påbörjad |
| Betalfil | Nordea Corporate Access, pain.001. Bankgirot Löner läggs om 2026, så det spåret väljs bort | Ej påbörjad |

**Det som inte går att automatisera:**

1. Signeringen av AGI varje månad av en behörig företrädare med BankID.
2. Godkännandet av betalfilen i banken.
3. Bedömningar: tjänst eller näring, arbetsskada, rehabilitering.

Allt annat kan ske utan att någon gör något. Systemet förbereder, en människa godkänner två gånger i månaden. Samma princip som i usha-ekonomi: systemet flyttar aldrig pengar själv.

## 4. Faser

0. **Nu:** lönemotorn och LAS-räknaren finns som rena funktioner. De körs inte skarpt, och SAMekonomi fortsätter.
1. **Skuggkörning:** för varje SAMekonomi-faktura räknar vår motor samma lön. Avvikelserna visar om motorn håller.
2. **Ramavtal och 6 c § automatiskt** (Signicat Sign), personnummer och bankkonto krypterade, ålders- och medborgarskapsspärr.
3. **Fortnox Lön som motor för AGI:** plattformen skickar lönetransaktioner via API, och en människa kör lönen och signerar.
4. **Egen AGI** mot Skatteverkets API och betalfil till Nordea. Då återstår bara två signeringar i månaden.

Steg 2–4 kräver §9-juristens OK (`PAYMENTS_LIVE`) och formella beslut i bolaget.

## 5. Läget på marknaden

**Det är inte unikt** att bädda in egenanställning i plattformar:

| Aktör | Upplägg |
|---|---|
| Gigapay | API för kreatörer, 279 €/mån + 4,9 % |
| Frilans Finans | Partnerupplägg, 6 % |
| Gigger | ~3,5 % |
| Cool Company | 5,98 % |
| SAMekonomi | 2 % |

**Det som verkar saknas** (osäkert, eftersom en sökning inte kan bevisa att något saknas) är en kreatörsmarknadsplats där plattformen själv är både säljare, biljettsystem och arbetsgivare i ett och samma flöde: biljett, QR i dörren, lön, AGI och lönebesked, utan någon extern faktura.

| Möjlighet | Varför |
|---|---|
| Lägre tröskel | "Sälj ikväll och få lön utan att starta bolag" |
| A-kassa | Den bygger sedan 2025-10-01 på AGI-inkomster, så Ushas AGI blir direkt värdefull för kreatören |
| SGI | Räknas på lönen, men pass i mindre än 6 månader ger ett svagt skydd |
| DAC7 | Krymper |
| Pris | Marknaden tar 2–6 %. Egen motor har en marginalkostnad nära noll |

Lova inte för mycket. A-kassorna kan bedöma egenanställda som företagare, och inkomstvillkoret (11 000 kr i 4 av 12 månader) nås av få som bara har enstaka pass.

**Risker:**

- Arbetsgivaransvaret: arbetsmiljö, sjuklön och LAS-skadestånd.
- Personberoendet i signeringen av AGI.
- Volymen. Med dagens volym väger arbetsgivarrisken tyngre än de 2 % som sparas. Brytpunkten mot fasta kostnader ligger runt 65 000 kr fakturerat i månaden.

## 6. Öppna frågor

- Skatteavdrag på royalty till en person med A-skatt (digitala kurser): fråga Skatteverket.
- Godkänner Skatteverket ett plattformsföretag som "programvaruföretag" som bara deklarerar för sig självt?
- Kassaregister: är entré som betalas med QR på den egna telefonen i dörren ett köp på distans? Skatteverkets praxis för restaurangappar säger nej.
- Momssatsen på entré till dans från 2026-07-01 (6 %?) mot `vat_rate` 25 % i avräkningen.
- Gäller någon del av uthyrningslagen när kreatören arbetar under en lokals ledning?
