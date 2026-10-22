-- FindrYU schema, part 13. Lost report alerts.
-- One row per lost report and matching item. The unique pair stops the same
-- match from being emailed twice, and the owner can see it on My items even
-- when the email could not be delivered.

create table public.lost_report_alerts (
  id uuid primary key default gen_random_uuid(),
  lost_report_id uuid not null references public.lost_reports (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lost_report_alerts_once unique (lost_report_id, item_id)
);

create index lost_report_alerts_item_id_idx on public.lost_report_alerts (item_id);

alter table public.lost_report_alerts enable row level security;

create policy lost_report_alerts_read on public.lost_report_alerts
for select to authenticated
using (
  (select public.is_staff())
  or exists (
    select 1
    from public.lost_reports
    where lost_reports.id = lost_report_alerts.lost_report_id
      and lost_reports.owner_id = (select auth.uid())
  )
);

create policy lost_report_alerts_insert on public.lost_report_alerts
for insert to authenticated
with check ((select public.is_staff()));

create policy lost_report_alerts_update on public.lost_report_alerts
for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));
