-- Matkupongen löses in av restaurangen med en kod, med ett tak per kupong.
--
-- Arrangören bjuder volontärerna på mat och alkoholfri dryck under AW:n upp
-- till ett tak (standard 100 kr); restaurangen tar betalt av arrangören vid
-- kvällens slut. Utan kod kunde vem som helst trycka "Lös in" på volontärens
-- telefon. Inställningen gäller per serie (annars per kväll): scope_id är
-- series_id om kvällen har en, annars kvällens id.
create table if not exists public.volunteer_voucher_settings (
  scope_id uuid primary key,
  code text not null check (code ~ '^[0-9]{4,6}$'),
  max_ore integer not null default 10000 check (max_ore between 100 and 100000),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.volunteer_voucher_settings enable row level security;
revoke all on public.volunteer_voucher_settings from anon, authenticated;

-- Det restaurangen faktiskt slog in, för avstämning mot notan. Äldre
-- kuponger saknar belopp.
alter table public.taxi_vouchers
  add column if not exists amount_ore integer check (amount_ore is null or amount_ore between 0 and 100000);
