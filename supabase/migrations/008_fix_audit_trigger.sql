-- FindrYU schema, part 8. Fix the audit trigger.
-- PL/pgSQL resolves every field in an expression when the statement is
-- planned, so one CASE that read new.ref_code and new.item_id failed for
-- both items and claims. Each table now gets its own statement.

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
  row_details jsonb;
begin
  if tg_table_name = 'items' then
    entity := 'item';
    row_details := jsonb_build_object('ref_code', new.ref_code);
  elsif tg_table_name = 'claims' then
    entity := 'claim';
    row_details := jsonb_build_object('item_id', new.item_id);
  else
    entity := tg_table_name;
    row_details := '{}'::jsonb;
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
    row_details
  );

  return new;
end;
$$;
