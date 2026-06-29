-- Anna-feedback: separat kvadratisk bild för mobilvyn (full titel syns).
-- Additiv, nullbar. Faller tillbaka på image_url när den är null.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_url_square text;

COMMENT ON COLUMN public.listings.image_url_square IS
  'Valfri kvadratisk variant av bannern som visas på mobil; null → använd image_url.';
