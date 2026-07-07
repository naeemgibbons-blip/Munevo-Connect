-- GIS / location intelligence layer.
-- Central gis_records table as the geo-index for every address-bearing record,
-- a pending_geocode queue that Postgres triggers populate on INSERT/UPDATE,
-- and an async gis-sync edge function that drains the queue via Nominatim.

-- ─── Core tables ─────────────────────────────────────────────────────────────

create table if not exists gis_records (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references organizations (id) on delete cascade,
  source_module       text not null,
  record_type         text not null,
  related_record_id   text,
  raw_address         text not null,
  normalized_address  text,
  city                text,
  state               text,
  zip                 text,
  latitude            double precision,
  longitude           double precision,
  parcel_id           text,
  ward                text,
  neighborhood        text,
  council_district    text,
  department_id       uuid references departments (id),
  geocode_status      text not null default 'pending'
    check (geocode_status in ('pending', 'geocoded', 'needs_review', 'failed')),
  confidence          text check (confidence in ('high', 'medium', 'low')),
  geocoded_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source_module, related_record_id, raw_address)
);

create index if not exists gis_records_org_type_idx
  on gis_records (org_id, record_type)
  where latitude is not null;

create index if not exists gis_records_status_idx
  on gis_records (geocode_status)
  where geocode_status in ('pending', 'needs_review');

-- Queue that triggers populate; gis-sync edge function drains it.
create table if not exists pending_geocode (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid,
  source_table  text not null,
  source_id     text not null,
  raw_address   text not null,
  queued_at     timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  unique (source_table, source_id)
);

-- ─── Trigger function (all standard address tables) ───────────────────────────

create or replace function queue_geocode_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr text;
  oid  uuid;
begin
  -- Resolve address column per table; fall back to generic JSON cast
  addr := case TG_TABLE_NAME
    when 'permits'               then new.property_address
    when 'planning_applications' then new.property_address
    when 'utility_accounts'      then new.service_address
    else (row_to_json(new)->>'address')::text
  end;

  oid := (row_to_json(new)->>'org_id')::uuid;

  if addr is null or trim(addr) = '' then
    return new;
  end if;

  insert into pending_geocode (org_id, source_table, source_id, raw_address)
  values (oid, TG_TABLE_NAME, new.id::text, trim(addr))
  on conflict (source_table, source_id) do update set
    raw_address  = excluded.raw_address,
    processed_at = null,
    queued_at    = now(),
    error        = null;

  return new;
end;
$$;

-- ─── Trigger function (legistar_matters — extracted_addresses is a jsonb array) ──

create or replace function queue_geocode_legistar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr text;
begin
  if new.extracted_addresses is null then return new; end if;

  for addr in
    select jsonb_array_elements_text(new.extracted_addresses)
  loop
    addr := trim(addr);
    if addr = '' then continue; end if;

    insert into pending_geocode (org_id, source_table, source_id, raw_address)
    values (new.org_id, 'legistar_matters', new.id::text || '::' || addr, addr)
    on conflict (source_table, source_id) do update set
      raw_address  = excluded.raw_address,
      processed_at = null,
      queued_at    = now(),
      error        = null;
  end loop;

  return new;
end;
$$;

-- ─── Triggers ─────────────────────────────────────────────────────────────────

-- 311 Requests
create trigger gis_geocode_requests
  after insert or update of address on requests
  for each row execute function queue_geocode_job();

-- Permits
create trigger gis_geocode_permits
  after insert or update of property_address on permits
  for each row execute function queue_geocode_job();

-- Violations
create trigger gis_geocode_violations
  after insert or update of address on violations
  for each row execute function queue_geocode_job();

-- Work Orders
create trigger gis_geocode_work_orders
  after insert or update of address on work_orders
  for each row execute function queue_geocode_job();

-- Business Licenses
create trigger gis_geocode_business_licenses
  after insert or update of address on business_licenses
  for each row execute function queue_geocode_job();

-- Properties
create trigger gis_geocode_properties
  after insert or update of address on properties
  for each row execute function queue_geocode_job();

-- Utility Accounts
create trigger gis_geocode_utility_accounts
  after insert or update of service_address on utility_accounts
  for each row execute function queue_geocode_job();

-- Planning Applications
create trigger gis_geocode_planning_applications
  after insert or update of property_address on planning_applications
  for each row execute function queue_geocode_job();

-- Assets
create trigger gis_geocode_assets
  after insert or update of address on assets
  for each row execute function queue_geocode_job();

-- Field Jobs
create trigger gis_geocode_field_jobs
  after insert or update of address on field_jobs
  for each row execute function queue_geocode_job();

-- Tax Abatements
create trigger gis_geocode_tax_abatements
  after insert or update of address on tax_abatements
  for each row execute function queue_geocode_job();

-- Legislative Matters (jsonb array of extracted addresses)
create trigger gis_geocode_legistar_matters
  after insert or update of extracted_addresses on legistar_matters
  for each row execute function queue_geocode_legistar();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table gis_records enable row level security;
alter table pending_geocode enable row level security;

-- Platform admins see all GIS records
create policy "gis_records_platform_admin"
  on gis_records for select
  using (is_platform_admin());

-- Org users see their own GIS records
create policy "gis_records_org_read"
  on gis_records for select
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'map', 'view', null, null)
  );

-- Service role can write (edge function uses service key)
create policy "gis_records_service_write"
  on gis_records for all
  using (true)
  with check (true);

-- pending_geocode: service role only (not directly queried by users)
create policy "pending_geocode_service"
  on pending_geocode for all
  using (true)
  with check (true);
