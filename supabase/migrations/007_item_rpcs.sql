-- FindrYU schema, part 7. Save an item and its photo in one transaction.
-- An item must have a photo when the transaction commits, so separate
-- API requests for the item and the photo cannot work.
-- These run as the caller, so every RLS policy still applies.

create or replace function public.report_found_item(
  p_category_id uuid,
  p_description text,
  p_building_id uuid,
  p_found_at timestamptz,
  p_location_id uuid,
  p_photo_path text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
  new_ref text;
begin
  insert into public.items (
    category_id,
    description,
    building_id,
    found_at,
    reported_by,
    intended_location_id,
    status
  )
  values (
    p_category_id,
    p_description,
    p_building_id,
    p_found_at,
    auth.uid(),
    p_location_id,
    'reported'
  )
  returning id, ref_code into new_id, new_ref;

  insert into public.item_photos (item_id, storage_path)
  values (new_id, p_photo_path);

  return new_ref;
end;
$$;

create or replace function public.log_walk_in_item(
  p_category_id uuid,
  p_description text,
  p_building_id uuid,
  p_found_at timestamptz,
  p_location_id uuid,
  p_photo_path text,
  p_hidden_detail text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.items (
    category_id,
    description,
    building_id,
    found_at,
    logged_by_staff,
    intended_location_id,
    current_location_id,
    status
  )
  values (
    p_category_id,
    p_description,
    p_building_id,
    p_found_at,
    auth.uid(),
    p_location_id,
    p_location_id,
    'received'
  )
  returning id into new_id;

  insert into public.item_photos (item_id, storage_path)
  values (new_id, p_photo_path);

  insert into public.item_secrets (item_id, hidden_detail, recorded_by)
  values (new_id, p_hidden_detail, auth.uid());

  return new_id;
end;
$$;

revoke all on function public.report_found_item(uuid, text, uuid, timestamptz, uuid, text)
  from public, anon;
revoke all on function public.log_walk_in_item(uuid, text, uuid, timestamptz, uuid, text, text)
  from public, anon;
grant execute on function public.report_found_item(uuid, text, uuid, timestamptz, uuid, text)
  to authenticated;
grant execute on function public.log_walk_in_item(uuid, text, uuid, timestamptz, uuid, text, text)
  to authenticated;
