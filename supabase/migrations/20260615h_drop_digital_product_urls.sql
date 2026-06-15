-- Paywall fix for digital products (part 2 of 2).
--
-- APPLY ONLY AFTER the code from this PR is deployed. Until then the live code
-- still selects digital_products.video_url / file_url, so dropping the columns
-- earlier would break those queries.
--
-- Re-backfill first to catch any product created in the window between part 1
-- and the deploy (old code wrote the URL to digital_products, not the content
-- table). on conflict do nothing keeps content rows the new code already wrote.
insert into public.digital_product_content (product_id, video_url, file_url)
  select id, video_url, file_url
    from public.digital_products
   where video_url is not null or file_url is not null
on conflict (product_id) do nothing;

-- Remove the now-unused, publicly-readable content columns from the metadata
-- table. The "Anyone can view active products" RLS no longer exposes any URL.
alter table public.digital_products drop column if exists video_url;
alter table public.digital_products drop column if exists file_url;

-- ── ROLLBACK ──
--   alter table public.digital_products add column video_url text;
--   alter table public.digital_products add column file_url text;
--   update public.digital_products d set video_url = c.video_url, file_url = c.file_url
--     from public.digital_product_content c where c.product_id = d.id;
