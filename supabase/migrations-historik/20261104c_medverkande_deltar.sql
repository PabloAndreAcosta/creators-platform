-- Medverkande (listing_collaborators) syns publikt bara de kvällar de själva
-- valt att vara med. Love, Paulina och Mariana är medarrangörer på varje
-- The Lab-kväll för behörigheternas skull, men är inte där varje gång — att
-- visa dem på alla kvällar lovade publiken något som inte stämde.
-- Standard nej: ingen syns förrän hen valt att delta den kvällen.
ALTER TABLE public.listing_collaborators
  ADD COLUMN IF NOT EXISTS attending boolean NOT NULL DEFAULT false;
