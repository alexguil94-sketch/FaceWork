-- FaceWork (static HTML) — Supabase schema
-- Paste this file into: Supabase Dashboard → SQL Editor → Run
--
-- This schema is designed for a front-only app (no server) using:
-- - Supabase Auth (email/password)
-- - Postgres tables with RLS policies
-- - Simple counters via triggers (likes_count, message_count)

-- Extensions (for gen_random_uuid)
create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Helpers for RLS
-- -------------------------------------------------------------------
create or replace function public.current_company()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select company from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
$$;

-- -------------------------------------------------------------------
-- Core tables
-- -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  company text not null,
  name text not null,
  role text not null default 'member',
  avatar_url text not null default '',
  avatar_bg text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  name text not null,
  color text not null default '#7c3aed',
  perms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(company, name)
);

create table if not exists public.member_roles (
  company text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company, user_id, role_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  file_url text not null default '',
  file_name text not null default '',
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  company text not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company, post_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  type text not null default 'public' check (type in ('public','private','voice')),
  name text not null,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company, type, name)
);

create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  user1 uuid not null references public.profiles(id) on delete cascade,
  user2 uuid not null references public.profiles(id) on delete cascade,
  message_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dm_user_order check (user1 < user2),
  unique(company, user1, user2)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- Seed per company (roles + default channels) + first admin assignment
-- -------------------------------------------------------------------
create or replace function public.init_company(_company text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.roles (company, name, color, perms)
  values
    (_company, 'Admin', '#ff2d78', jsonb_build_object('admin', true, 'manageRoles', true, 'manageMembers', true, 'manageChannels', true)),
    (_company, 'Modérateur', '#7c3aed', jsonb_build_object('manageMembers', true, 'manageChannels', true)),
    (_company, 'Membre', '#3b82f6', '{}'::jsonb)
  on conflict (company, name) do nothing;

  insert into public.channels (company, type, name)
  values
    (_company, 'public', 'général'),
    (_company, 'public', 'annonces'),
    (_company, 'public', 'random'),
    (_company, 'public', 'support'),
    (_company, 'voice', 'general')
  on conflict (company, type, name) do nothing;
end;
$$;

create or replace function public.profiles_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  if new.company is null or btrim(new.company) = '' then
    new.company := 'Entreprise';
  end if;
  if new.name is null or btrim(new.name) = '' then
    new.name := 'Utilisateur';
  end if;

  select count(*) into cnt
  from public.profiles
  where company = new.company;

  if cnt = 0 then
    new.role := 'admin';
  else
    new.role := 'member';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_before_insert on public.profiles;
create trigger profiles_before_insert
before insert on public.profiles
for each row execute function public.profiles_before_insert();

create or replace function public.profiles_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role_id uuid;
  member_role_id uuid;
begin
  perform public.init_company(new.company);

  select id into member_role_id
  from public.roles
  where company = new.company and lower(name) = 'membre'
  limit 1;

  if member_role_id is not null then
    insert into public.member_roles(company, user_id, role_id)
    values (new.company, new.id, member_role_id)
    on conflict do nothing;
  end if;

  if new.role = 'admin' then
    select id into admin_role_id
    from public.roles
    where company = new.company and lower(name) = 'admin'
    limit 1;

    if admin_role_id is not null then
      insert into public.member_roles(company, user_id, role_id)
      values (new.company, new.id, admin_role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_after_insert on public.profiles;
create trigger profiles_after_insert
after insert on public.profiles
for each row execute function public.profiles_after_insert();

-- -------------------------------------------------------------------
-- Counters via triggers
-- -------------------------------------------------------------------
create or replace function public.post_likes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = likes_count + 1
  where id = new.post_id;
  return new;
end;
$$;

create or replace function public.post_likes_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = greatest(likes_count - 1, 0)
  where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_likes_ai on public.post_likes;
create trigger post_likes_ai
after insert on public.post_likes
for each row execute function public.post_likes_after_insert();

drop trigger if exists post_likes_ad on public.post_likes;
create trigger post_likes_ad
after delete on public.post_likes
for each row execute function public.post_likes_after_delete();

create or replace function public.channel_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.channels
  set message_count = message_count + 1
  where id = new.channel_id;
  return new;
end;
$$;

drop trigger if exists channel_messages_ai on public.channel_messages;
create trigger channel_messages_ai
after insert on public.channel_messages
for each row execute function public.channel_messages_after_insert();

create or replace function public.dm_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads
  set
    message_count = message_count + 1,
    last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists dm_messages_ai on public.dm_messages;
create trigger dm_messages_ai
after insert on public.dm_messages
for each row execute function public.dm_messages_after_insert();

-- -------------------------------------------------------------------
-- RLS (Row Level Security)
-- -------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.channels enable row level security;
alter table public.channel_messages enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

-- Profiles
drop policy if exists profiles_select_company on public.profiles;
create policy profiles_select_company
on public.profiles
for select
to authenticated
using (company = public.current_company());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and company = public.current_company());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.is_admin() and company = public.current_company())
with check (company = public.current_company());

-- Roles
drop policy if exists roles_select_company on public.roles;
create policy roles_select_company
on public.roles
for select
to authenticated
using (company = public.current_company());

drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write
on public.roles
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (public.is_admin() and company = public.current_company());

-- Member roles
drop policy if exists member_roles_select_company on public.member_roles;
create policy member_roles_select_company
on public.member_roles
for select
to authenticated
using (company = public.current_company());

drop policy if exists member_roles_admin_write on public.member_roles;
create policy member_roles_admin_write
on public.member_roles
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (
  public.is_admin()
  and company = public.current_company()
  and exists (select 1 from public.profiles p where p.id = user_id and p.company = public.current_company())
  and exists (select 1 from public.roles r where r.id = role_id and r.company = public.current_company())
);

-- Posts
drop policy if exists posts_select_company on public.posts;
create policy posts_select_company
on public.posts
for select
to authenticated
using (company = public.current_company());

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own
on public.posts
for insert
to authenticated
with check (company = public.current_company() and author_id = auth.uid());

drop policy if exists posts_delete_own_or_admin on public.posts;
create policy posts_delete_own_or_admin
on public.posts
for delete
to authenticated
using (company = public.current_company() and (author_id = auth.uid() or public.is_admin()));

-- Post likes
drop policy if exists post_likes_select_own on public.post_likes;
create policy post_likes_select_own
on public.post_likes
for select
to authenticated
using (company = public.current_company() and user_id = auth.uid());

drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own
on public.post_likes
for insert
to authenticated
with check (
  company = public.current_company()
  and user_id = auth.uid()
  and exists (select 1 from public.posts p where p.id = post_id and p.company = public.current_company())
);

drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own
on public.post_likes
for delete
to authenticated
using (company = public.current_company() and user_id = auth.uid());

-- Channels
drop policy if exists channels_select_company on public.channels;
create policy channels_select_company
on public.channels
for select
to authenticated
using (company = public.current_company());

drop policy if exists channels_admin_write on public.channels;
create policy channels_admin_write
on public.channels
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (public.is_admin() and company = public.current_company());

-- Channel messages
drop policy if exists channel_messages_select_company on public.channel_messages;
create policy channel_messages_select_company
on public.channel_messages
for select
to authenticated
using (company = public.current_company());

drop policy if exists channel_messages_insert_own on public.channel_messages;
create policy channel_messages_insert_own
on public.channel_messages
for insert
to authenticated
with check (
  company = public.current_company()
  and user_id = auth.uid()
  and exists (select 1 from public.channels c where c.id = channel_id and c.company = public.current_company())
);

-- DM threads
drop policy if exists dm_threads_select_own on public.dm_threads;
create policy dm_threads_select_own
on public.dm_threads
for select
to authenticated
using (
  company = public.current_company()
  and (user1 = auth.uid() or user2 = auth.uid())
);

drop policy if exists dm_threads_insert_own on public.dm_threads;
create policy dm_threads_insert_own
on public.dm_threads
for insert
to authenticated
with check (
  company = public.current_company()
  and (user1 = auth.uid() or user2 = auth.uid())
  and user1 < user2
);

-- Needed for upsert (insert ... on conflict do update)
drop policy if exists dm_threads_update_own on public.dm_threads;
create policy dm_threads_update_own
on public.dm_threads
for update
to authenticated
using (company = public.current_company() and (user1 = auth.uid() or user2 = auth.uid()))
with check (company = public.current_company() and (user1 = auth.uid() or user2 = auth.uid()) and user1 < user2);

-- DM messages
drop policy if exists dm_messages_select_own on public.dm_messages;
create policy dm_messages_select_own
on public.dm_messages
for select
to authenticated
using (
  company = public.current_company()
  and exists (
    select 1
    from public.dm_threads t
    where t.id = thread_id
      and t.company = public.current_company()
      and (t.user1 = auth.uid() or t.user2 = auth.uid())
  )
);

drop policy if exists dm_messages_insert_own on public.dm_messages;
create policy dm_messages_insert_own
on public.dm_messages
for insert
to authenticated
with check (
  company = public.current_company()
  and sender_id = auth.uid()
  and exists (
    select 1
    from public.dm_threads t
    where t.id = thread_id
      and t.company = public.current_company()
      and (t.user1 = auth.uid() or t.user2 = auth.uid())
  )
);

-- -------------------------------------------------------------------
-- Grants (Supabase typically already grants to authenticated, but keep explicit)
-- -------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.roles,
  public.member_roles,
  public.posts,
  public.post_likes,
  public.channels,
  public.channel_messages,
  public.dm_threads,
  public.dm_messages
to authenticated;

