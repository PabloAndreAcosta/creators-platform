-- Egna åtaganden: festivaler, dansjobb, kurser m.m. som användaren själv går
-- på eller jobbar på. Visas i den egna bokningskalendern (/app/calendar) och
-- spärrar de dagarna från att markeras som bokningsbara.
--
-- Privat: bara ägaren ser och skriver. Ingen publik läsning (till skillnad från
-- creator_availability) och inget i iCal-flödet — användarens egen kalender
-- är redan källan, där skulle de bli dubbletter.
CREATE TABLE IF NOT EXISTS public.creator_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('festival', 'jobb', 'kurs', 'annat')),
  role text NULL CHECK (role IS NULL OR char_length(role) <= 60),
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text NULL CHECK (location IS NULL OR char_length(location) <= 160),
  note text NULL CHECK (note IS NULL OR char_length(note) <= 1000),
  -- Resans ekonomi, uppskattad. Belopp i öre (SEK), alla valfria.
  purpose text NULL CHECK (purpose IS NULL OR purpose IN ('jobb', 'larande', 'natverk', 'marknadsforing', 'noje', 'annat')),
  cost_transport_ore integer NULL CHECK (cost_transport_ore IS NULL OR cost_transport_ore BETWEEN 0 AND 100000000),
  cost_lodging_ore integer NULL CHECK (cost_lodging_ore IS NULL OR cost_lodging_ore BETWEEN 0 AND 100000000),
  cost_food_ore integer NULL CHECK (cost_food_ore IS NULL OR cost_food_ore BETWEEN 0 AND 100000000),
  cost_ticket_ore integer NULL CHECK (cost_ticket_ore IS NULL OR cost_ticket_ore BETWEEN 0 AND 100000000),
  cost_other_ore integer NULL CHECK (cost_other_ore IS NULL OR cost_other_ore BETWEEN 0 AND 100000000),
  income_ore integer NULL CHECK (income_ore IS NULL OR income_ore BETWEEN 0 AND 100000000),
  cost_note text NULL CHECK (cost_note IS NULL OR char_length(cost_note) <= 500),
  -- Varifrån raden kom. 'google' = importerad via kalenderns hemliga iCal-adress;
  -- external_uid är händelsens UID där, så att en ny hämtning uppdaterar i
  -- stället för att dubblera.
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'google')),
  external_uid text NULL CHECK (external_uid IS NULL OR char_length(external_uid) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_commitments_dates_check CHECK (end_date >= start_date),
  CONSTRAINT creator_commitments_user_external_uid_key UNIQUE (user_id, external_uid)
);

CREATE INDEX IF NOT EXISTS idx_creator_commitments_user_start
  ON public.creator_commitments (user_id, start_date);

ALTER TABLE public.creator_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own commitments" ON public.creator_commitments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner adds own commitments" ON public.creator_commitments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner updates own commitments" ON public.creator_commitments
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner removes own commitments" ON public.creator_commitments
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.creator_commitments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_commitments TO authenticated;

-- ─── Import från extern kalender ───

-- Hemliga iCal-adressen till användarens Google-kalender. Den är en
-- bärarnyckel (hela kalendern för den som har den), så den skyddas som
-- calendar_sync_token: profiles har sedan 20260813b ingen tabell-bred SELECT
-- för anon/authenticated utan en kolumn-allowlist, och den här kolumnen läggs
-- INTE till där. Den läses och skrivs bara med service-role efter en
-- getUser()-ägarkontroll (src/app/app/calendar/actions.ts, page.tsx).
-- Raden nedan är en påminnelse, inte skyddet: kolumn-REVOKE är en no-op om
-- tabell-grant:en någon gång kommer tillbaka — verifiera med
--   select grantee, privilege_type from information_schema.column_privileges
--    where table_name = 'profiles' and column_name = 'external_calendar_ics_url';
-- (ska ge noll rader för anon och authenticated när det gäller SELECT).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS external_calendar_ics_url text NULL
    CHECK (external_calendar_ics_url IS NULL OR char_length(external_calendar_ics_url) <= 2000);

REVOKE SELECT (external_calendar_ics_url) ON public.profiles FROM anon, authenticated;

-- Förslag från den externa kalendern som användaren valt att dölja, så att de
-- inte kommer tillbaka vid nästa hämtning.
CREATE TABLE IF NOT EXISTS public.calendar_import_hidden (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_uid text NOT NULL CHECK (char_length(external_uid) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, external_uid)
);

ALTER TABLE public.calendar_import_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own hidden imports" ON public.calendar_import_hidden
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.calendar_import_hidden FROM anon;
GRANT SELECT, INSERT, DELETE ON public.calendar_import_hidden TO authenticated;
