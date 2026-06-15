-- Paywall fix for digital products (part 1 of 2 — additive, safe to apply before
-- the code deploy).
--
-- Problem: digital_products.video_url / file_url (the actual paid content) were
-- readable by anyone — the public "Anyone can view active products" RLS exposes
-- every column, and the creator profile page shipped video_url to the browser.
-- So paid content could be fetched without paying.
--
-- Fix: move the content URLs into a separate table whose RLS only lets the
-- creator OR a buyer (someone with a digital_purchases row) read them. Free
-- products record a free purchase at claim time, so content is never exposed
-- before the buy/claim flow. digital_products keeps only metadata.
--
-- Part 2 (20260615h, applied AFTER the new code deploys) drops the now-unused
-- video_url / file_url columns from digital_products.

create table if not exists public.digital_product_content (
  product_id uuid primary key references public.digital_products(id) on delete cascade,
  video_url text,
  file_url text,
  updated_at timestamptz not null default now()
);

alter table public.digital_product_content enable row level security;

-- The creator fully manages content for their own products.
drop policy if exists "creator manages own content" on public.digital_product_content;
create policy "creator manages own content" on public.digital_product_content
  for all
  using (product_id in (select id from public.digital_products where creator_id = auth.uid()))
  with check (product_id in (select id from public.digital_products where creator_id = auth.uid()));

-- Buyers read content only for products they hold a purchase for (a free claim
-- records a purchase too, so nothing is exposed unpaid).
drop policy if exists "buyers read purchased content" on public.digital_product_content;
create policy "buyers read purchased content" on public.digital_product_content
  for select
  using (product_id in (select product_id from public.digital_purchases where buyer_id = auth.uid()));

-- Backfill existing content from the columns that are about to be retired.
insert into public.digital_product_content (product_id, video_url, file_url)
  select id, video_url, file_url
    from public.digital_products
   where video_url is not null or file_url is not null
on conflict (product_id) do nothing;

-- ── ROLLBACK ──
--   drop table if exists public.digital_product_content;
