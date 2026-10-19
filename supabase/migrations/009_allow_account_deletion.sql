-- FindrYU schema, part 9. Let accounts be deleted.
-- Deleting a profile sets audit_log.actor_id to null. The append-only
-- trigger blocked that, so anyone with audit history could never be
-- deleted. That one change is now allowed. Every other update, and every
-- delete, is still refused. Signed-in users have no update grant on this
-- table, so only the foreign key action and the service role reach here.

create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.actor_id is not null
    and new.actor_id is null
    and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;

  raise exception 'audit_log is append-only'
    using errcode = 'check_violation';
end;
$$;
