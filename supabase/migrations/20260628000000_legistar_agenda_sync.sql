-- Legistar agenda sync: legistar_matters / property_dispositions tables, plus
-- link columns on the existing grants module, all scoped to org_id via the
-- app's existing my_org() / has_permission() conventions.

create extension if not exists "pgcrypto";

create table if not exists legistar_matters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  matter_id integer not null,
  matter_file text,
  matter_title text,
  matter_type text,
  matter_status text,
  department_id uuid references departments (id),
  parsed_fields jsonb,
  classification text not null default 'other'
    check (classification in ('grant', 'property_disposition', 'other')),
  synced_at timestamptz not null default now(),
  unique (org_id, matter_id)
);

create table if not exists property_dispositions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  legistar_matter_id uuid unique references legistar_matters (id) on delete cascade,
  department_id uuid references departments (id),
  address text,
  block text,
  lot text,
  ward text,
  purpose text,
  entity_name text,
  action text,
  sale_amount numeric,
  assessed_appraised_amount text,
  created_at timestamptz not null default now()
);

-- Link Legistar-sourced grants into the existing grants module instead of
-- maintaining a parallel table.
alter table grants add column if not exists legistar_matter_id uuid
  unique references legistar_matters (id) on delete set null;
alter table grants add column if not exists department_id uuid
  references departments (id);

alter table legistar_matters enable row level security;
alter table property_dispositions enable row level security;

create policy "legistar_matters_read" on legistar_matters
  for select
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'view', department_id, null)
  );

create policy "legistar_matters_write" on legistar_matters
  for insert
  with check (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'create', department_id, null)
  );

create policy "legistar_matters_update" on legistar_matters
  for update
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'edit', department_id, null)
  );

create policy "property_dispositions_read" on property_dispositions
  for select
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'view', department_id, null)
  );

create policy "property_dispositions_write" on property_dispositions
  for insert
  with check (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'create', department_id, null)
  );

create policy "property_dispositions_update" on property_dispositions
  for update
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'edit', department_id, null)
  );
