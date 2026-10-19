-- FindrYU schema, part 10. Claims.
-- 1. claims_before_write refused every staff update, because the proof-note
--    check said "is not distinct from" where it meant "is distinct from".
-- 2. submit_claim saves a claim and its proof files in one transaction.
--    It runs as the caller, so every RLS policy still applies.

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
    or new.proof_note is distinct from old.proof_note
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

create or replace function public.submit_claim(
  p_item_id uuid,
  p_hidden_detail_answer text,
  p_proof_note text,
  p_no_proof boolean,
  p_contact_phone text,
  p_contact_address text,
  p_proof_paths text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_no_proof boolean := coalesce(p_no_proof, false);
  v_proof_count integer := coalesce(array_length(p_proof_paths, 1), 0);
  v_note text := nullif(btrim(coalesce(p_proof_note, '')), '');
  new_id uuid;
  proof_path text;
begin
  if v_no_proof and (v_proof_count > 0 or v_note is not null) then
    raise exception 'Leave proof empty when you tick No proof available'
      using errcode = 'check_violation';
  end if;

  if not v_no_proof and v_proof_count = 0 and v_note is null then
    raise exception 'Add proof of ownership or tick No proof available'
      using errcode = 'check_violation';
  end if;

  if v_proof_count > 3 then
    raise exception 'Add up to 3 proof files'
      using errcode = 'check_violation';
  end if;

  insert into public.claims (
    item_id,
    claimant_id,
    hidden_detail_answer,
    proof_note,
    no_proof,
    contact_phone,
    contact_address
  )
  values (
    p_item_id,
    auth.uid(),
    btrim(p_hidden_detail_answer),
    v_note,
    v_no_proof,
    case when v_no_proof then p_contact_phone end,
    case when v_no_proof then p_contact_address end
  )
  returning id into new_id;

  foreach proof_path in array coalesce(p_proof_paths, '{}'::text[]) loop
    insert into public.claim_proofs (claim_id, storage_path)
    values (new_id, proof_path);
  end loop;

  return new_id;
end;
$$;

revoke all on function public.submit_claim(uuid, text, text, boolean, text, text, text[]) from public, anon;
grant execute on function public.submit_claim(uuid, text, text, boolean, text, text, text[]) to authenticated;
