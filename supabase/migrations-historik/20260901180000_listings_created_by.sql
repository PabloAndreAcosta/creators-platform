-- Vem som faktiskt skapade evenemanget, när det inte är ägaren själv.
--
-- I fas 2 kan en lokals teammedlem skapa evenemang i lokalens namn. Raden måste
-- då ägas av LOKALENS konto (user_id), eftersom det är den kopplingen pengarna
-- följer — ett evenemang som ägs av medlemmen personligen skulle skicka
-- intäkten till fel ställe och lämna delningsavtalet hängande.
--
-- Men då försvinner spårbarheten precis där den behövs som mest, i pengarnas
-- närhet: raden ser ut att vara skapad av ägaren fast någon annan gjorde det.
-- created_by minns vem.
--
-- NULL betyder "ägaren själv" och är det normala. Kolumnen fylls bara i när
-- någon annan skapat raden, så befintliga evenemang behöver ingen bakåtfyllning.

alter table public.listings
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

comment on column public.listings.created_by is
  'Teammedlemmen som skapade evenemanget i lokalens namn. NULL = ägaren själv skapade det.';

create index if not exists listings_created_by_idx
  on public.listings(created_by) where created_by is not null;
