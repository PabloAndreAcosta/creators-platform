--
-- pending_swish_seats ska bara nås av service_role (kortkassan via reserve_ticket).
-- Supabase ger anon och authenticated EXECUTE på nya funktioner som standard;
-- REVOKE FROM PUBLIC i 20261126080000 tog inte bort de direkta rättigheterna.
-- Körd i prod 2026-11-26 tillsammans med 20261126080000.
--
REVOKE EXECUTE ON FUNCTION public.pending_swish_seats(uuid, uuid[]) FROM anon, authenticated;
