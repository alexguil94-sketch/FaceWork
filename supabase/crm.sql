-- FaceWork CRM / Facturation (France freelance)
-- Run this AFTER `supabase/schema.sql`.
--
-- What this adds:
-- - CRM settings per company
-- - Clients
-- - Quotes + quote items
-- - Invoices + invoice items
-- - Payment tracking
-- - Unique yearly numbering (DEV-2026-001 / FAC-2026-001)
-- - Quote -> invoice conversion
-- - Admin-only RLS policies

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- CRM tables
-- -------------------------------------------------------------------
create table if not exists public.crm_settings (
  company text primary key,
  trade_name text not null default '',
  legal_name text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'France',
  email text not null default '',
  phone text not null default '',
  siret text not null default '',
  default_vat_rate numeric(5,2) not null default 0 check (default_vat_rate >= 0 and default_vat_rate <= 100),
  vat_note text not null default 'TVA non applicable, article 293 B du CGI',
  currency text not null default 'EUR',
  payment_terms_default text not null default 'Paiement a 30 jours date de facture.',
  quote_validity_days integer not null default 30 check (quote_validity_days >= 0 and quote_validity_days <= 365),
  default_notes text not null default '',
  late_penalties text not null default 'Penalites de retard exigibles sans rappel : taux legal en vigueur majore.',
  recovery_indemnity text not null default 'Indemnite forfaitaire pour frais de recouvrement : 40 EUR pour les clients professionnels.',
  numbering_quote_prefix text not null default 'DEV',
  numbering_invoice_prefix text not null default 'FAC',
  numbering_padding integer not null default 3 check (numbering_padding between 3 and 6),
  primary_color text not null default '#111111',
  logo_url text not null default '',
  logo_storage_path text not null default '',
  social_instagram_url text not null default '',
  social_facebook_url text not null default '',
  social_linkedin_url text not null default '',
  social_whatsapp_url text not null default '',
  business_type text not null default 'micro' check (business_type in ('micro','subject_to_vat','company')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_settings add column if not exists social_instagram_url text not null default '';
alter table public.crm_settings add column if not exists social_facebook_url text not null default '';
alter table public.crm_settings add column if not exists social_linkedin_url text not null default '';
alter table public.crm_settings add column if not exists social_whatsapp_url text not null default '';

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  kind text not null default 'business' check (kind in ('person','business')),
  display_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  company_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'France',
  client_siret text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_sequences (
  company text not null,
  doc_type text not null check (doc_type in ('quote','invoice')),
  doc_year integer not null check (doc_year between 2000 and 2100),
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (company, doc_type, doc_year)
);

create table if not exists public.crm_quotes (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  client_id uuid not null references public.crm_clients(id) on delete restrict,
  number text not null,
  title text not null default '',
  status text not null default 'draft' check (status in ('draft','sent','pending','accepted','rejected','expired','converted')),
  issue_date date not null default current_date,
  valid_until date,
  payment_terms text not null default '',
  notes text not null default '',
  discount_type text not null default 'none' check (discount_type in ('none','percent','fixed')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  amount_due numeric(12,2) not null default 0 check (amount_due >= 0),
  sent_at timestamptz,
  accepted boolean not null default false,
  accepted_at timestamptz,
  accepted_name text not null default '',
  accepted_signature text not null default '',
  pdf_url text not null default '',
  pdf_path text not null default '',
  converted_invoice_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company, number)
);

create table if not exists public.crm_quote_items (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  sort_order integer not null default 1,
  title text not null,
  description text not null default '',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_invoices (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  client_id uuid not null references public.crm_clients(id) on delete restrict,
  source_quote_id uuid references public.crm_quotes(id) on delete set null,
  number text not null,
  title text not null default '',
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  issue_date date not null default current_date,
  due_date date,
  payment_terms text not null default '',
  notes text not null default '',
  discount_type text not null default 'none' check (discount_type in ('none','percent','fixed')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  amount_due numeric(12,2) not null default 0 check (amount_due >= 0),
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  pdf_url text not null default '',
  pdf_path text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company, number)
);

create table if not exists public.crm_invoice_items (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  invoice_id uuid not null references public.crm_invoices(id) on delete cascade,
  sort_order integer not null default 1,
  title text not null,
  description text not null default '',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  invoice_id uuid not null references public.crm_invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text not null default 'virement',
  reference text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists crm_invoices_source_quote_unique
on public.crm_invoices(company, source_quote_id)
where source_quote_id is not null;

create index if not exists crm_clients_company_display_name_idx
on public.crm_clients(company, lower(display_name));

create index if not exists crm_quotes_company_issue_date_idx
on public.crm_quotes(company, issue_date desc, created_at desc);

create index if not exists crm_invoices_company_issue_date_idx
on public.crm_invoices(company, issue_date desc, created_at desc);

create index if not exists crm_invoice_payments_invoice_paid_at_idx
on public.crm_invoice_payments(invoice_id, paid_at desc);

-- -------------------------------------------------------------------
-- Generic helpers
-- -------------------------------------------------------------------
create or replace function public.crm_admin_company()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  c := public.current_company();
  if c is null or btrim(c) = '' then
    raise exception 'profile_missing';
  end if;

  return c;
end;
$$;

create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.crm_discount_amount(
  _subtotal numeric,
  _discount_type text,
  _discount_value numeric
)
returns numeric
language plpgsql
immutable
as $$
declare
  subtotal numeric := round(greatest(coalesce(_subtotal, 0), 0), 2);
  discount_value numeric := round(greatest(coalesce(_discount_value, 0), 0), 2);
  result numeric := 0;
begin
  if coalesce(_discount_type, 'none') = 'percent' then
    result := round(subtotal * least(discount_value, 100) / 100, 2);
  elsif coalesce(_discount_type, 'none') = 'fixed' then
    result := least(subtotal, discount_value);
  else
    result := 0;
  end if;
  return greatest(result, 0);
end;
$$;

-- -------------------------------------------------------------------
-- Defaults / guards
-- -------------------------------------------------------------------
create or replace function public.crm_settings_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  c := public.crm_admin_company();
  new.company := c;
  new.numbering_quote_prefix := upper(coalesce(nullif(btrim(new.numbering_quote_prefix), ''), 'DEV'));
  new.numbering_invoice_prefix := upper(coalesce(nullif(btrim(new.numbering_invoice_prefix), ''), 'FAC'));
  new.currency := upper(coalesce(nullif(btrim(new.currency), ''), 'EUR'));
  new.primary_color := coalesce(nullif(btrim(new.primary_color), ''), '#111111');
  new.trade_name := btrim(coalesce(new.trade_name, ''));
  new.legal_name := btrim(coalesce(new.legal_name, ''));
  new.vat_note := btrim(coalesce(new.vat_note, 'TVA non applicable, article 293 B du CGI'));
  new.payment_terms_default := btrim(coalesce(new.payment_terms_default, 'Paiement a 30 jours date de facture.'));
  new.late_penalties := btrim(coalesce(new.late_penalties, 'Penalites de retard exigibles sans rappel : taux legal en vigueur majore.'));
  new.recovery_indemnity := btrim(coalesce(new.recovery_indemnity, 'Indemnite forfaitaire pour frais de recouvrement : 40 EUR pour les clients professionnels.'));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_settings_biu on public.crm_settings;
create trigger crm_settings_biu
before insert or update on public.crm_settings
for each row execute function public.crm_settings_before_write();

create or replace function public.crm_clients_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  label text;
begin
  c := public.crm_admin_company();
  new.company := c;
  new.first_name := btrim(coalesce(new.first_name, ''));
  new.last_name := btrim(coalesce(new.last_name, ''));
  new.company_name := btrim(coalesce(new.company_name, ''));
  new.email := btrim(coalesce(new.email, ''));
  new.phone := btrim(coalesce(new.phone, ''));
  new.city := btrim(coalesce(new.city, ''));
  new.country := btrim(coalesce(new.country, 'France'));
  new.client_siret := btrim(coalesce(new.client_siret, ''));
  new.notes := btrim(coalesce(new.notes, ''));

  label := btrim(coalesce(new.display_name, ''));
  if label = '' then
    if new.kind = 'person' then
      label := btrim(concat_ws(' ', new.first_name, new.last_name));
    else
      label := coalesce(nullif(new.company_name, ''), btrim(concat_ws(' ', new.first_name, new.last_name)));
    end if;
  end if;
  if label = '' then
    raise exception 'client_display_name_required';
  end if;
  new.display_name := label;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_clients_biu on public.crm_clients;
create trigger crm_clients_biu
before insert or update on public.crm_clients
for each row execute function public.crm_clients_before_write();

create or replace function public.crm_reserve_document_number(
  _company text,
  _doc_type text,
  _issue_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  y integer := extract(year from coalesce(_issue_date, current_date));
  prefix text;
  padding integer;
  seq_value integer;
begin
  c := public.crm_admin_company();
  if c <> coalesce(_company, '') then
    raise exception 'invalid_company';
  end if;
  if _doc_type not in ('quote', 'invoice') then
    raise exception 'invalid_doc_type';
  end if;

  insert into public.crm_settings(company)
  values (c)
  on conflict (company) do nothing;

  select
    case
      when _doc_type = 'quote' then coalesce(nullif(numbering_quote_prefix, ''), 'DEV')
      else coalesce(nullif(numbering_invoice_prefix, ''), 'FAC')
    end,
    greatest(coalesce(numbering_padding, 3), 3)
  into prefix, padding
  from public.crm_settings
  where company = c;

  insert into public.crm_sequences(company, doc_type, doc_year, last_value)
  values (c, _doc_type, y, 1)
  on conflict (company, doc_type, doc_year)
  do update set
    last_value = public.crm_sequences.last_value + 1,
    updated_at = now()
  returning last_value into seq_value;

  return upper(prefix) || '-' || y::text || '-' || lpad(seq_value::text, padding, '0');
end;
$$;

create or replace function public.crm_quote_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  validity_days integer;
begin
  c := public.crm_admin_company();
  new.company := c;
  insert into public.crm_settings(company)
  values (c)
  on conflict (company) do nothing;

  if new.issue_date is null then
    new.issue_date := current_date;
  end if;

  select greatest(coalesce(quote_validity_days, 30), 0)
  into validity_days
  from public.crm_settings
  where company = c;

  if new.valid_until is null then
    new.valid_until := new.issue_date + validity_days;
  end if;

  if tg_op = 'INSERT' and coalesce(nullif(btrim(new.number), ''), '') = '' then
    new.number := public.crm_reserve_document_number(c, 'quote', new.issue_date);
  end if;

  if coalesce(nullif(btrim(new.payment_terms), ''), '') = '' then
    select payment_terms_default
    into new.payment_terms
    from public.crm_settings
    where company = c;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_quotes_biu on public.crm_quotes;
create trigger crm_quotes_biu
before insert or update on public.crm_quotes
for each row execute function public.crm_quote_before_write();

create or replace function public.crm_invoice_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  c := public.crm_admin_company();
  new.company := c;
  insert into public.crm_settings(company)
  values (c)
  on conflict (company) do nothing;

  if new.issue_date is null then
    new.issue_date := current_date;
  end if;

  if new.due_date is null then
    new.due_date := new.issue_date + 30;
  end if;

  if tg_op = 'INSERT' and coalesce(nullif(btrim(new.number), ''), '') = '' then
    new.number := public.crm_reserve_document_number(c, 'invoice', new.issue_date);
  end if;

  if coalesce(nullif(btrim(new.payment_terms), ''), '') = '' then
    select payment_terms_default
    into new.payment_terms
    from public.crm_settings
    where company = c;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_invoices_biu on public.crm_invoices;
create trigger crm_invoices_biu
before insert or update on public.crm_invoices
for each row execute function public.crm_invoice_before_write();

create or replace function public.crm_quote_item_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  c := public.crm_admin_company();
  select company into new.company
  from public.crm_quotes
  where id = new.quote_id;

  if new.company is null then
    raise exception 'quote_not_found';
  end if;
  if new.company <> c then
    raise exception 'invalid_company';
  end if;

  new.quantity := round(greatest(coalesce(new.quantity, 1), 0.01), 2);
  new.unit_price := round(greatest(coalesce(new.unit_price, 0), 0), 2);
  new.line_total := round(new.quantity * new.unit_price, 2);

  if new.sort_order is null or new.sort_order <= 0 then
    select coalesce(max(sort_order), 0) + 1
    into new.sort_order
    from public.crm_quote_items
    where quote_id = new.quote_id;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_quote_items_biu on public.crm_quote_items;
create trigger crm_quote_items_biu
before insert or update on public.crm_quote_items
for each row execute function public.crm_quote_item_before_write();

create or replace function public.crm_invoice_item_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  c := public.crm_admin_company();
  select company into new.company
  from public.crm_invoices
  where id = new.invoice_id;

  if new.company is null then
    raise exception 'invoice_not_found';
  end if;
  if new.company <> c then
    raise exception 'invalid_company';
  end if;

  new.quantity := round(greatest(coalesce(new.quantity, 1), 0.01), 2);
  new.unit_price := round(greatest(coalesce(new.unit_price, 0), 0), 2);
  new.line_total := round(new.quantity * new.unit_price, 2);

  if new.sort_order is null or new.sort_order <= 0 then
    select coalesce(max(sort_order), 0) + 1
    into new.sort_order
    from public.crm_invoice_items
    where invoice_id = new.invoice_id;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_invoice_items_biu on public.crm_invoice_items;
create trigger crm_invoice_items_biu
before insert or update on public.crm_invoice_items
for each row execute function public.crm_invoice_item_before_write();

create or replace function public.crm_invoice_payment_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  c := public.crm_admin_company();
  select company into new.company
  from public.crm_invoices
  where id = new.invoice_id;

  if new.company is null then
    raise exception 'invoice_not_found';
  end if;
  if new.company <> c then
    raise exception 'invalid_company';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists crm_invoice_payments_biu on public.crm_invoice_payments;
create trigger crm_invoice_payments_biu
before insert or update on public.crm_invoice_payments
for each row execute function public.crm_invoice_payment_before_write();

-- -------------------------------------------------------------------
-- Totals / status refresh
-- -------------------------------------------------------------------
create or replace function public.crm_recalculate_quote(_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_taxable_base numeric := 0;
  v_vat_amount numeric := 0;
  v_total_amount numeric := 0;
  v_amount_due numeric := 0;
begin
  select *
  into q
  from public.crm_quotes
  where id = _quote_id;

  if not found then
    return;
  end if;

  select coalesce(round(sum(line_total), 2), 0)
  into v_subtotal
  from public.crm_quote_items
  where quote_id = _quote_id;

  v_discount_amount := public.crm_discount_amount(v_subtotal, q.discount_type, q.discount_value);
  v_taxable_base := greatest(v_subtotal - v_discount_amount, 0);
  v_vat_amount := round(v_taxable_base * greatest(coalesce(q.vat_rate, 0), 0) / 100, 2);
  v_total_amount := round(v_taxable_base + v_vat_amount, 2);
  v_amount_due := greatest(v_total_amount - greatest(coalesce(q.deposit_amount, 0), 0), 0);

  update public.crm_quotes
  set
    subtotal_amount = v_subtotal,
    discount_amount = v_discount_amount,
    vat_amount = v_vat_amount,
    total_amount = v_total_amount,
    amount_due = v_amount_due,
    updated_at = now()
  where id = _quote_id;
end;
$$;

create or replace function public.crm_recalculate_invoice(_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i record;
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_taxable_base numeric := 0;
  v_vat_amount numeric := 0;
  v_total_amount numeric := 0;
  v_amount_paid numeric := 0;
  v_amount_due numeric := 0;
  next_status text;
begin
  select *
  into i
  from public.crm_invoices
  where id = _invoice_id;

  if not found then
    return;
  end if;

  select coalesce(round(sum(line_total), 2), 0)
  into v_subtotal
  from public.crm_invoice_items
  where invoice_id = _invoice_id;

  select coalesce(round(sum(amount), 2), 0)
  into v_amount_paid
  from public.crm_invoice_payments
  where invoice_id = _invoice_id;

  v_discount_amount := public.crm_discount_amount(v_subtotal, i.discount_type, i.discount_value);
  v_taxable_base := greatest(v_subtotal - v_discount_amount, 0);
  v_vat_amount := round(v_taxable_base * greatest(coalesce(i.vat_rate, 0), 0) / 100, 2);
  v_total_amount := round(v_taxable_base + v_vat_amount, 2);
  v_amount_due := greatest(v_total_amount - v_amount_paid, 0);

  next_status := i.status;
  if i.status = 'cancelled' then
    next_status := 'cancelled';
  elsif v_amount_due <= 0 and v_total_amount > 0 then
    next_status := 'paid';
  elsif i.status = 'draft' then
    next_status := 'draft';
  elsif i.due_date is not null and i.due_date < current_date then
    next_status := 'overdue';
  else
    next_status := 'sent';
  end if;

  update public.crm_invoices
  set
    subtotal_amount = v_subtotal,
    discount_amount = v_discount_amount,
    vat_amount = v_vat_amount,
    total_amount = v_total_amount,
    amount_paid = v_amount_paid,
    amount_due = v_amount_due,
    status = next_status,
    paid_at = case when v_amount_due <= 0 and v_total_amount > 0 then coalesce(paid_at, now()) else null end,
    updated_at = now()
  where id = _invoice_id;
end;
$$;

create or replace function public.crm_quote_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_recalculate_quote(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists crm_quote_items_aiud on public.crm_quote_items;
create trigger crm_quote_items_aiud
after insert or update or delete on public.crm_quote_items
for each row execute function public.crm_quote_items_after_change();

create or replace function public.crm_quotes_after_header_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_recalculate_quote(new.id);
  return new;
end;
$$;

drop trigger if exists crm_quotes_after_header on public.crm_quotes;
create trigger crm_quotes_after_header
after insert or update of discount_type, discount_value, deposit_amount, vat_rate on public.crm_quotes
for each row execute function public.crm_quotes_after_header_change();

create or replace function public.crm_invoice_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_recalculate_invoice(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists crm_invoice_items_aiud on public.crm_invoice_items;
create trigger crm_invoice_items_aiud
after insert or update or delete on public.crm_invoice_items
for each row execute function public.crm_invoice_items_after_change();

create or replace function public.crm_invoice_payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_recalculate_invoice(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists crm_invoice_payments_aiud on public.crm_invoice_payments;
create trigger crm_invoice_payments_aiud
after insert or update or delete on public.crm_invoice_payments
for each row execute function public.crm_invoice_payments_after_change();

create or replace function public.crm_invoices_after_header_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_recalculate_invoice(new.id);
  return new;
end;
$$;

drop trigger if exists crm_invoices_after_header on public.crm_invoices;
create trigger crm_invoices_after_header
after insert or update of discount_type, discount_value, vat_rate, due_date, status on public.crm_invoices
for each row execute function public.crm_invoices_after_header_change();

-- -------------------------------------------------------------------
-- RPC helpers
-- -------------------------------------------------------------------
create or replace function public.crm_convert_quote_to_invoice(
  _quote_id uuid,
  _issue_date date default current_date,
  _due_date date default null,
  _status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  q public.crm_quotes%rowtype;
  existing_id uuid;
  invoice_id uuid;
begin
  c := public.crm_admin_company();

  select *
  into q
  from public.crm_quotes
  where id = _quote_id
    and company = c;

  if not found then
    raise exception 'quote_not_found';
  end if;

  select id
  into existing_id
  from public.crm_invoices
  where company = c
    and source_quote_id = _quote_id
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.crm_invoices (
    company,
    client_id,
    source_quote_id,
    title,
    status,
    issue_date,
    due_date,
    payment_terms,
    notes,
    discount_type,
    discount_value,
    deposit_amount,
    vat_rate,
    created_by,
    updated_by
  )
  values (
    c,
    q.client_id,
    q.id,
    case when btrim(q.title) <> '' then q.title else 'Facture - ' || q.number end,
    case when _status in ('draft','sent','paid','overdue','cancelled') then _status else 'draft' end,
    coalesce(_issue_date, current_date),
    coalesce(_due_date, coalesce(_issue_date, current_date) + 30),
    q.payment_terms,
    q.notes,
    q.discount_type,
    q.discount_value,
    q.deposit_amount,
    q.vat_rate,
    auth.uid(),
    auth.uid()
  )
  returning id into invoice_id;

  insert into public.crm_invoice_items (
    company,
    invoice_id,
    sort_order,
    title,
    description,
    quantity,
    unit_price
  )
  select
    c,
    invoice_id,
    sort_order,
    title,
    description,
    quantity,
    unit_price
  from public.crm_quote_items
  where quote_id = q.id
  order by sort_order, created_at;

  update public.crm_quotes
  set
    status = 'converted',
    converted_invoice_id = invoice_id,
    updated_by = auth.uid(),
    updated_at = now()
  where id = q.id;

  return invoice_id;
end;
$$;

create or replace function public.crm_seed_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  existing_clients integer;
  marie_id uuid;
  entreprise_id uuid;
  quote_id uuid;
  invoice_id uuid;
begin
  c := public.crm_admin_company();

  select count(*)
  into existing_clients
  from public.crm_clients
  where company = c;

  if existing_clients > 0 then
    return jsonb_build_object(
      'ok', false,
      'message', 'already_seeded'
    );
  end if;

  insert into public.crm_settings (
    company,
    trade_name,
    legal_name,
    city,
    country,
    email,
    phone,
    siret,
    default_vat_rate,
    business_type
  )
  values (
    c,
    'Marie-Madeleine Gautier Digital',
    'Marie-Madeleine Gautier',
    'Paris',
    'France',
    'bonjour@marie-madeleine.fr',
    '+33 6 00 00 00 00',
    '123 456 789 00012',
    0,
    'micro'
  )
  on conflict (company) do update
  set
    trade_name = excluded.trade_name,
    legal_name = excluded.legal_name,
    city = excluded.city,
    country = excluded.country,
    email = excluded.email,
    phone = excluded.phone,
    siret = excluded.siret,
    default_vat_rate = excluded.default_vat_rate,
    business_type = excluded.business_type,
    updated_at = now();

  insert into public.crm_clients (
    company,
    kind,
    display_name,
    first_name,
    last_name,
    email,
    phone,
    address_line1,
    postal_code,
    city,
    country,
    notes
  )
  values (
    c,
    'person',
    'Marie-Madeleine Gautier',
    'Marie-Madeleine',
    'Gautier',
    'contact@marie-madeleine.fr',
    '+33 6 11 22 33 44',
    '12 rue des Creatifs',
    '75011',
    'Paris',
    'France',
    'Cliente premium pre-remplie pour les devis rapides.'
  )
  returning id into marie_id;

  insert into public.crm_clients (
    company,
    kind,
    display_name,
    company_name,
    email,
    phone,
    address_line1,
    postal_code,
    city,
    country,
    client_siret,
    notes
  )
  values (
    c,
    'business',
    'Studio Horizon',
    'Studio Horizon',
    'hello@studio-horizon.fr',
    '+33 1 80 00 00 00',
    '48 avenue des Champs',
    '69002',
    'Lyon',
    'France',
    '80123456700017',
    'Client B2B pour site vitrine et strategie reseaux sociaux.'
  )
  returning id into entreprise_id;

  insert into public.crm_quotes (
    company,
    client_id,
    title,
    status,
    issue_date,
    valid_until,
    payment_terms,
    notes,
    discount_type,
    discount_value,
    deposit_amount,
    vat_rate,
    accepted,
    accepted_name
  )
  values (
    c,
    marie_id,
    'Refonte site vitrine + accompagnement digital',
    'sent',
    current_date,
    current_date + 30,
    'Acompte de 30% a la commande, solde a la livraison.',
    'Prevoir une session de passation et une mini-formation.',
    'percent',
    5,
    450,
    0,
    false,
    ''
  )
  returning id into quote_id;

  insert into public.crm_quote_items (company, quote_id, sort_order, title, description, quantity, unit_price)
  values
    (c, quote_id, 1, 'Audit digital initial', 'Analyse du site actuel, positionnement et recommandations.', 1, 280),
    (c, quote_id, 2, 'Creation du site vitrine', 'Maquettage, developpement, responsive et optimisations.', 1, 1200),
    (c, quote_id, 3, 'Pack communication sociale', 'Calendrier editorial et templates de publication.', 1, 320);

  insert into public.crm_invoices (
    company,
    client_id,
    title,
    status,
    issue_date,
    due_date,
    payment_terms,
    notes,
    discount_type,
    discount_value,
    deposit_amount,
    vat_rate
  )
  values (
    c,
    entreprise_id,
    'Maintenance et contenu mensuel',
    'sent',
    current_date - 20,
    current_date + 10,
    'Paiement a reception par virement bancaire.',
    'Facture recurrente exemple.',
    'none',
    0,
    0,
    0
  )
  returning id into invoice_id;

  insert into public.crm_invoice_items (company, invoice_id, sort_order, title, description, quantity, unit_price)
  values
    (c, invoice_id, 1, 'Maintenance technique', 'Mises a jour, sauvegardes et monitoring.', 1, 240),
    (c, invoice_id, 2, 'Production de contenus', 'Conception de 4 publications premium.', 1, 310);

  insert into public.crm_invoice_payments (company, invoice_id, amount, paid_at, method, reference, notes, created_by)
  values (
    c,
    invoice_id,
    200,
    current_date - 5,
    'virement',
    'VIR-STH-2026',
    'Acompte deja recu.',
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'seeded',
    'marie_client_id', marie_id,
    'quote_id', quote_id,
    'invoice_id', invoice_id
  );
end;
$$;

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------
alter table public.crm_settings enable row level security;
alter table public.crm_clients enable row level security;
alter table public.crm_sequences enable row level security;
alter table public.crm_quotes enable row level security;
alter table public.crm_quote_items enable row level security;
alter table public.crm_invoices enable row level security;
alter table public.crm_invoice_items enable row level security;
alter table public.crm_invoice_payments enable row level security;

drop policy if exists crm_settings_admin_all on public.crm_settings;
create policy crm_settings_admin_all
on public.crm_settings
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (public.is_admin() and company = public.current_company());

drop policy if exists crm_clients_admin_all on public.crm_clients;
create policy crm_clients_admin_all
on public.crm_clients
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (public.is_admin() and company = public.current_company());

drop policy if exists crm_sequences_admin_all on public.crm_sequences;
create policy crm_sequences_admin_all
on public.crm_sequences
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (public.is_admin() and company = public.current_company());

drop policy if exists crm_quotes_admin_all on public.crm_quotes;
create policy crm_quotes_admin_all
on public.crm_quotes
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (
  public.is_admin()
  and company = public.current_company()
  and exists (
    select 1
    from public.crm_clients c
    where c.id = client_id
      and c.company = public.current_company()
  )
);

drop policy if exists crm_quote_items_admin_all on public.crm_quote_items;
create policy crm_quote_items_admin_all
on public.crm_quote_items
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (
  public.is_admin()
  and company = public.current_company()
  and exists (
    select 1
    from public.crm_quotes q
    where q.id = quote_id
      and q.company = public.current_company()
  )
);

drop policy if exists crm_invoices_admin_all on public.crm_invoices;
create policy crm_invoices_admin_all
on public.crm_invoices
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (
  public.is_admin()
  and company = public.current_company()
  and exists (
    select 1
    from public.crm_clients c
    where c.id = client_id
      and c.company = public.current_company()
  )
);

drop policy if exists crm_invoice_items_admin_all on public.crm_invoice_items;
create policy crm_invoice_items_admin_all
on public.crm_invoice_items
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (
  public.is_admin()
  and company = public.current_company()
  and exists (
    select 1
    from public.crm_invoices i
    where i.id = invoice_id
      and i.company = public.current_company()
  )
);

drop policy if exists crm_invoice_payments_admin_all on public.crm_invoice_payments;
create policy crm_invoice_payments_admin_all
on public.crm_invoice_payments
for all
to authenticated
using (public.is_admin() and company = public.current_company())
with check (
  public.is_admin()
  and company = public.current_company()
  and exists (
    select 1
    from public.crm_invoices i
    where i.id = invoice_id
      and i.company = public.current_company()
  )
);

-- -------------------------------------------------------------------
-- Grants
-- -------------------------------------------------------------------
grant select, insert, update, delete on
  public.crm_settings,
  public.crm_clients,
  public.crm_sequences,
  public.crm_quotes,
  public.crm_quote_items,
  public.crm_invoices,
  public.crm_invoice_items,
  public.crm_invoice_payments
to authenticated;

grant execute on function public.crm_admin_company() to authenticated;
grant execute on function public.crm_discount_amount(numeric, text, numeric) to authenticated;
grant execute on function public.crm_reserve_document_number(text, text, date) to authenticated;
grant execute on function public.crm_recalculate_quote(uuid) to authenticated;
grant execute on function public.crm_recalculate_invoice(uuid) to authenticated;
grant execute on function public.crm_convert_quote_to_invoice(uuid, date, date, text) to authenticated;
grant execute on function public.crm_seed_demo_data() to authenticated;
