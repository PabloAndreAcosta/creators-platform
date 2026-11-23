-- Utgångstid per social koppling.
--
-- social_connections lagrade bara tokens, aldrig när de slutar gälla. Utan det
-- kan varken UI eller bakgrundsjobb skilja en levande koppling från en död —
-- profilsidan visade grön "ansluten"-badge för tokens som gått ut för veckor
-- sedan, och enda signalen till användaren var att medieimporten failade.
--
-- NULL betyder "ingen känd utgång", inte "utgången". Facebooks sidtokens som
-- härleds ur ett long-lived användartoken slutar aldrig gälla, så där är NULL
-- det korrekta värdet.

alter table public.social_connections
  add column if not exists instagram_token_expires_at timestamptz,
  add column if not exists facebook_token_expires_at  timestamptz,
  add column if not exists tiktok_token_expires_at    timestamptz;

comment on column public.social_connections.instagram_token_expires_at is
  'När instagram_access_token slutar gälla. IG long-lived = 60 dagar. NULL = okänd/ingen utgång.';
comment on column public.social_connections.facebook_token_expires_at is
  'När facebook_page_access_token slutar gälla. NULL = ingen utgång (sidtoken från long-lived användartoken).';
comment on column public.social_connections.tiktok_token_expires_at is
  'När tiktok_access_token slutar gälla. TikTok access token = 24h, förnyas via tiktok_refresh_token.';

-- Backfill för rader som skrevs innan callbacks började spara utgångstid.
-- Vi vet inte exakt när tokenet utfärdades, men updated_at är när raden senast
-- skrevs av en callback, vilket i praktiken är utfärdandetillfället.
update public.social_connections
   set instagram_token_expires_at = updated_at + interval '60 days'
 where instagram_access_token is not null
   and instagram_token_expires_at is null;

-- Facebook-tokens som skrevs före long-lived-växlingen härstammar från ett
-- kortlivat användartoken (~1–2h) och är sedan länge döda. Att markera dem som
-- utgångna vid updated_at är sanningsenligt och ger användaren en "koppla om"-
-- knapp i stället för en grön badge som ljuger.
update public.social_connections
   set facebook_token_expires_at = updated_at
 where facebook_page_access_token is not null
   and facebook_token_expires_at is null;

update public.social_connections
   set tiktok_token_expires_at = updated_at + interval '24 hours'
 where tiktok_access_token is not null
   and tiktok_token_expires_at is null;
