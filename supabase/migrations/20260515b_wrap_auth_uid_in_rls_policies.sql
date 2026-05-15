-- Performance optimization: wrap auth.uid() calls in (SELECT auth.uid())
-- to enable initplan caching and avoid per-row re-evaluation.
-- Supabase advisor flagged 60+ policies with this pattern.

DO $migration$
DECLARE
  r RECORD;
  new_qual text;
  new_check text;
  cmd_keyword text;
  create_stmt text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      pol.polname AS policy_name,
      pol.polcmd,
      pol.polroles,
      pg_get_expr(pol.polqual, pol.polrelid) AS qual,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
      pol.polpermissive
    FROM pg_policy pol
    JOIN pg_class c ON pol.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%'
        OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%'
      )
      AND NOT (
        pg_get_expr(pol.polqual, pol.polrelid) LIKE '%( SELECT auth.uid()%'
        OR pg_get_expr(pol.polqual, pol.polrelid) LIKE '%(SELECT auth.uid()%'
      )
  LOOP
    new_qual := replace(COALESCE(r.qual, ''), 'auth.uid()', '(SELECT auth.uid())');
    new_check := replace(COALESCE(r.with_check, ''), 'auth.uid()', '(SELECT auth.uid())');

    cmd_keyword := CASE r.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policy_name, r.schema_name, r.table_name);

    IF r.polcmd = 'a' THEN
      create_stmt := format('CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (%s)',
        r.policy_name, r.schema_name, r.table_name, new_check);
    ELSIF r.polcmd = 'd' THEN
      create_stmt := format('CREATE POLICY %I ON %I.%I FOR DELETE USING (%s)',
        r.policy_name, r.schema_name, r.table_name, new_qual);
    ELSIF r.polcmd = 'r' THEN
      create_stmt := format('CREATE POLICY %I ON %I.%I FOR SELECT USING (%s)',
        r.policy_name, r.schema_name, r.table_name, new_qual);
    ELSIF r.polcmd = 'w' THEN
      IF r.with_check IS NOT NULL THEN
        create_stmt := format('CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
          r.policy_name, r.schema_name, r.table_name, new_qual, new_check);
      ELSE
        create_stmt := format('CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s)',
          r.policy_name, r.schema_name, r.table_name, new_qual);
      END IF;
    ELSIF r.polcmd = '*' THEN
      IF r.with_check IS NOT NULL THEN
        create_stmt := format('CREATE POLICY %I ON %I.%I FOR ALL USING (%s) WITH CHECK (%s)',
          r.policy_name, r.schema_name, r.table_name, new_qual, new_check);
      ELSE
        create_stmt := format('CREATE POLICY %I ON %I.%I FOR ALL USING (%s)',
          r.policy_name, r.schema_name, r.table_name, new_qual);
      END IF;
    END IF;

    EXECUTE create_stmt;
    RAISE NOTICE 'Rewrote policy % on %.%', r.policy_name, r.schema_name, r.table_name;
  END LOOP;
END;
$migration$;
