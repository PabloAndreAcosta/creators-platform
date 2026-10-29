-- Elevregistret: säljarens egna, privata anteckningar om en elev. Eleven är
-- antingen ett konto (customer:<uuid>) eller en gästköpare (guest:<e-post>).
-- Bara ägaren ser och skriver; eleven ser aldrig anteckningen.
CREATE TABLE IF NOT EXISTS public.student_notes (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_key text NOT NULL CHECK (char_length(student_key) BETWEEN 3 AND 320),
  note text NOT NULL CHECK (char_length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, student_key)
);

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own student notes" ON public.student_notes
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

REVOKE ALL ON public.student_notes FROM anon;
