# Usch-Ja! — In-app-guidning: copy

> All copy för skatte- och utbetalningsguidning, strukturerad per skärm. Ton: lugn, tydlig, hjälpsam — inte säljig, inte skrämmande. Aldrig "skatterådgivning". Svenska.
> Se [usha-inapp-guidning-ux.md](./usha-inapp-guidning-ux.md) för flöden och när varje del visas.

**Genomgående mikrocopy-regler**
- Säg "utbetalning", aldrig "lön".
- Säg "Usha förmedlar", aldrig "Usha säljer/anställer".
- Belopp och gränser visas med årtal ("gäller 2026") eftersom de ändras.
- Varje skärm med skatteinnehåll slutar med disclaimer-rad (se §B3).

---

# B1 — Kreatör-flöde

## B1.1 Onboarding-skärm: "Innan din första utbetalning"

**Rubrik:** Innan din första utbetalning

**Ingress:**
När du får betalt via Usch-Ja! är det en **utbetalning för ett uppdrag du själv utför** — inte lön. Du ansvarar själv för din skatt. Här är det du behöver veta innan pengarna kommer.

**Block 1 — Hobby eller näring?**
Säljer du tjänster då och då, mest för nöjes skull? Då kan det räknas som **hobby**. Gör du det regelbundet och för att tjäna pengar? Då är det troligen **näringsverksamhet**. Det avgör hur du deklarerar och vilka avgifter du betalar.
→ *[Gör självskattningen]* (2 min)

**Block 2 — Behöver du F-skatt?**
Om din verksamhet är näring behöver du oftast vara **godkänd för F-skatt**. Då sköter du skatt och egenavgifter själv. Saknar du F-skatt kan din utbetalning behöva hanteras annorlunda — därför frågar vi om det.
→ *[Läs om F-skatt]* · *[Ansök på verksamt.se ↗]*

**Block 3 — Har du eget bolag (AB)?**
Driver du som aktiebolag fakturerar bolaget och du tar ut lön/utdelning därifrån. Ange ditt org.nr så hanterar vi utbetalningen rätt.

**Block 4 — Det här gör Usha**
Usha **förmedlar** uppdraget mellan dig och lokalen och tar en provision. Vi betalar inte ut lön och vi är inte din arbetsgivare. Betalningen sköts av vår betalpartner (Stripe) — pengarna går direkt till dig.

**Primär knapp:** Fortsätt
**Sekundär:** Jag fixar detta senare

---

## B1.2 Pop-up vid första utbetalning

**Rubrik:** Din första utbetalning är på väg 🎉

**Brödtext:**
Det här är en **utbetalning för ditt uppdrag — inte lön**. Så funkar det:

- **Du** ansvarar för att betala skatt på beloppet.
- Usha drar **ingen** preliminärskatt och betalar **inga** arbetsgivaravgifter — vi är inte din arbetsgivare.
- Är du godkänd för **F-skatt** sköter du skatt och egenavgifter själv via din preliminärskatt.
- Är detta **hobby** redovisar du överskottet i din deklaration (bilaga T2) och betalar egenavgifter själv.
- Vi sparar din årssumma åt dig under **Skatt & deklaration** så du har den till deklarationen.

**Kryssruta:** Jag förstår att jag själv ansvarar för min skatt.
**Primär knapp:** Ta emot utbetalning
**Länk:** Hur ska jag deklarera det här?

*Visas en gång, vid första utbetalningen. Disclaimer-rad i fot.*

---

## B1.3 Sektion i profilinställningar: "Skatt & deklaration"

**Sektionsrubrik:** Skatt & deklaration

**Ingress:** Här samlar vi det du behöver för din skatt. Vi ger dig överblick — din revisor eller Skatteverket ger dig svar i ditt enskilda fall.

### B1.3.1 Självskattning: Hobby eller näring? (quiz)

**Rubrik:** Är det hobby eller näringsverksamhet?
**Ingress:** Fem snabba frågor. Du får en vägledande indikation — inte ett bindande besked.

1. **Hur ofta tar du uppdrag?**
   - Någon enstaka gång om året
   - Några gånger om året
   - Regelbundet, månadsvis eller oftare

2. **Gör du det för att tjäna pengar (vinstsyfte)?**
   - Nej, mest för nöje/intresse
   - Lite grann
   - Ja, det är meningen att gå med vinst

3. **Marknadsför du dig aktivt (egen sida, annonser, flera kunder)?**
   - Nej
   - Ibland
   - Ja, regelbundet mot flera kunder

4. **Bestämmer du själv hur, var och när du utför uppdraget?**
   - Nej, oftast på uppdragsgivarens villkor
   - Delvis
   - Ja, jag är självständig

5. **Räknar du med att uppdragen ger en återkommande inkomst?**
   - Nej
   - Kanske
   - Ja

**Resultat — "Troligen hobby":**
Dina svar pekar mot **hobby**. Då redovisar du årets överskott som inkomst av tjänst (bilaga **T2**) och betalar **egenavgifter** själv på överskottet. Du behöver oftast inte F-skatt. Din årssumma finns nedan.
→ *[Läs mer om hobby på Skatteverket ↗]*

**Resultat — "Troligen näringsverksamhet":**
Dina svar pekar mot **näringsverksamhet** (självständigt, varaktigt, med vinstsyfte). Då bör du vara **godkänd för F-skatt**, redovisa på **NE-bilaga** och betala egenavgifter. Når du 120 000 kr i omsättning (2026) ska du också momsregistrera dig.
→ *[Ansök om F-skatt på verksamt.se ↗]* · *[Läs om näringsverksamhet ↗]*

**Resultat — "Mittemellan / osäkert":**
Dina svar ligger i gränslandet. Gränsen mellan hobby och näring är glidande — det avgörande är **vinstsyfte, hur ofta och hur självständigt** du jobbar. Kolla med din revisor eller Skatteverket innan du bestämmer.
→ *[Kontakta din revisor]* · *[Skatteverkets vägledning ↗]*

*Disclaimer-rad i fot.*

### B1.3.2 Årssumma (YTD)

**Rubrik:** Dina utbetalningar i år
**Stor siffra:** `{ÅR}: {SUMMA} kr`
**Underrad:** Summan av alla utbetalningar via Usch-Ja! {ÅR}, före din egen skatt. {ANTAL} uppdrag.
**Sekundär rad:** Föregående år: {SUMMA} kr
**Knapp:** Ladda ner underlag (PDF/CSV)
**Notis (visas vid ≥100 000 kr):** Du närmar dig momsgränsen 120 000 kr (2026). Når du den ska du momsregistrera dig. *[Läs mer ↗]*

### B1.3.3 Januari-påminnelse

**Pushnotis (början av januari):**
Dags att tänka på deklarationen 📋 Dina Usch-Ja!-utbetalningar för {FÖREGÅENDE ÅR} är summerade och klara att ladda ner.

**In-app-banner (jan–apr):**
**Rubrik:** Deklarationsdags
**Text:** Du fick **{SUMMA} kr** i utbetalningar via Usch-Ja! {ÅR}. Kom ihåg att ta med det i din deklaration — **NE-bilaga** om det är näring, **bilaga T2** om det är hobby. Vi har underlaget åt dig.
**Knapp:** Hämta underlag · **Länk:** Vad rapporterar Usha om mig?

### B1.3.4 "Vad rapporterar Usha om mig?" (DAC7-transparens)

**Rubrik:** Vad rapporterar Usha om mig?
**Ingress:** Som digital plattform är Usha skyldig enligt lag (DAC7, lag 2022:1681) att varje år lämna vissa uppgifter om dig till **Skatteverket**. Här är exakt vad — inga överraskningar.

**Vi rapporterar:**
- Ditt namn och din adress
- Ditt **personnummer** (eller org.nr om du har bolag)
- Det **konto** dina utbetalningar går till
- **Hur mycket** du fått i utbetalningar, per kvartal
- Provision och avgifter vi tagit ut

**När:** En gång per år, senast **31 januari** för föregående år.
**Varför:** Det är ett EU-gemensamt krav som gör att inkomster via plattformar redovisas korrekt. Det betyder också att Skatteverket redan känner till dina utbetalningar — så se till att de finns med i din deklaration.
**Det här rapporterar vi INTE:** vad du köper, dina meddelanden, eller något om din privatekonomi utöver ovanstående.

*Disclaimer-rad i fot.*

---

# B2 — Venue-flöde

## B2.1 Onboarding för AB / enskild firma

**Rubrik:** Sätt upp din venue för bokningar

**Ingress:** För att boka och betala kreatörer via Usch-Ja! behöver vi veta hur din verksamhet ser ut. Det styr fakturor, moms och bokföring.

**Val — företagsform:**
- **Aktiebolag (AB)** → ange org.nr
- **Enskild firma** → ange org.nr/personnummer
- **Förening / annan** → ange org.nr

**Block — Det här behöver vi:**
- Org.nr och firmanamn
- Momsregistrerad? (ja/nej) + ev. momsreg.nr
- Faktura- och utbetalningsuppgifter (konto hanteras via vår betalpartner Stripe)

**Info-ruta:**
Usha **förmedlar** bokningen mellan dig och kreatören och tar en provision. Kreatören är din motpart för själva uppdraget. Betalningen sköts via Stripe — pengar går direkt mellan parterna, inte via Ushas konto.

**Knapp:** Fortsätt

---

## B2.2 Hur Usha-intäkter bokförs

**Rubrik:** Så bokför du Usch-Ja!
**Ingress:** Kort översikt — din revisor sätter rätt konton för just din verksamhet.

- **Det du tar betalt av besökare** (entré, biljett, mat/dryck) är din **intäkt**. Du redovisar **utgående moms** på hela beloppet — även när pengaflödet går via plattformen.
- **Ushas provision** är en **kostnad** för dig, med eventuell ingående moms du kan dra av.
- **Gaget till kreatören** är en **kostnad**. Är kreatören momsregistrerad och fakturerar moms kan du dra den **ingående momsen** (om din verksamhet är momspliktig).
- **Spara alla underlag** (fakturor/kvitton) — du hittar dem under *Bokföringsunderlag* i appen.

**Knapp:** Ladda ner bokföringsunderlag

*Disclaimer-rad i fot.*

---

## B2.3 Momsregler för olika event-typer

**Rubrik:** Vilken moms gäller för ditt event?
**Ingress:** Momssatsen beror på vad du säljer. Vanliga fall (2026):

| Du säljer… | Moms |
|---|---|
| Entré till konsert/föreställning (artist framför verk) | **6 %** |
| Tillträde till / utöva idrott (t.ex. dansklass) | **6 %** |
| Klubbkväll utan kulturframförande | **25 %** |
| Workshop/kurs (utbildning) | **25 %** |
| Spa / relax / behandling | **25 %** |
| Servering (café/restaurang) | **12 %** (vin/sprit/starköl 25 %) |
| Livsmedel att ta med | **6 %** (fr.o.m. 1 apr 2026) |

**Info-ruta:** Blandar du momsfri och momspliktig verksamhet får du bara dra ingående moms på den momspliktiga delen. Är du osäker på ditt specifika event — fråga din revisor.

→ *[Skatteverkets momssatser ↗]*

*Disclaimer-rad i fot.*

---

## B2.4 Kassaregister-krav (visas när relevant)

**Rubrik:** Behöver du kassaregister?
**Ingress:** Kort koll — det beror på hur du tar betalt.

**Trafikljus-besked baserat på venuens svar:**

- **Grönt — troligen inget krav:** Tar du bara betalt via faktura, banköverföring eller via Usch-Ja! (ingen kontant/kort/Swish på plats)? Då omfattas du normalt **inte** av kassaregisterkravet.
- **Gult — kanske:** Tar du kontant/kort/**Swish** i lokalen men under **4 prisbasbelopp** (236 800 kr, 2026) per år? Då kan du vara undantagen — håll koll på gränsen.
- **Rött — troligt krav:** Tar du kontant/kort/Swish på plats för mer än 4 prisbasbelopp/år? Då behöver du ett **certifierat kassaregister** och måste erbjuda kvitto.

**Info-ruta:** Swish och kortbetalning vid kassan räknas som "kontant" i den här bedömningen. Betalningar som sker enbart via plattformen/faktura räknas inte in.

→ *[Skatteverket om kassaregister ↗]*

*Disclaimer-rad i fot.*

---

## B2.5 Venue: F-skattekoll (info vid bokning)

**Rubrik:** Vi kollar kreatörens F-skatt åt dig
**Text:** När du betalar en kreatör för ett uppdrag måste betalaren normalt kontrollera att kreatören är **godkänd för F-skatt**. Annars kan betalaren bli skyldig att göra skatteavdrag och betala arbetsgivaravgifter. Usch-Ja! verifierar kreatörens F-skattestatus innan utbetalning — så att du slipper risken.

---

# B3 — Gemensamt

## B3.1 Skatte-FAQ

**Är min utbetalning lön?**
Nej. Det är en utbetalning för ett uppdrag du utför som egen aktör. Usha är inte din arbetsgivare och drar varken skatt eller betalar arbetsgivaravgifter.

**Måste jag betala skatt på det jag får via Usch-Ja!?**
Ja. All inkomst ska beskattas. Är det näring redovisar du på NE-bilaga; är det hobby på bilaga T2. Du betalar egenavgifter själv.

**Vad är skillnaden på hobby och näringsverksamhet?**
Näring = självständigt, varaktigt och med vinstsyfte. Hobby = saknar verkligt vinstsyfte. Gränsen är glidande — gör självskattningen under *Skatt & deklaration* för en indikation.

**När behöver jag F-skatt?**
Oftast när din verksamhet är näring. Med godkänd F-skatt sköter du skatt och egenavgifter själv. Ansök på verksamt.se.

**När måste jag momsregistrera mig?**
När din omsättning når **120 000 kr** under året (2026). Under gränsen kan du vara momsbefriad. Du kan också registrera dig frivilligt.

**Vad rapporterar Usha till Skatteverket?**
Namn, person-/org.nr, ditt utbetalningskonto och hur mycket du fått, per kvartal — en gång per år (DAC7). Se "Vad rapporterar Usha om mig?".

**Var hittar jag min årssumma?**
Under *Profil → Skatt & deklaration → Dina utbetalningar i år*. Du kan ladda ner underlag som PDF/CSV.

**Tar Usha emot mina pengar?**
Nej. Betalningarna hanteras av vår betalpartner (Stripe). Pengarna går direkt till dig — inte via Ushas konto.

**Jag har ett AB — hur funkar det då?**
Ditt bolag är mottagare och fakturerar; du tar ut lön/utdelning ur bolaget. Ange org.nr i din profil.

## B3.2 Disclaimer-mall ("detta är inte skatterådgivning")

**Kort (fot på varje skärm):**
> ℹ️ Detta är allmän information, inte skatterådgivning. Belopp och regler gäller 2026 och kan ändras. Ditt enskilda fall avgörs av Skatteverket.

**Lång (FAQ-topp / första gången):**
> **Om den här informationen**
> Usch-Ja! ger dig allmän vägledning för att du lättare ska förstå din situation. Det är **inte** skatte-, bok­förings- eller juridisk rådgivning, och ersätter inte Skatteverket eller en revisor. Reglerna och beloppen vi visar gäller 2026 och kan ändras. Vi ansvarar inte för beslut du fattar utifrån den här informationen — stäm alltid av ditt enskilda fall med din revisor eller Skatteverket.

## B3.3 "Kontakta din revisor"-CTA

**Inline-variant:**
Osäker på vad som gäller för just dig? *[Prata med din revisor]*

**Kort-variant (vid gränsfall/quiz "osäkert"):**
**Rubrik:** Det här är ett gränsfall
**Text:** Din situation ligger i gränslandet. En revisor kan ge dig ett tryggt besked för just ditt fall — ofta på 15 minuter.
**Primär knapp:** Hitta en revisor
**Sekundär:** Skatteverkets vägledning ↗

---

## Tooltip-/mikrocopy-bibliotek

- **F-skatt:** "Ett godkännande från Skatteverket som visar att du själv betalar din skatt och dina egenavgifter."
- **Egenavgifter:** "Sociala avgifter du betalar själv på överskottet (28,97 % för de flesta, 2026)."
- **NE-bilaga:** "Bilagan där du redovisar inkomst av näringsverksamhet i din deklaration."
- **Bilaga T2:** "Bilagan där du redovisar överskott från hobbyverksamhet."
- **DAC7:** "EU-regel som gör att plattformar rapporterar användares inkomster till skattemyndigheten."
- **Momsgräns:** "Når din omsättning 120 000 kr (2026) ska du ta ut moms och registrera dig."
- **Provision:** "Avgiften Usha tar för att förmedla bokningen."
