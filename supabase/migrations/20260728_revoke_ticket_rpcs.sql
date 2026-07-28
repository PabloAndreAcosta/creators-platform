-- Lock down ticket-inventory RPCs to the service role.
--
-- increment_tickets_sold / reserve_ticket / redeem_access_code /
-- consume_access_code are SECURITY DEFINER functions that write listings
-- inventory and access-code counters directly. They were left with the default
-- PUBLIC execute grant (+ explicit anon/authenticated), so anyone with the
-- browser anon key could POST /rest/v1/rpc/increment_tickets_sold with an
-- arbitrary p_listing/p_n and force ANY event sold-out (sales DoS), or burn
-- access codes. Every legitimate caller (webhook, ticket-checkout,
-- guest-checkout, redeem-code, booking cancel) uses the service-role client,
-- which keeps its own EXECUTE grant and bypasses this revoke.
--
-- IMPORTANT: apply this only AFTER the ticket-checkout code that switches these
-- calls to the service-role client is deployed (older code called them on the
-- user client and would break).

REVOKE EXECUTE ON FUNCTION public.increment_tickets_sold(uuid, integer, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_ticket(uuid, uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_access_code(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_access_code(uuid) FROM public, anon, authenticated;
