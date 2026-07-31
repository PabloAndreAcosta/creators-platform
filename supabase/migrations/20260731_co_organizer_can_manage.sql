-- Co-organizer capability: a listing_collaborators row with can_manage lets that
-- user ADMINISTER the event (edit, broadcast emails, stats, crew, access codes)
-- without owning it. It NEVER grants money/ownership actions — checkout, gage
-- pay, payouts, hard-delete and ownership transfer stay owner-only, enforced in
-- the server routes/actions. Mirrors can_scan (20260608b).
alter table public.listing_collaborators
  add column if not exists can_manage boolean not null default false;

comment on column public.listing_collaborators.can_manage is
  'Co-organizer: may administer the event (edit/broadcast/stats/crew/codes) but never money or ownership. Granted by the owner.';
