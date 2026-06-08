-- Host can delegate ticket scanning to one or more crew members per event.
alter table listing_collaborators
  add column if not exists can_scan boolean not null default false;

-- Record who checked in a ticket (for scan history shown to host + delegated scanners).
alter table bookings
  add column if not exists scanned_by uuid references auth.users(id) on delete set null;
