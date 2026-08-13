-- Utgångstid för TikToks refresh-token.
--
-- TikToks access token lever 24h, refresh-tokenet 365 dagar. Utan det senare
-- lagrat kunde /app/settings/connections bara se access-tokenet och markerade
-- därför kopplingen som utgången dagen efter anslutning, trots att den går att
-- förnya automatiskt. För TikTok är det refresh-tokenet som avgör om kopplingen
-- lever — access-tokenet förnyas vid behov när media hämtas.

alter table public.social_connections
  add column if not exists tiktok_refresh_token_expires_at timestamptz;

comment on column public.social_connections.tiktok_refresh_token_expires_at is
  'När tiktok_refresh_token slutar gälla (~365 dagar). Avgör om kopplingen lever; access-tokenet förnyas automatiskt.';
