--
-- Två kolumner på listings, en trigger och en omskriven RPC.
--
-- 1. published_at: när evenemanget blev aktivt (is_active = true). Följarmejlet
--    utgick från created_at, så ett utkast som publicerades efter tre dygn
--    mejlades aldrig. Sätts av triggern nedan, både vid INSERT (skapat aktivt)
--    och när is_active går från något annat till true.
--    Ingen backfill med flit: rader med NULL hoppas över av mejlkörningen, så
--    historiska evenemang kan inte mejlas ut av att kolumnen dyker upp.
--    Dubbelutskick hindras som förut av followers_notified_at.
--
-- 2. venue_declined_at: lokalens nej. Tidigare skrev confirm_venue_listing
--    bara venue_confirmed_at = NULL vid nej, vilket inte gick att skilja från
--    "inte svarat än". Arrangören såg "väntar på lokalens ja" i båda fallen.
--
-- Inget raderas och inga befintliga rader skrivs om.
--

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS venue_declined_at timestamp with time zone;

COMMENT ON COLUMN public.listings.published_at IS
  'Senaste gången is_active blev true. Styr följarmejlets tidsfönster (creator-event-notify). NULL = aldrig publicerad sedan kolumnen kom.';
COMMENT ON COLUMN public.listings.venue_declined_at IS
  'När lokalen tackade nej (eller drog tillbaka sitt ja). NULL tillsammans med venue_confirmed_at NULL = väntar på svar.';

CREATE OR REPLACE FUNCTION public.set_listing_published_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.is_active is true
     and (tg_op = 'INSERT' or old.is_active is distinct from true) then
    new.published_at := now();
  end if;
  return new;
end;
$$;

ALTER FUNCTION public.set_listing_published_at() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_set_listing_published_at ON public.listings;
CREATE TRIGGER trg_set_listing_published_at
  BEFORE INSERT OR UPDATE OF is_active ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_listing_published_at();

-- Samma behörighetskontroll som förut. Nytt: nej sparas som venue_declined_at,
-- och ett ja nollställer ett tidigare nej.
CREATE OR REPLACE FUNCTION public.confirm_venue_listing(p_listing uuid, p_confirm boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_venue uuid;
begin
  select venue_profile_id into v_venue from public.listings where id = p_listing;
  if v_venue is null then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;

  if v_venue <> auth.uid() and not exists (
    select 1 from public.venue_members m
     where m.venue_profile_id = v_venue
       and m.user_id = auth.uid()
       and m.accepted_at is not null
       and m.removed_at is null
       and 'page' = any(m.capabilities)
  ) then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;

  update public.listings
     set venue_confirmed_at = case when p_confirm then now() else null end,
         venue_declined_at  = case when p_confirm then null else now() end
   where id = p_listing;
end;
$$;
