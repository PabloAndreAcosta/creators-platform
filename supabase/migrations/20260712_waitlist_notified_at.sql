-- Track when a waitlisted person was emailed that a seat opened up (a refund /
-- cancellation freed capacity on a sold-out event). Null = not yet notified;
-- lets us walk the FIFO waitlist one freed seat at a time without re-notifying.
alter table public.event_waitlist
  add column if not exists notified_at timestamptz;
comment on column public.event_waitlist.notified_at is
  'When this person was emailed that a seat opened up (refund/cancel freed capacity). Null = not yet notified; used to walk the FIFO list one seat at a time.';
