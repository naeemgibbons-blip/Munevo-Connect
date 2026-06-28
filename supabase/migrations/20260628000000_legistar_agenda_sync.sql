-- Legistar agenda sync: organizations/profiles scaffolding, departments,
-- and the legistar_matters / property_dispositions / grants / grant_transactions
-- tables, all scoped to org_id via current_org_id().

create extension if not exists "pgcrypto";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role text not null check (role in ('admin', 'executive', 'staff', 'supervisor')),
  created_at timestamptz not null default now()
);

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create unique index if not exists departments_org_name_lower_idx
  on departments (org_id, lower(name));

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

create table if not exists grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  legistar_matter_id uuid unique references legistar_matters (id) on delete cascade,
  department_id uuid references departments (id),
  entity_name text,
  purpose text,
  funding_source text,
  grant_period text,
  total_amount numeric,
  created_at timestamptz not null default now()
);

create table if not exists grant_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  grant_id uuid not null references grants (id) on delete cascade,
  amount numeric not null,
  description text,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table legistar_matters enable row level security;
alter table property_dispositions enable row level security;
alter table grants enable row level security;
alter table grant_transactions enable row level security;

create policy "legistar_matters_org_access" on legistar_matters
  for all
  using (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  )
  with check (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  );

create policy "property_dispositions_org_access" on property_dispositions
  for all
  using (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  )
  with check (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  );

create policy "grants_org_access" on grants
  for all
  using (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  )
  with check (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  );

create policy "grant_transactions_org_access" on grant_transactions
  for all
  using (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  )
  with check (
    org_id = current_org_id()
    and current_user_role() in ('admin', 'executive', 'staff', 'supervisor')
  );
