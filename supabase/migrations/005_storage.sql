-- FindrYU schema, part 5 of 6. Private storage buckets.
-- The app serves files with short-lived signed URLs created on the server.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'item-photos',
    'item-photos',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'claim-proofs',
    'claim-proofs',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  );

create policy item_photos_storage_read
on storage.objects
for select
to authenticated
using (bucket_id = 'item-photos');

create policy item_photos_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'item-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or (select public.is_staff())
  )
);

create policy item_photos_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'item-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or (select public.is_staff())
  )
)
with check (
  bucket_id = 'item-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or (select public.is_staff())
  )
);

create policy item_photos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'item-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or (select public.is_staff())
  )
);

create policy claim_proofs_storage_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'claim-proofs'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or (select public.is_staff())
  )
);

create policy claim_proofs_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'claim-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy claim_proofs_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'claim-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'claim-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy claim_proofs_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'claim-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
