-- Pull-model marketplace: arrangörer (experience role) post gigs that
-- taxi_dancers can browse and apply to. When the arrangör accepts an
-- application, a B2B booking is created and the existing payment flow
-- (Stripe Connect via /api/stripe/booking-pay) takes over.

CREATE TABLE IF NOT EXISTS public.gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arranger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  venue TEXT,
  venue_address TEXT,
  proposed_price INTEGER NOT NULL CHECK (proposed_price >= 0),
  perks TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gigs_arranger ON public.gigs (arranger_id);
CREATE INDEX IF NOT EXISTS idx_gigs_status_event_date ON public.gigs (status, event_date)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.gig_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gig_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_applications_gig ON public.gig_applications (gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_applications_applicant ON public.gig_applications (applicant_id);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads open gigs" ON public.gigs
  FOR SELECT USING (status = 'open' OR arranger_id = auth.uid());

CREATE POLICY "Experience role manages own gigs" ON public.gigs
  FOR ALL USING (
    arranger_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'experience'
    )
  )
  WITH CHECK (
    arranger_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'experience'
    )
  );

CREATE POLICY "Read own applications" ON public.gig_applications
  FOR SELECT USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gigs g
      WHERE g.id = gig_id AND g.arranger_id = auth.uid()
    )
  );

CREATE POLICY "Taxi dancer applies" ON public.gig_applications
  FOR INSERT WITH CHECK (
    applicant_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'creator'
        AND p.creator_subcategory = 'taxi_dancer'
    )
  );

CREATE POLICY "Update own application or applications to own gig" ON public.gig_applications
  FOR UPDATE USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gigs g
      WHERE g.id = gig_id AND g.arranger_id = auth.uid()
    )
  );
