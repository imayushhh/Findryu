-- FindrYU schema, part 12. Expiry, restore, and privacy cleanup.
-- 1. archive_item: staff archive a received item as donated or disposed.
--    Open claims are closed and the photo rows are removed in the same
--    transaction. The caller deletes the returned storage paths.
-- 2. restore_item: admins put an archived item back on the shelf with a new photo.
-- 3. run_privacy_cleanup: admins clear claim contact details once the item
--    was collected more than contact_retention_days ago. Each run is logged.

-- A collected no-proof claim may lose its contact details in the cleanup.
alter table public.claims drop constraint claims_no_proof_needs_contact;
alter table public.claims add constraint claims_no_proof_needs_contact check (
  no_proof = false
  or status = 'collected'
  or nullif(btrim(contact_phone), '') is not null
  or nullif(btrim(contact_address), '') is not null
);

create or replace function public.archive_item(p_item_id uuid, p_outcome public.archived_outcome)
returns text[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_paths text[];
begin
  if p_outcome is null then
    raise exception 'Choose donated or disposed'
      using errcode = 'check_violation';
  end if;

  update public.items
  set status = 'archived',
    archived_outcome = p_outcome
  where id = p_item_id
    and status = 'received';

  if not found then
    raise exception 'Only a received item at your desk can be archived'
      using errcode = 'check_violation';
  end if;

  update public.claims
  set status = 'rejected',
    rejection_reason = 'The item was archived after the holding period'
  where item_id = p_item_id
    and status in ('pending', 'on_hold', 'approved');

  select coalesce(array_agg(storage_path), '{}')
  into v_paths
  from public.item_photos
  where item_id = p_item_id;

  delete from public.item_photos
  where item_id = p_item_id;

  return v_paths;
end;
$$;

revoke all on function public.archive_item(uuid, public.archived_outcome) from public;
grant execute on function public.archive_item(uuid, public.archived_outcome) to authenticated;

create or replace function public.restore_item(p_item_id uuid, p_photo_path text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can restore an archived item'
      using errcode = 'insufficient_privilege';
  end if;

  if nullif(btrim(coalesce(p_photo_path, '')), '') is null then
    raise exception 'A new photo is required to restore the item'
      using errcode = 'check_violation';
  end if;

  update public.items
  set status = 'received',
    archived_outcome = null,
    archived_at = null,
    archived_by = null,
    received_at = now()
  where id = p_item_id
    and status = 'archived';

  if not found then
    raise exception 'That item is not archived'
      using errcode = 'check_violation';
  end if;

  insert into public.item_photos (item_id, storage_path)
  values (p_item_id, p_photo_path);
end;
$$;

revoke all on function public.restore_item(uuid, text) from public;
grant execute on function public.restore_item(uuid, text) to authenticated;

-- Definer so the run can be written to the append-only audit log.
create or replace function public.run_privacy_cleanup()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_cleared integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can run the privacy cleanup'
      using errcode = 'insufficient_privilege';
  end if;

  v_days := coalesce(public.setting_int('contact_retention_days'), 180);

  update public.claims
  set contact_phone = null,
    contact_address = null
  where status = 'collected'
    and (contact_phone is not null or contact_address is not null)
    and exists (
      select 1
      from public.handovers
      where handovers.claim_id = claims.id
        and handovers.collected_at < now() - make_interval(days => v_days)
    );

  get diagnostics v_cleared = row_count;

  insert into public.audit_log (actor_id, entity_type, entity_id, action, details)
  values (
    auth.uid(),
    'privacy_cleanup',
    gen_random_uuid(),
    'privacy_cleanup',
    jsonb_build_object('claims_cleared', v_cleared, 'retention_days', v_days)
  );

  return v_cleared;
end;
$$;

revoke all on function public.run_privacy_cleanup() from public;
grant execute on function public.run_privacy_cleanup() to authenticated;
