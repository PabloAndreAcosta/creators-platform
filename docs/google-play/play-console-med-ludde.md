# Google Play Console – passet med Ludde

Ludvig gör stegen i sitt namn som VD. Pablo sitter bredvid. Räkna med cirka 20 minuter.
Allt som ska skrivas in står här. Kort, lösenord och legitimation hanterar Ludvig själv.

## Det här behöver Ludvig ha framme

- Sitt Google-konto. Gärna ett som bara är för bolaget, till exempel ludvig@ eller admin@usha.se.
- Bolagets betalkort för 25 USD (cirka 270 kr), en gång. **Inte Fortnox-kortet 4256**, det slutar fungera.
- Sin legitimation (pass eller körkort). Google kan be om en bild på den.
- Sin mobil, för verifieringskoden.

## 1. Skapa utvecklarkontot (cirka 10 min)

1. Gå till **play.google.com/console** och logga in med Google-kontot.
2. Välj **Organisation** (inte "Själv").
3. Fyll i:

| Fält | Värde |
|---|---|
| Utvecklarnamn (syns i butiken) | Usha AB |
| Organisationens namn | Usha AB |
| D-U-N-S-nummer | 351350924 |
| Organisationsnummer | 559401-8326 |
| Adress | Hornsbergs Strand 21, 112 16 Stockholm |
| Webbplats | https://usha.se |
| Kontaktmejl (syns i butiken) | pablo.acosta@usha.se |
| Kontakttelefon | Ludvigs eller bolagets |
| Organisationstyp | Företag |

4. Betala 25 USD med bolagets kort.
5. Verifiera identiteten enligt Googles anvisningar. Det tar mellan några timmar och några dagar. Vi väntar på godkännandet, resten kan förberedas under tiden.

## 2. Lägg till Pablo (2 min)

**Användare och behörigheter → Bjud in nya användare**
- E-post: pablo.acosta@usha.se
- Behörighet: **Administratör** (alla behörigheter)

Då kan Pablo och Claude sköta resten utan Ludvig.

## 3. Skapa appen (2 min, går först när kontot är verifierat)

**Skapa app**

| Fält | Värde |
|---|---|
| Appnamn | Usha Platform |
| Standardspråk | Svenska – sv-SE |
| App eller spel | App |
| Kostnadsfri eller betald | Kostnadsfri |
| Policyer | Kryssa i båda |

Resten görs av Pablo och Claude med underlaget i `docs/google-play/` i repot: butikstexter, ikon, banner, skärmdumpar, datasäkerhet, innehållsklassificering, målgrupp och testkonto för granskarna.

## Efter mötet

- Bocka av i minnet `project_att_gora_med_ludde.md`.
- Pablo laddar upp den signerade versionen (AAB) till **Intern testning** och sedan till **Produktion**.
- Ett företagskonto slipper kravet på 12 testare i 14 dagar.
