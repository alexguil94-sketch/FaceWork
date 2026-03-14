-- FaceWork CRM - patch for ambiguous total variables in Supabase
-- Run this in Supabase SQL Editor on the project `livucppvekqyfswehasz`.
-- Safe to run multiple times.

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
