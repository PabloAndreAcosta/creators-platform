-- Backfill nice, self-describing slugs onto listings that were created without
-- one. Recurring occurrences added via "duplicate" used to inherit no slug
-- (slug=null), which broke /event/<series-slug> resolution (it fell back to the
-- occurrence slug, which was null). Each gets `<series-slug-or-title>-<date>`,
-- matching the pattern the create flow already uses (the-kiz-lab-2026-06-08).
--
-- Explicit per-row updates keep this auditable; each is guarded on slug IS NULL
-- so re-running is a no-op. The partial unique index on listings.slug (unique
-- where slug is not null) was verified free of these values before writing.

-- The Kiz Lab series occurrences (active)
update listings set slug = 'the-kiz-lab-2026-06-22'
  where id = 'de940569-dca6-4cdd-a5aa-ddc5666da39c' and slug is null;
update listings set slug = 'the-kiz-lab-2026-06-29'
  where id = '57203f94-1c5e-4f3c-96ee-2dff021e0c0e' and slug is null;
update listings set slug = 'the-kiz-lab-2026-07-06'
  where id = 'ba607b9d-b912-44f7-bcd7-8942b87651cc' and slug is null;

-- Inactive duplicate occurrence on the same date — suffixed to stay unique.
update listings set slug = 'the-kiz-lab-2026-06-22-2'
  where id = 'aa1a47d5-ee45-4fc3-a876-cd23230b0437' and slug is null;

-- Standalone listings without a slug.
update listings set slug = 'privat-danslektion'
  where id = '091cf483-abb1-483e-8145-681555d47c79' and slug is null;
update listings set slug = 'vardskap-2026-06-08'
  where id = '16f45fc1-343f-4f68-94ff-9233ae22e77d' and slug is null;
