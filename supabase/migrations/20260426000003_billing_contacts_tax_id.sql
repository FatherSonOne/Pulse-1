-- Billing extras: multiple billing contacts (CC list) + Stripe-style tax ID.
-- The single billing_email column added in the org-onboarding migration remains
-- the primary contact; this column adds optional cc'd emails.

BEGIN;

alter table public.workspaces
  add column if not exists billing_contacts text[]    not null default '{}'::text[],
  add column if not exists tax_id_type     text,
  add column if not exists tax_id_value    text;

-- Tax ID type and value must be set together (or both null).
alter table public.workspaces
  drop constraint if exists workspaces_tax_id_pair_check;
alter table public.workspaces
  add constraint workspaces_tax_id_pair_check
  check (
    (tax_id_type is null  and tax_id_value is null)
    or
    (tax_id_type is not null and tax_id_value is not null and char_length(tax_id_value) between 4 and 64)
  );

-- Curated subset of Stripe's supported tax ID types. Extend as needed.
alter table public.workspaces
  drop constraint if exists workspaces_tax_id_type_check;
alter table public.workspaces
  add constraint workspaces_tax_id_type_check
  check (
    tax_id_type is null
    or tax_id_type in (
      'us_ein', 'eu_vat', 'gb_vat', 'ca_bn', 'ca_gst_hst', 'au_abn', 'au_arn',
      'sg_uen', 'in_gst', 'jp_cn', 'jp_rn', 'br_cnpj', 'br_cpf', 'mx_rfc',
      'za_vat', 'ch_vat', 'no_vat', 'nz_gst', 'kr_brn', 'tw_vat',
      'ae_trn', 'sa_vat', 'th_vat',
      'other'
    )
  );

-- Per-element email validation (CHECK can't contain subqueries, so use a trigger).
create or replace function public.validate_workspace_billing_contacts()
returns trigger
language plpgsql
as $$
declare
  c text;
begin
  if new.billing_contacts is null then
    return new;
  end if;
  foreach c in array new.billing_contacts loop
    if c !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      raise exception 'invalid email in billing_contacts: %', c;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_validate_workspace_billing_contacts on public.workspaces;
create trigger trg_validate_workspace_billing_contacts
  before insert or update of billing_contacts on public.workspaces
  for each row
  execute function public.validate_workspace_billing_contacts();

comment on column public.workspaces.billing_contacts is
  'Additional emails CC''d on invoices and billing notices. Primary contact is billing_email.';
comment on column public.workspaces.tax_id_type is
  'Stripe-supported tax ID type (us_ein, eu_vat, gb_vat, etc.). Must be set together with tax_id_value.';
comment on column public.workspaces.tax_id_value is
  'Tax ID number. Display-and-export only on the Pulse side; canonical record lives in the Stripe customer.';

COMMIT;
