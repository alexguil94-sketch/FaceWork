-- ComptaClair - factures en base + fichiers dans Supabase Storage
-- À exécuter dans Supabase Dashboard -> SQL Editor.
-- Requiert le schéma FaceWork existant avec public.profiles, public.current_company()
-- et le bucket Storage "facework" (voir supabase/storage.sql).

create extension if not exists pgcrypto;

create table if not exists public.comptaclair_invoices (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null default 'facture'
    check (document_type in ('facture', 'devis', 'avoir', 'autre')),
  supplier text not null default '',
  reference text not null default '',
  invoice_date date not null,
  amount numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  category text not null default '',
  email_from text not null default '',
  email_subject text not null default '',
  file_url text not null default '',
  file_name text not null default '',
  file_type text not null default '',
  file_size bigint not null default 0,
  transaction_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comptaclair_invoices_company_date_idx
on public.comptaclair_invoices(company, invoice_date desc);

alter table public.comptaclair_invoices enable row level security;

drop policy if exists comptaclair_invoices_select_company on public.comptaclair_invoices;
create policy comptaclair_invoices_select_company
on public.comptaclair_invoices
for select
to authenticated
using (company = public.current_company());

drop policy if exists comptaclair_invoices_insert_own on public.comptaclair_invoices;
create policy comptaclair_invoices_insert_own
on public.comptaclair_invoices
for insert
to authenticated
with check (company = public.current_company() and user_id = auth.uid());

drop policy if exists comptaclair_invoices_update_own_or_admin on public.comptaclair_invoices;
create policy comptaclair_invoices_update_own_or_admin
on public.comptaclair_invoices
for update
to authenticated
using (company = public.current_company() and (user_id = auth.uid() or public.is_admin()))
with check (
  company = public.current_company()
  and (user_id = auth.uid() or public.is_admin())
);

drop policy if exists comptaclair_invoices_delete_own_or_admin on public.comptaclair_invoices;
create policy comptaclair_invoices_delete_own_or_admin
on public.comptaclair_invoices
for delete
to authenticated
using (company = public.current_company() and (user_id = auth.uid() or public.is_admin()));

grant select, insert, update, delete on public.comptaclair_invoices to authenticated;

-- Storage policies complémentaires pour les fichiers ComptaClair.
-- Chemin utilisé par l'app :
--   facework/<company>/comptaclair/invoices/<user_id>/<invoice_id>/<filename>
do $$
begin
  begin
    insert into storage.buckets (id, name, public)
    values ('facework', 'facework', false)
    on conflict (id) do nothing;
  exception
    when insufficient_privilege then
      raise notice 'Bucket "facework" à créer dans Dashboard -> Storage si absent.';
    when others then
      raise notice 'Bucket setup ignoré: %', sqlerrm;
  end;

  begin
    execute 'drop policy if exists "comptaclair_files_read_company" on storage.objects';
    execute $pol$
      create policy "comptaclair_files_read_company"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'facework'
        and (storage.foldername(name))[1] = public.current_company()
        and (storage.foldername(name))[2] = 'comptaclair'
      )
    $pol$;

    execute 'drop policy if exists "comptaclair_files_upload_own" on storage.objects';
    execute $pol$
      create policy "comptaclair_files_upload_own"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'facework'
        and (storage.foldername(name))[1] = public.current_company()
        and (storage.foldername(name))[2] = 'comptaclair'
        and (storage.foldername(name))[4] = auth.uid()::text
      )
    $pol$;

    execute 'drop policy if exists "comptaclair_files_update_own" on storage.objects';
    execute $pol$
      create policy "comptaclair_files_update_own"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'facework'
        and (storage.foldername(name))[1] = public.current_company()
        and (storage.foldername(name))[2] = 'comptaclair'
        and ((storage.foldername(name))[4] = auth.uid()::text or public.is_admin())
      )
      with check (
        bucket_id = 'facework'
        and (storage.foldername(name))[1] = public.current_company()
        and (storage.foldername(name))[2] = 'comptaclair'
        and ((storage.foldername(name))[4] = auth.uid()::text or public.is_admin())
      )
    $pol$;

    execute 'drop policy if exists "comptaclair_files_delete_own_or_admin" on storage.objects';
    execute $pol$
      create policy "comptaclair_files_delete_own_or_admin"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'facework'
        and (storage.foldername(name))[1] = public.current_company()
        and (storage.foldername(name))[2] = 'comptaclair'
        and ((storage.foldername(name))[4] = auth.uid()::text or public.is_admin())
      )
    $pol$;
  exception
    when insufficient_privilege then
      raise notice 'Créer les policies Storage via Dashboard -> Storage -> Policies si nécessaire.';
    when others then
      raise notice 'Policies Storage ignorées: %', sqlerrm;
  end;
end $$;
