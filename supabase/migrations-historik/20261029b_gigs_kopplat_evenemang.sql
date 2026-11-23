-- Ett uppdrag kan höra till ett av arrangörens egna evenemang (en kväll i en
-- serie), och säger vilken sorts pass det är. Båda är valfria: fristående
-- uppdrag fungerar som förut.
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pass_type text CHECK (pass_type IN ('taxi_dancer', 'instructor', 'other'));
CREATE INDEX IF NOT EXISTS gigs_listing_id_idx ON public.gigs(listing_id);
