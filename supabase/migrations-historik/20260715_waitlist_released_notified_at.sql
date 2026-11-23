-- Track when a waitlisted person was emailed that tickets were RELEASED / went
-- on sale (fulfilling the promise in the waitlist confirmation email — "we'll
-- email you the moment tickets are released"). Null = not yet notified.
--
-- Deliberately SEPARATE from notified_at, which tracks the unrelated "a seat
-- opened up (refund/cancel freed capacity)" flow. The two columns must never
-- collide: a person can be release-notified once and later seat-freed-notified.
alter table public.event_waitlist
  add column if not exists released_notified_at timestamptz;

comment on column public.event_waitlist.released_notified_at is
  'When this person was emailed that tickets were released / went on sale. Null = not yet notified. Separate from notified_at (refund seat-freed flow).';

-- Makes the cron''s "who still needs a release email" scan cheap: only rows
-- awaiting a release email from an active (non-unsubscribed) subscriber.
create index if not exists event_waitlist_release_pending_idx
  on public.event_waitlist (listing_id)
  where released_notified_at is null and unsubscribed_at is null;
