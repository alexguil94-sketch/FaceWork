-- FaceWork (static HTML) - Supabase Storage setup (bucket + RLS policies)
-- Run this AFTER `supabase/schema.sql`.
--
-- Goal:
-- - Allow authenticated users to upload files to a Storage bucket
-- - Restrict access by workspace/company (first folder in the path)
--
-- App convention (js/app.js):
--   sb://facework/<company>/posts/<optional-subfolder>/<postId>/<filename>
--
-- IMPORTANT (about the error you saw: "must be owner of table objects"):
-- - In many Supabase projects, `storage.objects` is owned by `supabase_storage_admin`.
-- - If your SQL Editor runs as `postgres` but you are NOT allowed to "become owner",
--   then `ALTER TABLE storage.objects ...` / `CREATE POLICY ... ON storage.objects` will fail.
--
-- This script is "safe":
-- - It will TRY to create the bucket + policies.
-- - If your project forbids it, it will NOT crash; it will show the expressions to paste in the Dashboard UI:
--   Storage -> Policies -> New policy (custom).
+
+do $$
+begin
+  -- Optional: create the bucket (you can also do it in Dashboard -> Storage).
+  begin
+    insert into storage.buckets (id, name, public)
+    values ('facework', 'facework', false)
+    on conflict (id) do nothing;
+  exception
+    when insufficient_privilege then
+      raise notice 'Skipping bucket insert: insufficient privileges. Create bucket "facework" in Dashboard -> Storage.';
+    when others then
+      raise notice 'Skipping bucket insert: %', sqlerrm;
+  end;
+
+  -- Policies on storage.objects (may require table ownership)
+  begin
+    execute 'drop policy if exists "facework_read_company" on storage.objects';
+    execute $pol$
+      create policy "facework_read_company"
+      on storage.objects
+      for select
+      to authenticated
+      using (
+        bucket_id = 'facework'
+        and (storage.foldername(name))[1] = public.current_company()
+      )
+    $pol$;
+
+    execute 'drop policy if exists "facework_upload_company" on storage.objects';
+    execute $pol$
+      create policy "facework_upload_company"
+      on storage.objects
+      for insert
+      to authenticated
+      with check (
+        bucket_id = 'facework'
+        and (storage.foldername(name))[1] = public.current_company()
+        and auth.uid() = owner
+      )
+    $pol$;
+
+    execute 'drop policy if exists "facework_delete_owner_or_admin" on storage.objects';
+    execute $pol$
+      create policy "facework_delete_owner_or_admin"
+      on storage.objects
+      for delete
+      to authenticated
+      using (
+        bucket_id = 'facework'
+        and (storage.foldername(name))[1] = public.current_company()
+        and (auth.uid() = owner or public.is_admin())
+      )
+    $pol$;
+  exception
+    when insufficient_privilege then
+      raise notice 'Cannot create policies on storage.objects from this SQL session. Create them in Dashboard -> Storage -> Policies.';
+    when others then
+      raise notice 'Cannot create policies on storage.objects: %', sqlerrm;
+  end;
+end $$;
+
+-- -------------------------------------------------------------------
+-- Verification (run this query after you try to apply the policies)
+-- -------------------------------------------------------------------
+select
+  policyname,
+  cmd
+from pg_policies
+where schemaname = 'storage'
+  and tablename = 'objects'
+  and policyname in (
+    'facework_read_company',
+    'facework_upload_company',
+    'facework_delete_owner_or_admin'
+  )
+order by policyname;
+
+-- -------------------------------------------------------------------
+-- If the verification query returns 0 rows, create the policies in the UI using:
+-- Storage -> (bucket: facework) -> Policies -> New policy (custom)
+-- -------------------------------------------------------------------
+select
+  'facework_read_company' as policy_name,
+  'select' as operation,
+  'USING' as ui_field,
+  $$bucket_id = 'facework' and (storage.foldername(name))[1] = public.current_company()$$ as expression
+union all
+select
+  'facework_upload_company',
+  'insert',
+  'WITH CHECK',
+  $$bucket_id = 'facework' and (storage.foldername(name))[1] = public.current_company() and auth.uid() = owner$$
+union all
+select
+  'facework_delete_owner_or_admin',
+  'delete',
+  'USING',
+  $$bucket_id = 'facework' and (storage.foldername(name))[1] = public.current_company() and (auth.uid() = owner or public.is_admin())$$;
