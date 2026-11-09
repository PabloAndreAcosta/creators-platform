# Backup och kontinuitet

## Kopior
- **Databas:** Supabase dagliga backuper enligt plan. Punktåterställning (PITR) är inte aktiverat – bedömt som rimligt för nuvarande volym; omprövas årligen (risk 7).
- **Filer:** `storage-backup.yml` kopierar alla buckets varje natt till Cloudflare R2 (EU) med 30 dagars arkiv för ersatta/raderade filer. Larm vid fel.
- **Kod:** GitHub i organisationen `usha-ab` plus privat spegel. Allt pushas till båda.
- **Konfiguration:** miljövariabler i Vercel; listan över namn finns i `.env.local.example`.

## Återställning
- Fil: hämta från R2-bucketen (eller `_archive/<datum>/`), ladda upp igen.
- Databas: återställ från Supabase-backup till ny instans, peka om. Testas en gång per år (ej gjort än – risk 7).
- Sajt: `vercel promote` till föregående fungerande deploy, inom minuter.

## Mål
- Återställningstid (RTO) för sajten: under en timme. För filer: samma dag. För databas: inom ett dygn.
- Dataförlust (RPO): högst ett dygn för databas och filer.

## Beroende av enskild person
Risk 11 i riskregistret. VD har åtkomst till bolagets konton; överlämningsplan med var nycklarna finns är nästa steg.
