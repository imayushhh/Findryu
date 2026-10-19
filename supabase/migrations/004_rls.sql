-- FindrYU schema, part 4 of 6. Row level security.
-- No policy means no access. Staff includes admins via is_staff().

alter table public.locations enable row level security;
alter table public.buildings enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.item_secrets enable row level security;
alter table public.item_transfers enable row level security;
alter table public.lost_reports enable row level security;
alter table public.claims enable row level security;
alter table public.claim_proofs enable row level security;
alter table public.handovers enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

create policy locations_read on public.locations
for select to authenticated
using (true);

create policy locations_write on public.locations
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy buildings_read on public.buildings
for select to authenticated
using (true);

create policy buildings_write on public.buildings
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy categories_read on public.categories
for select to authenticated
using (true);

create policy categories_write on public.categories
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy settings_read on public.settings
for select to authenticated
using (true);

create policy settings_write on public.settings
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy profiles_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.is_staff())
);

create policy profiles_update on public.profiles
for update to authenticated
using (
  id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  id = (select auth.uid())
  or (select public.is_admin())
);

create policy items_read on public.items
for select to authenticated
using (
  (select public.is_staff())
  or status in ('received', 'in_transit')
  or reported_by = (select auth.uid())
);

create policy items_insert on public.items
for insert to authenticated
with check (
  (
    reported_by = (select auth.uid())
    and status = 'reported'
    and logged_by_staff is null
  )
  or (
    (select public.is_staff())
    and logged_by_staff = (select auth.uid())
    and status = 'received'
    and current_location_id is not null
    and (
      (select public.is_admin())
      or current_location_id = (select public.my_location_id())
    )
  )
);

-- Sending a transfer sets status to in_transit and current_location_id to the destination.
create policy items_update on public.items
for update to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and (
      current_location_id = (select public.my_location_id())
      or (
        status = 'reported'
        and intended_location_id = (select public.my_location_id())
      )
    )
  )
)
with check (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and (
      current_location_id = (select public.my_location_id())
      or status = 'in_transit'
    )
  )
);

create policy item_photos_read on public.item_photos
for select to authenticated
using (
  exists (
    select 1
    from public.items
    where items.id = item_photos.item_id
  )
);

create policy item_photos_insert on public.item_photos
for insert to authenticated
with check (
  exists (
    select 1
    from public.items
    where items.id = item_photos.item_id
      and (
        (select public.is_staff())
        or (
          items.reported_by = (select auth.uid())
          and items.status = 'reported'
        )
      )
  )
  and (
    (select public.is_staff())
    or storage_path like (select auth.uid()::text) || '/%'
  )
);

create policy item_photos_delete on public.item_photos
for delete to authenticated
using (
  exists (
    select 1
    from public.items
    where items.id = item_photos.item_id
      and (
        (select public.is_admin())
        or (
          (select public.is_staff())
          and (
            items.current_location_id = (select public.my_location_id())
            or (
              items.status = 'reported'
              and items.intended_location_id = (select public.my_location_id())
            )
          )
        )
        or (
          items.reported_by = (select auth.uid())
          and items.status = 'reported'
        )
      )
  )
);

create policy item_secrets_read on public.item_secrets
for select to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and exists (
      select 1
      from public.items
      where items.id = item_secrets.item_id
        and (
          items.current_location_id = (select public.my_location_id())
          or (
            items.status = 'reported'
            and items.intended_location_id = (select public.my_location_id())
          )
        )
    )
  )
);

create policy item_secrets_insert on public.item_secrets
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (
    (select public.is_admin())
    or (
      (select public.is_staff())
      and exists (
        select 1
        from public.items
        where items.id = item_secrets.item_id
          and (
            items.current_location_id = (select public.my_location_id())
            or (
              items.status = 'reported'
              and items.intended_location_id = (select public.my_location_id())
            )
          )
      )
    )
  )
);

create policy item_secrets_update on public.item_secrets
for update to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and exists (
      select 1
      from public.items
      where items.id = item_secrets.item_id
        and (
          items.current_location_id = (select public.my_location_id())
          or (
            items.status = 'reported'
            and items.intended_location_id = (select public.my_location_id())
          )
        )
    )
  )
)
with check (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and exists (
      select 1
      from public.items
      where items.id = item_secrets.item_id
        and (
          items.current_location_id = (select public.my_location_id())
          or (
            items.status = 'reported'
            and items.intended_location_id = (select public.my_location_id())
          )
        )
    )
  )
);

create policy item_transfers_read on public.item_transfers
for select to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and (
      from_location_id = (select public.my_location_id())
      or to_location_id = (select public.my_location_id())
    )
  )
);

create policy item_transfers_insert on public.item_transfers
for insert to authenticated
with check (
  sent_by = (select auth.uid())
  and (
    (select public.is_admin())
    or (
      (select public.is_staff())
      and from_location_id = (select public.my_location_id())
    )
  )
);

create policy item_transfers_update on public.item_transfers
for update to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and (
      from_location_id = (select public.my_location_id())
      or to_location_id = (select public.my_location_id())
    )
  )
)
with check (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and (
      from_location_id = (select public.my_location_id())
      or to_location_id = (select public.my_location_id())
    )
  )
);

create policy lost_reports_owner on public.lost_reports
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy claims_read on public.claims
for select to authenticated
using (
  claimant_id = (select auth.uid())
  or (select public.is_admin())
  or (
    (select public.is_staff())
    and exists (
      select 1
      from public.items
      where items.id = claims.item_id
        and (
          items.current_location_id = (select public.my_location_id())
          or (
            items.status = 'reported'
            and items.intended_location_id = (select public.my_location_id())
          )
        )
    )
  )
);

create policy claims_insert on public.claims
for insert to authenticated
with check (
  claimant_id = (select auth.uid())
  and status in ('pending', 'on_hold')
);

create policy claims_update on public.claims
for update to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and exists (
      select 1
      from public.items
      where items.id = claims.item_id
        and (
          items.current_location_id = (select public.my_location_id())
          or (
            items.status = 'in_transit'
            and items.current_location_id = (select public.my_location_id())
          )
        )
    )
  )
)
with check (
  (select public.is_admin())
  or (
    (select public.is_staff())
    and exists (
      select 1
      from public.items
      where items.id = claims.item_id
        and items.current_location_id = (select public.my_location_id())
    )
  )
);

create policy claim_proofs_read on public.claim_proofs
for select to authenticated
using (
  exists (
    select 1
    from public.claims
    join public.items on items.id = claims.item_id
    where claims.id = claim_proofs.claim_id
      and (
        claims.claimant_id = (select auth.uid())
        or (select public.is_admin())
        or (
          (select public.is_staff())
          and items.current_location_id = (select public.my_location_id())
        )
      )
  )
);

create policy claim_proofs_insert on public.claim_proofs
for insert to authenticated
with check (
  exists (
    select 1
    from public.claims
    join public.items on items.id = claims.item_id
    where claims.id = claim_proofs.claim_id
      and (
        (
          claims.claimant_id = (select auth.uid())
          and storage_path like (select auth.uid()::text) || '/%'
        )
        or (select public.is_admin())
        or (
          (select public.is_staff())
          and items.current_location_id = (select public.my_location_id())
        )
      )
  )
);

create policy handovers_read on public.handovers
for select to authenticated
using (
  (select public.is_staff())
  or exists (
    select 1
    from public.claims
    where claims.id = handovers.claim_id
      and claims.claimant_id = (select auth.uid())
  )
);

create policy handovers_insert on public.handovers
for insert to authenticated
with check (
  staff_id = (select auth.uid())
  and (select public.is_staff())
  and photo_id_checked
);

create policy audit_log_read on public.audit_log
for select to authenticated
using ((select public.is_staff()));

revoke all on table public.locations from anon, public;
revoke all on table public.buildings from anon, public;
revoke all on table public.categories from anon, public;
revoke all on table public.profiles from anon, public;
revoke all on table public.items from anon, public;
revoke all on table public.item_photos from anon, public;
revoke all on table public.item_secrets from anon, public;
revoke all on table public.item_transfers from anon, public;
revoke all on table public.lost_reports from anon, public;
revoke all on table public.claims from anon, public;
revoke all on table public.claim_proofs from anon, public;
revoke all on table public.handovers from anon, public;
revoke all on table public.settings from anon, public;
revoke all on table public.audit_log from anon, authenticated, public;

grant select, insert, update, delete on table public.locations to authenticated;
grant select, insert, update, delete on table public.buildings to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.items to authenticated;
grant select, insert, delete on table public.item_photos to authenticated;
grant select, insert, update on table public.item_secrets to authenticated;
grant select, insert, update on table public.item_transfers to authenticated;
grant select, insert, update, delete on table public.lost_reports to authenticated;
grant select, insert, update on table public.claims to authenticated;
grant select, insert on table public.claim_proofs to authenticated;
grant select, insert on table public.handovers to authenticated;
grant select, insert, update, delete on table public.settings to authenticated;
grant select on table public.audit_log to authenticated;

grant usage, select on sequence public.item_ref_seq to authenticated;
