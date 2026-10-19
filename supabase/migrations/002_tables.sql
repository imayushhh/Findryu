-- FindrYU schema, part 2 of 6. Tables, constraints, and indexes.
set search_path = public, extensions;

-- Locations come first because profiles.location_id points here.
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind public.location_kind not null,
  building text,
  room text,
  hours text,
  is_drop_off boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  special_handling public.special_handling not null default 'none',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'user',
  location_id uuid references public.locations (id) on delete restrict,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  constraint profiles_staff_needs_location check (
    role <> 'staff' or location_id is not null
  ),
  constraint profiles_language_supported check (
    preferred_language in ('en', 'fr')
  )
);

create sequence public.item_ref_seq start with 1 increment by 1;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  category_id uuid not null references public.categories (id) on delete restrict,
  description text not null,
  building_id uuid not null references public.buildings (id) on delete restrict,
  found_at timestamptz not null,
  reported_by uuid references public.profiles (id) on delete set null,
  logged_by_staff uuid references public.profiles (id) on delete set null,
  intended_location_id uuid not null references public.locations (id) on delete restrict,
  current_location_id uuid references public.locations (id) on delete restrict,
  status public.item_status not null default 'reported',
  received_at timestamptz,
  archived_outcome public.archived_outcome,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_description_not_blank check (char_length(btrim(description)) > 0),
  constraint items_location_when_in_care check (
    status = 'reported' or current_location_id is not null
  ),
  constraint items_archive_outcome check (
    (
      status = 'archived'
      and archived_outcome is not null
    )
    or (
      status <> 'archived'
      and archived_outcome is null
    )
  )
);

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint item_photos_path_not_blank check (char_length(btrim(storage_path)) > 0)
);

-- Separate table so regular users can be locked out completely.
create table public.item_secrets (
  item_id uuid primary key references public.items (id) on delete cascade,
  hidden_detail text not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint item_secrets_detail_not_blank check (char_length(btrim(hidden_detail)) > 0)
);

comment on table public.item_secrets is
  'Identifying detail only the owner should know. Never readable by a regular user.';

create table public.item_transfers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  from_location_id uuid not null references public.locations (id) on delete restrict,
  to_location_id uuid not null references public.locations (id) on delete restrict,
  reason public.transfer_reason not null,
  sent_by uuid not null references public.profiles (id) on delete restrict,
  sent_at timestamptz not null default now(),
  received_by uuid references public.profiles (id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  constraint item_transfers_distinct_ends check (from_location_id <> to_location_id)
);

create table public.lost_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  description text not null,
  building_id uuid not null references public.buildings (id) on delete restrict,
  lost_from date not null,
  lost_to date not null,
  photo_path text,
  status public.lost_report_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint lost_reports_date_range check (lost_to >= lost_from),
  constraint lost_reports_description_not_blank check (char_length(btrim(description)) > 0)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete restrict,
  hidden_detail_answer text not null,
  proof_note text,
  no_proof boolean not null default false,
  contact_phone text,
  contact_address text,
  status public.claim_status not null default 'pending',
  hold_until timestamptz,
  rejection_reason text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  pickup_request public.pickup_request not null default 'desk',
  created_at timestamptz not null default now(),
  constraint claims_one_per_claimant unique (item_id, claimant_id),
  constraint claims_answer_not_blank check (char_length(btrim(hidden_detail_answer)) > 0),
  constraint claims_no_proof_needs_contact check (
    no_proof = false
    or nullif(btrim(contact_phone), '') is not null
    or nullif(btrim(contact_address), '') is not null
  ),
  constraint claims_rejection_needs_reason check (
    status <> 'rejected'
    or nullif(btrim(rejection_reason), '') is not null
  )
);

-- One release in progress per item. The same claim moves from approved to collected.
create unique index claims_one_release_per_item
  on public.claims (item_id)
  where status in ('approved', 'collected');

create table public.claim_proofs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint claim_proofs_path_not_blank check (char_length(btrim(storage_path)) > 0)
);

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  staff_id uuid not null references public.profiles (id) on delete restrict,
  location_id uuid not null references public.locations (id) on delete restrict,
  collected_at timestamptz not null default now(),
  photo_id_checked boolean not null,
  created_at timestamptz not null default now(),
  constraint handovers_photo_id_checked check (photo_id_checked)
);

comment on column public.handovers.photo_id_checked is
  'True only after staff see photo ID. The ID number is never stored.';

create table public.settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_status text,
  new_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only. Triggers write rows. Signed-in staff can read them.';

create index locations_kind_idx on public.locations (kind);
create index locations_drop_off_idx on public.locations (is_drop_off) where active;
create index buildings_active_idx on public.buildings (active);
create index categories_handling_idx on public.categories (special_handling);

create index profiles_location_id_idx on public.profiles (location_id);
create index profiles_role_idx on public.profiles (role);

create index items_category_id_idx on public.items (category_id);
create index items_building_id_idx on public.items (building_id);
create index items_reported_by_idx on public.items (reported_by);
create index items_logged_by_staff_idx on public.items (logged_by_staff);
create index items_intended_location_id_idx on public.items (intended_location_id);
create index items_current_location_id_idx on public.items (current_location_id);
create index items_status_idx on public.items (status);
create index items_found_at_idx on public.items (found_at);
create index items_archived_by_idx on public.items (archived_by);
create index items_visible_search_idx
  on public.items (building_id, category_id, found_at desc)
  where status in ('received', 'in_transit');
create index items_description_trgm_idx
  on public.items using gin (description gin_trgm_ops);
create index items_awaiting_receipt_idx
  on public.items (intended_location_id, created_at)
  where status = 'reported';
create index items_holding_idx
  on public.items (current_location_id, received_at)
  where status = 'received';

create index item_photos_item_id_idx on public.item_photos (item_id);
create index item_secrets_recorded_by_idx on public.item_secrets (recorded_by);

create index item_transfers_item_id_idx on public.item_transfers (item_id);
create index item_transfers_from_location_id_idx on public.item_transfers (from_location_id);
create index item_transfers_to_location_id_idx on public.item_transfers (to_location_id);
create index item_transfers_sent_by_idx on public.item_transfers (sent_by);
create index item_transfers_received_by_idx on public.item_transfers (received_by);

create index lost_reports_owner_id_idx on public.lost_reports (owner_id);
create index lost_reports_category_id_idx on public.lost_reports (category_id);
create index lost_reports_building_id_idx on public.lost_reports (building_id);
create index lost_reports_status_idx on public.lost_reports (status);
create index lost_reports_dates_idx on public.lost_reports (lost_from, lost_to);

create index claims_item_id_idx on public.claims (item_id);
create index claims_claimant_id_idx on public.claims (claimant_id);
create index claims_status_idx on public.claims (status, created_at);
create index claims_decided_by_idx on public.claims (decided_by);
create index claims_hold_until_idx on public.claims (hold_until);
create index claims_open_queue_idx
  on public.claims (created_at)
  where status in ('pending', 'on_hold');

create index claim_proofs_claim_id_idx on public.claim_proofs (claim_id);

create index handovers_item_id_idx on public.handovers (item_id);
create index handovers_staff_id_idx on public.handovers (staff_id);
create index handovers_location_id_idx on public.handovers (location_id);

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
