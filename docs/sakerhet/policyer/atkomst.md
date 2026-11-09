# Åtkomstpolicy

## Konton
- Alla system (GitHub, Vercel, Supabase, Stripe, Resend, Cloudflare, Google Workspace, Signicat, Sentry) nås med personliga konton. Inga delade inloggningar.
- Tvåfaktor är obligatoriskt överallt det finns. GitHub-organisationen har 2FA-tvång tekniskt påslaget; övriga kontrolleras vid kvartalsgenomgången.
- Nytt konto ges när rollen kräver det, med lägsta behörighet som räcker. Lokalteam och crew får behörighet per verktyg i appen (`can_scan`, `can_manage`, lokalbehörigheter), inte via systemkonton.

## I appen
- Behörigheter är datadrivna: `profiles.role` och `tier`, `listing_collaborators`, `venue_members`, `admin_capabilities`. Skyddade kolumner ändras bara av service-rollen (trigger).
- Känsliga handlingar (sälja, skanna, signera, volontär) kräver BankID-verifierat konto.

## Nycklar och hemligheter
- Produktionshemligheter finns bara i Vercel (production) och GitHub Secrets. Preview-miljön har inga produktionshemligheter.
- Varje nyckel har ett syfte och ägs av en integration. En nyckel återanvänds inte mellan system (undantag dokumenterade i `leverantorer.md`).
- **Rotation:** vid misstänkt läcka omedelbart; annars när en person med åtkomst slutar, och minst vartannat år. `BANKID_COOKIE_SECRET` roteras med dubbelnyckelfönster (se minne/security-deferred) eftersom den hashar personnummer.
- Verifiera att den nya nyckeln tagit i målsystemet innan den gamla raderas.

## Åtkomstgenomgång
Varje kvartal (molnrutinen påminner): lista konton per system, ta bort det
som inte behövs, dokumentera i kvartalets säkerhetskontroll-ärende. Vid
avslut av en medarbetare eller partner: samma dag.
