-- En borttagen listing tog med sig alla bokningar och använda klipp (CASCADE).
-- Appen spärrar sedan #468, men databasen ska också säga nej: en kväll eller
-- ett klippkort med bokningar inaktiveras, det tas inte bort.
ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_listing_id_fkey,
  ADD CONSTRAINT bookings_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;

ALTER TABLE public.pass_redemptions
  DROP CONSTRAINT pass_redemptions_listing_id_fkey,
  ADD CONSTRAINT pass_redemptions_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE RESTRICT;

-- Ett tillsatt uppdrag skapar en dold listing hos den som fick det, bara för att
-- bokningen ska ha något att peka på. Den hör inte hemma i personens Utbud.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS from_gig boolean NOT NULL DEFAULT false;
