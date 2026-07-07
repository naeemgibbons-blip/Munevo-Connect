-- Extend legistar_matters with structured extraction columns and add a
-- relationship-engine output table. Populates from the enhanced legistar-sync
-- edge function rather than touching the FK-chained synced_agenda_items tree.

alter table legistar_matters
  add column if not exists matter_category text
    check (matter_category in ('PROCEDURAL', 'HEADER', 'ACTIONABLE')),
  add column if not exists action_type text,
  add column if not exists resolution_number text,
  add column if not exists ordinance_number text,
  add column if not exists funding_source_parsed text,
  add column if not exists meeting_body text,
  add column if not exists extracted_addresses jsonb,
  add column if not exists extracted_businesses jsonb,
  add column if not exists extracted_contractors jsonb,
  add column if not exists extracted_parcels jsonb,
  add column if not exists extracted_amounts jsonb;

create table if not exists legistar_matter_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  legistar_matter_id uuid not null references legistar_matters (id) on delete cascade,
  record_type text not null,
  record_id uuid,
  match_basis text not null,
  match_text text not null,
  confidence text not null check (confidence in ('high', 'medium', 'low', 'needs_review')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (legistar_matter_id, record_type, match_text)
);

alter table legistar_matter_links enable row level security;

create policy "legistar_matter_links_read" on legistar_matter_links
  for select
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'view', null, null)
  );

create policy "legistar_matter_links_write" on legistar_matter_links
  for insert
  with check (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'create', null, null)
  );

create policy "legistar_matter_links_update" on legistar_matter_links
  for update
  using (
    org_id = my_org()
    and has_permission(auth.uid(), 'legislative', 'edit', null, null)
  );

create index if not exists legistar_matter_links_record_idx
  on legistar_matter_links (org_id, record_type, record_id)
  where record_id is not null;
