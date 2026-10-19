-- FindrYU schema, part 3 of 6. Helpers, enforcement, and audit triggers.
-- Helper functions are security definer so policies can call them without
-- recursing through row level security.

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
  );
$$;

-- Admin is a specialization of staff, so admins pass staff checks.
create or replace function public.is_staff()
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
      and role in ('staff', 'admin')
  );
$$;

create or replace function public.my_location_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select location_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.setting_int(setting_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select value::integer
  from public.settings
  where key = setting_key;
$$;

create or replace function public.enforce_york_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalised text;
  domain text;
begin
  normalised := lower(btrim(new.email));
  domain := split_part(normalised, '@', 2);

  if normalised is null
    or normalised = ''
    or array_length(string_to_array(normalised, '@'), 1) <> 2
    or split_part(normalised, '@', 1) = ''
    or domain not in ('yorku.ca', 'my.yorku.ca') then
    raise exception 'Only @yorku.ca and @my.yorku.ca email addresses can sign in'
      using errcode = 'check_violation';
  end if;

  new.email := normalised;
  return new;
end;
$$;

create trigger enforce_york_email
before insert or update of email on auth.users
for each row
execute function public.enforce_york_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

create trigger sync_profile_email
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email();

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The SQL editor and the service role have no auth.uid(). seed_admin uses that path.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.location_id is distinct from old.location_id then
    raise exception 'Only an admin can change role or drop-off point'
      using errcode = 'check_violation';
  end if;

  if new.email is distinct from old.email
    and not exists (
      select 1
      from auth.users
      where id = new.id
        and lower(email) = lower(new.email)
    ) then
    raise exception 'Email is managed by the sign-in account'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger protect_profile_columns
before update on public.profiles
for each row
execute function public.protect_profile_columns();

create trigger enforce_profile_york_email
before insert or update of email on public.profiles
for each row
execute function public.enforce_york_email();

create or replace function public.items_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  location_ok boolean;
  check_location boolean := false;
  stamp_received boolean := false;
begin
  if tg_op = 'INSERT' then
    new.ref_code := 'FYU-' || lpad(nextval('public.item_ref_seq')::text, 6, '0');
    check_location := true;
    stamp_received := new.status = 'received' and new.received_at is null;

    if new.status not in ('reported', 'received') then
      raise exception 'A new item must start as reported or received'
        using errcode = 'check_violation';
    end if;

    if new.status = 'received' and not public.is_staff() then
      raise exception 'Only staff can log an item that is already received'
        using errcode = 'check_violation';
    end if;
  else
    check_location := new.intended_location_id is distinct from old.intended_location_id;
    stamp_received := new.status = 'received'
      and old.status is distinct from 'received'
      and new.received_at is null;

    if new.status = 'archived' and old.status is distinct from 'archived' then
      new.archived_at := coalesce(new.archived_at, now());
      new.archived_by := coalesce(new.archived_by, auth.uid());
    end if;

    if new.status = 'collected'
      and old.status is distinct from 'collected'
      and not exists (
        select 1
        from public.handovers
        where item_id = new.id
          and photo_id_checked
      ) then
      raise exception 'Record a handover with photo ID checked before marking the item collected'
        using errcode = 'check_violation';
    end if;

    new.updated_at := now();
  end if;

  if check_location then
    select
      active
      and (
        new.status <> 'reported'
        or is_drop_off
      )
    into location_ok
    from public.locations
    where id = new.intended_location_id;

    if coalesce(location_ok, false) = false then
      raise exception 'Choose an active drop-off desk'
        using errcode = 'check_violation';
    end if;
  end if;

  if stamp_received then
    new.received_at := now();
  end if;

  return new;
end;
$$;

create trigger items_before_write
before insert or update on public.items
for each row
execute function public.items_before_write();

create or replace function public.ensure_item_has_photo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target uuid;
begin
  if tg_table_name = 'item_photos' then
    target := old.item_id;
  else
    target := new.id;
  end if;

  if exists (
    select 1
    from public.items
    where id = target
      and status <> 'archived'
      and not exists (
        select 1
        from public.item_photos
        where item_id = target
      )
  ) then
    raise exception 'At least one photo is required for this item'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger items_photo_required
after insert or update of status on public.items
deferrable initially deferred
for each row
execute function public.ensure_item_has_photo();

create constraint trigger item_photos_keep_one
after delete on public.item_photos
deferrable initially deferred
for each row
execute function public.ensure_item_has_photo();

create or replace function public.claims_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_item_status public.item_status;
  hold_days integer;
begin
  if tg_op = 'INSERT' then
    select status
    into current_item_status
    from public.items
    where id = new.item_id;

    if current_item_status is null
      or current_item_status not in ('received', 'in_transit') then
      raise exception 'Claims are only allowed for items that have been received'
        using errcode = 'check_violation';
    end if;

    new.decided_by := null;
    new.decided_at := null;
    new.rejection_reason := null;
    new.contact_phone := nullif(btrim(new.contact_phone), '');
    new.contact_address := nullif(btrim(new.contact_address), '');

    if new.no_proof then
      if new.contact_phone is null and new.contact_address is null then
        raise exception 'A phone number or home address is required when you have no proof'
          using errcode = 'check_violation';
      end if;

      hold_days := coalesce(public.setting_int('no_proof_hold_days'), 7);
      new.status := 'on_hold';
      new.hold_until := now() + make_interval(days => hold_days);
    else
      new.status := 'pending';
      new.hold_until := null;
    end if;

    if new.pickup_request is null then
      new.pickup_request := 'desk';
    end if;

    return new;
  end if;

  -- The claimant may only switch an approved claim to after-hours pickup.
  if auth.uid() = old.claimant_id
    and old.status = 'approved'
    and new.status = old.status
    and new.pickup_request = 'security_services'
    and new.item_id = old.item_id
    and new.claimant_id = old.claimant_id
    and new.hidden_detail_answer = old.hidden_detail_answer
    and new.proof_note is not distinct from old.proof_note
    and new.no_proof = old.no_proof
    and new.contact_phone is not distinct from old.contact_phone
    and new.contact_address is not distinct from old.contact_address
    and new.hold_until is not distinct from old.hold_until
    and new.rejection_reason is not distinct from old.rejection_reason
    and new.decided_by is not distinct from old.decided_by
    and new.decided_at is not distinct from old.decided_at then
    return new;
  end if;

  if new.claimant_id is distinct from old.claimant_id
    or new.item_id is distinct from old.item_id
    or new.hidden_detail_answer is distinct from old.hidden_detail_answer
    or new.proof_note is not distinct from old.proof_note
    or new.no_proof is distinct from old.no_proof then
    raise exception 'The claim submission cannot be changed'
      using errcode = 'check_violation';
  end if;

  if new.hold_until is distinct from old.hold_until then
    raise exception 'The hold time is fixed when the claim is submitted'
      using errcode = 'check_violation';
  end if;

  if (
      new.contact_phone is distinct from old.contact_phone
      or new.contact_address is distinct from old.contact_address
    )
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Contact details stay on the claim until the privacy cleanup'
      using errcode = 'check_violation';
  end if;

  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Only staff can update a claim'
      using errcode = 'check_violation';
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    hold_days := coalesce(public.setting_int('no_proof_hold_days'), 7);
    if hold_days > 0
      and old.hold_until is not null
      and old.hold_until > now() then
      raise exception 'This claim is on hold until %', old.hold_until
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'rejected'
    and nullif(btrim(coalesce(new.rejection_reason, '')), '') is null then
    raise exception 'A reason is required to reject a claim'
      using errcode = 'check_violation';
  end if;

  if new.status in ('approved', 'rejected', 'collected')
    and old.status is distinct from new.status then
    new.decided_by := coalesce(new.decided_by, auth.uid());
    new.decided_at := coalesce(new.decided_at, now());
  end if;

  return new;
end;
$$;

create trigger claims_before_write
before insert or update on public.claims
for each row
execute function public.claims_before_write();

create or replace function public.handovers_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_ok boolean;
  item_location uuid;
  item_state public.item_status;
begin
  if new.staff_id is distinct from auth.uid() then
    raise exception 'The signed-in staff member must record the handover'
      using errcode = 'check_violation';
  end if;

  select
    c.status = 'approved' and c.item_id = new.item_id,
    i.current_location_id,
    i.status
  into claim_ok, item_location, item_state
  from public.claims c
  join public.items i on i.id = c.item_id
  where c.id = new.claim_id;

  if coalesce(claim_ok, false) = false then
    raise exception 'Handover requires the approved claim for this item'
      using errcode = 'check_violation';
  end if;

  if item_state not in ('received', 'contested') then
    raise exception 'The item must be at a desk before it can be handed over'
      using errcode = 'check_violation';
  end if;

  if new.location_id is distinct from item_location then
    raise exception 'Record the handover at the item''s current desk'
      using errcode = 'check_violation';
  end if;

  if not public.is_admin() and new.location_id is distinct from public.my_location_id() then
    raise exception 'You can hand over items only at your own drop-off point'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger handovers_before_write
before insert on public.handovers
for each row
execute function public.handovers_before_write();

create or replace function public.handovers_apply_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.claims
  set status = 'collected'
  where id = new.claim_id
    and status = 'approved';

  update public.items
  set status = 'collected'
  where id = new.item_id
    and status is distinct from 'collected';

  return new;
end;
$$;

create trigger handovers_apply_collection
after insert on public.handovers
for each row
execute function public.handovers_apply_collection();

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity text;
  previous_status text;
  next_status text;
begin
  if tg_table_name = 'items' then
    entity := 'item';
  elsif tg_table_name = 'claims' then
    entity := 'claim';
  else
    entity := tg_table_name;
  end if;

  next_status := new.status::text;

  if tg_op = 'UPDATE' then
    previous_status := old.status::text;
    if previous_status is not distinct from next_status then
      return new;
    end if;
  end if;

  insert into public.audit_log (
    actor_id,
    entity_type,
    entity_id,
    action,
    old_status,
    new_status,
    details
  )
  values (
    auth.uid(),
    entity,
    new.id,
    case when tg_op = 'INSERT' then 'insert' else 'status_change' end,
    previous_status,
    next_status,
    case
      when tg_table_name = 'items' then jsonb_build_object('ref_code', new.ref_code)
      else jsonb_build_object('item_id', new.item_id)
    end
  );

  return new;
end;
$$;

create trigger items_audit
after insert or update on public.items
for each row
execute function public.audit_row();

create trigger claims_audit
after insert or update on public.claims
for each row
execute function public.audit_row();

create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'audit_log is append-only'
    using errcode = 'check_violation';
end;
$$;

create trigger audit_log_append_only
before update or delete on public.audit_log
for each row
execute function public.audit_log_append_only();

-- Staff at a desk ask which active lost reports match a received item.
create or replace function public.matching_lost_reports(item_id uuid)
returns setof public.lost_reports
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can view matching lost reports'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select lr.*
  from public.lost_reports lr
  join public.items i on i.id = matching_lost_reports.item_id
  where lr.status = 'active'
    and lr.category_id = i.category_id
    and lr.building_id = i.building_id
    and lr.lost_from <= (i.found_at at time zone 'America/Toronto')::date
    and lr.lost_to >= (i.found_at at time zone 'America/Toronto')::date;
end;
$$;

-- The only claim field a claimant can change.
create or replace function public.request_security_pickup(claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.claims
  set pickup_request = 'security_services'
  where id = request_security_pickup.claim_id
    and claimant_id = auth.uid()
    and status = 'approved';

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    raise exception 'No approved claim of yours was found'
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.my_location_id() from public;
revoke all on function public.setting_int(text) from public;
revoke all on function public.matching_lost_reports(uuid) from public;
revoke all on function public.request_security_pickup(uuid) from public;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.my_location_id() to authenticated, service_role;
grant execute on function public.setting_int(text) to authenticated, service_role;
grant execute on function public.matching_lost_reports(uuid) to authenticated;
grant execute on function public.request_security_pickup(uuid) to authenticated;
