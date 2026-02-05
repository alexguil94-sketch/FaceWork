-- FaceWork (static HTML) — Supabase Storage setup (bucket + RLS)
-- Run this AFTER `supabase/schema.sql`.
--
-- Goal:
-- - Allow authenticated users to upload files to a Storage bucket
-- - Restrict access by workspace/company (first folder in the path)
--
-- App convention (js/app.js):
--   sb://facework/<company>/posts/<optional-subfolder>/<postId>/<filename>
--
-- 1) Create the bucket in Supabase Dashboard:
--    Storage → New bucket → name: `facework`
--    Recommended: keep it PRIVATE (public = false).
--
-- Optional: bucket creation via SQL (uncomment if you prefer)
-- insert into storage.buckets (id, name, public)
-- values ('facework', 'facework', false)
-- on conflict (id) do nothing;

-- Ensure RLS is enabled on objects
alter table storage.objects enable row level security;

-- Read: members can download any file in their company folder
drop policy if exists "facework_read_company" on storage.objects;
create policy "facework_read_company"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'facework'
  and (storage.foldername(name))[1] = public.current_company()
);

-- Upload: members can upload files only inside their company folder
drop policy if exists "facework_upload_company" on storage.objects;
create policy "facework_upload_company"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'facework'
  and (storage.foldername(name))[1] = public.current_company()
  and auth.uid() = owner
);

-- Delete: owners can delete their files; admins can delete within the company folder
drop policy if exists "facework_delete_owner_or_admin" on storage.objects;
create policy "facework_delete_owner_or_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'facework'
  and (storage.foldername(name))[1] = public.current_company()
  and (auth.uid() = owner or public.is_admin())
);

