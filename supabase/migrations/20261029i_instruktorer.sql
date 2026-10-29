-- Instruktörer: vilken kreatör som helst kan slå på offers_coaching i profilen
-- (tidigare bara taxidansare). Två nya fält för katalogen på /instruktorer:
-- en fri titel (Instruktör, Coach, PT …) och var lektionerna sker.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coaching_title text
    CHECK (coaching_title IS NULL OR char_length(coaching_title) BETWEEN 1 AND 40),
  ADD COLUMN IF NOT EXISTS coaching_formats text[]
    CHECK (coaching_formats IS NULL OR coaching_formats <@ ARRAY['in_person', 'online']::text[]);

-- profiles läses kolumn för kolumn (tabell-bred SELECT är borttagen), så nya
-- publika kolumner måste ges läsrätt uttryckligen.
GRANT SELECT (coaching_title, coaching_formats) ON public.profiles TO anon, authenticated;
