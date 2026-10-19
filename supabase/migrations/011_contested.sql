-- FindrYU schema, part 11. Reopen a collected item as contested.
-- Only one claim per item may be approved or collected, so the previous
-- owner's collected claim is closed as rejected, with the reason, in the
-- same transaction. Its contact details stay so staff can recover the item.
-- This runs as the caller, so every RLS policy still applies.

create or replace function public.reopen_contested(p_item_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_updated integer;
begin
  if v_reason is null then
    raise exception 'Give a reason for reopening the item'
      using errcode = 'check_violation';
  end if;

  update public.items
  set status = 'contested'
  where id = p_item_id
    and status = 'collected';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Only a collected item at your desk can be reopened'
      using errcode = 'check_violation';
  end if;

  update public.claims
  set status = 'rejected',
      rejection_reason = 'Reopened as contested: ' || v_reason,
      decided_by = auth.uid(),
      decided_at = now()
  where item_id = p_item_id
    and status = 'collected';
end;
$$;

revoke all on function public.reopen_contested(uuid, text) from public, anon;
grant execute on function public.reopen_contested(uuid, text) to authenticated;
