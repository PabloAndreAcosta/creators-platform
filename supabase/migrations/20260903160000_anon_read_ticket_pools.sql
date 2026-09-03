-- Utloggade besökare måste kunna se biljettyperna.
--
-- Evenemangssidan läser biljettyperna med potterna inbäddade:
--   ticket_types(..., ticket_type_pools(pool_id, ticket_pools(id, capacity)))
-- PostgREST kör inbäddningen som en enda fråga. Saknas rättigheten på en av
-- tabellerna faller HELA frågan, inte bara den inbäddade delen — sidan fick
-- null i stället för biljettyper och visade bara grundpriset.
--
-- ticket_pools och ticket_type_pools skapades med grant bara till
-- authenticated. RLS-policyerna på båda tabellerna är redan "läsbara för alla"
-- (using true), så avsikten var publik läsning hela tiden; det var grant:et som
-- glömdes. Tabellerna innehåller potternas namn och tak samt vilken typ som hör
-- till vilken pott — inga personuppgifter, och taken visas redan på sidan.
--
-- Bara SELECT. Skrivningarna stannar hos arrangören.
grant select on public.ticket_pools to anon;
grant select on public.ticket_type_pools to anon;
