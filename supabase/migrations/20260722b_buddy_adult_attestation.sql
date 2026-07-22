-- 18+ self-attestation for the training-buddy pool. A hard DOB gate can't be
-- applied retroactively (BankID personal numbers are stored hashed, so age is
-- not derivable for already-verified users). Combined with the BankID identity
-- requirement, an explicit 18+ confirmation at opt-in is the v1 posture; a
-- forward-looking birth-year capture at BankID verify time is a follow-up.
alter table public.training_buddy_profiles
  add column if not exists agreed_adult boolean not null default false;
