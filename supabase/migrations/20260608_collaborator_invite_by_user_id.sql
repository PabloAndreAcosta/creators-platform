-- Allow inviting an existing app user directly by their profile/user id,
-- in addition to email/phone link invites.
alter table collaborator_invites
  add column if not exists invited_user_id uuid references auth.users(id) on delete cascade;

-- Relax the target constraint: an invite must have at least one of
-- email, phone, or a targeted app user.
alter table collaborator_invites drop constraint if exists collaborator_invites_target_check;
alter table collaborator_invites add constraint collaborator_invites_target_check
  check (invited_email is not null or invited_phone is not null or invited_user_id is not null);

create index if not exists collaborator_invites_invited_user_id_idx
  on collaborator_invites (invited_user_id) where invited_user_id is not null;
