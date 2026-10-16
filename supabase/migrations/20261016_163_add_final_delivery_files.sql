-- A creator can upload the finished files with the final delivery.
--
-- Until now a final delivery carried only links to wherever the creator
-- kept the files. Now the files themselves can be uploaded: single files,
-- or a folder, which the website zips in the browser first (and which it
-- recommends for any set of files).
--
-- 1. A private bucket, delivery-files. Up to 1 GB a file (the project-wide
--    upload limit in the Supabase dashboard must be at least that), any
--    file type. Files are always handed out as downloads, never shown in
--    the browser.
-- 2. Only the commission's creator may upload, into the folder named after
--    the accepted agreement, and only while the commission is active.
-- 3. listing_request_final_deliveries.delivery_file_paths lists the files of
--    each delivery, at most 20 and 5 GB in all.
--    create_listing_request_final_delivery_v2 takes them, together with the
--    off-site record of 20261013_162, in one transaction, and calls the
--    existing function, which keeps every check it has today.
-- 4. Who can download: the creator; an admin; and the buyer once the
--    delivery has been submitted and nothing is still owed before the final
--    release. Paying the balance unlocks the files.
-- 5. Retention: the files are part of the commission's stored material, so
--    the 180-day rule of 20261012_159 covers them: the clock starts when the
--    commission closes, a dispute hold stops it, and the hourly ops job
--    deletes them with the commission's images. The ops job needs no
--    change: it already handles more than one bucket per subject.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-files',
  'delivery-files',
  false,
  1073741824, -- 1 GB
  null
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.listing_request_final_deliveries
  add column if not exists delivery_file_paths text[] not null default '{}'::text[],
  add column if not exists delivery_files_deleted_at timestamptz;

alter table public.listing_request_final_deliveries
  drop constraint if exists listing_request_final_deliveries_file_count_check;

alter table public.listing_request_final_deliveries
  add constraint listing_request_final_deliveries_file_count_check
    check (cardinality(delivery_file_paths) <= 20);

comment on column public.listing_request_final_deliveries.delivery_files_deleted_at is
  'When this delivery''s uploaded files were deleted under the retention rule (20261016_163). delivery_file_paths is emptied at the same time.';

-- 2. Upload: the creator, into the agreement's folder, while it is active.
drop policy if exists "delivery files creator upload" on storage.objects;
create policy "delivery files creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-files'
    and exists (
      select 1
      from public.listing_request_agreements
      inner join public.listing_requests
        on listing_requests.id = listing_request_agreements.listing_request_id
      where listing_request_agreements.id::text = (storage.foldername(objects.name))[1]
        and listing_request_agreements.creator_user_id = auth.uid()
        and listing_request_agreements.status = 'buyer_accepted'
        and listing_requests.status = 'accepted'
    )
  );

-- 4. Download.
create or replace function public.can_download_delivery_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin_user(auth.uid())
      or exists (
        select 1
        from public.listing_request_final_deliveries as delivery
        where delivery.delivery_file_paths @> array[p_name]
          and (
            delivery.creator_user_id = auth.uid()
            or (
              delivery.buyer_user_id = auth.uid()
              and delivery.status in ('submitted', 'revision_requested', 'buyer_approved')
              and not exists (
                select 1
                from public.listing_request_payment_schedule_items as item
                where item.agreement_id = delivery.agreement_id
                  and item.payment_timing = 'due_before_final_release'
                  and item.amount > 0
                  and item.status in ('pending', 'payment_required')
              )
            )
          )
      )
    );
$$;

revoke all on function public.can_download_delivery_file(text) from public, anon;
grant execute on function public.can_download_delivery_file(text) to authenticated;

drop policy if exists "delivery files read" on storage.objects;
create policy "delivery files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'delivery-files'
    and (
      owner_id = auth.uid()::text
      or public.can_download_delivery_file(objects.name)
    )
  );

-- No update or delete policy: a delivered file cannot be swapped or removed
-- underneath the buyer.

-- 3. Creates a final delivery with its files and, optionally, the off-site
-- record.
create or replace function public.create_listing_request_final_delivery_v2(
  p_agreement_id uuid,
  p_status text,
  p_title text,
  p_summary text,
  p_delivery_links text[],
  p_file_paths text[],
  p_off_site_methods text[] default '{}'::text[],
  p_off_site_other text default null
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  version_number integer,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_paths text[];
  clean_methods text[] := '{}'::text[];
  total_bytes bigint;
  created record;
begin
  select coalesce(array_agg(distinct btrim(given.path)), '{}'::text[])
  into clean_paths
  from unnest(coalesce(p_file_paths, '{}'::text[])) as given(path)
  where btrim(given.path) <> '';

  if cardinality(clean_paths) > 20 then
    raise exception
      'A final delivery can contain no more than 20 files.'
      using errcode = '22023';
  end if;

  -- Every file must be one this creator uploaded into this agreement's
  -- folder.
  if exists (
    select 1
    from unnest(clean_paths) as given(path)
    where given.path not like p_agreement_id::text || '/%'
      or not exists (
        select 1
        from storage.objects
        where objects.bucket_id = 'delivery-files'
          and objects.name = given.path
          and objects.owner_id = auth.uid()::text
      )
  ) then
    raise exception
      'A delivery file was not uploaded for this commission. Choose the file again.'
      using errcode = '22023';
  end if;

  select coalesce(sum((objects.metadata ->> 'size')::bigint), 0)
  into total_bytes
  from storage.objects
  where objects.bucket_id = 'delivery-files'
    and objects.name = any (clean_paths);

  if total_bytes > 5368709120 then
    raise exception
      'The files in one final delivery can add up to 5 GB at most.'
      using errcode = '22023';
  end if;

  if cardinality(coalesce(p_off_site_methods, '{}'::text[])) > 0 then
    clean_methods :=
      public.clean_off_site_delivery_methods(p_off_site_methods, p_off_site_other);
  end if;

  select *
  into created
  from public.create_listing_request_final_delivery(
    p_agreement_id,
    p_status,
    p_title,
    p_summary,
    p_delivery_links
  ) as existing_result;

  update public.listing_request_final_deliveries
  set
    delivery_file_paths = clean_paths,
    off_site_delivery_methods = clean_methods,
    off_site_delivery_other =
      case
        when 'other' = any (clean_methods) then btrim(p_off_site_other)
      end
  where listing_request_final_deliveries.id = created.id;

  return query
  select
    created.id,
    created.listing_request_id,
    created.agreement_id,
    created.status,
    created.version_number,
    created.submitted_at;
end;
$$;

revoke all on function public.create_listing_request_final_delivery_v2(
  uuid, text, text, text, text[], text[], text[], text
) from public, anon;
grant execute on function public.create_listing_request_final_delivery_v2(
  uuid, text, text, text, text[], text[], text[], text
) to authenticated;

-- 5. Retention.

-- Every delivery file stored for a commission, attached to a delivery or
-- not (an upload whose delivery then failed is still in the folder).
create or replace function public.list_commission_delivery_file_paths(
  p_listing_request_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(objects.name order by objects.name), '{}'::text[])
  from public.listing_request_agreements
  inner join storage.objects
    on objects.bucket_id = 'delivery-files'
    and objects.name like listing_request_agreements.id::text || '/%'
  where listing_request_agreements.listing_request_id = p_listing_request_id;
$$;

revoke all on function public.list_commission_delivery_file_paths(uuid)
  from public, anon, authenticated;

-- Same as 20261012_159, but a commission with delivery files and no images
-- also gets its clock.
create or replace function public.track_commission_image_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  closed constant text[] := array['completed', 'cancelled', 'declined', 'archived'];
begin
  if new.status = any (closed) then
    -- Completed and then archived keeps the first clock.
    if cardinality(public.list_commission_image_paths(new.id)) > 0
      or cardinality(public.list_commission_delivery_file_paths(new.id)) > 0 then
      insert into public.commission_image_retention (
        listing_request_id, closed_at, delete_after
      )
      values (
        new.id,
        now(),
        now() + make_interval(days => public.commission_image_retention_days())
      )
      on conflict (listing_request_id) do nothing;
    end if;
  else
    -- Open again: the files are in use, so the clock is dropped.
    delete from public.commission_image_retention
    where listing_request_id = new.id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

-- One row per bucket for each commission that is due. The ops job groups
-- them, deletes every file, then marks the commission as done.
create or replace function public.list_commission_images_due_for_deletion(
  p_limit integer default 20
)
returns table (
  listing_request_id uuid,
  bucket text,
  paths text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with due as (
    select
      commission_image_retention.listing_request_id,
      commission_image_retention.delete_after
    from public.commission_image_retention
    where commission_image_retention.deleted_at is null
      and not commission_image_retention.on_hold
      and commission_image_retention.delete_after <= now()
    order by commission_image_retention.delete_after
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  select
    due.listing_request_id,
    'milestone-previews'::text,
    public.list_commission_image_paths(due.listing_request_id)
  from due
  union all
  select
    due.listing_request_id,
    'delivery-files'::text,
    public.list_commission_delivery_file_paths(due.listing_request_id)
  from due;
$$;

create or replace function public.mark_commission_images_deleted(
  p_listing_request_id uuid,
  p_file_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer :=
    cardinality(public.list_commission_image_paths(p_listing_request_id))
    + cardinality(public.list_commission_delivery_file_paths(p_listing_request_id));
begin
  if remaining > 0 then
    raise exception 'IMG-001: commission % still has % stored file(s), so it was not marked as deleted.',
      p_listing_request_id, remaining
      using errcode = 'P0001';
  end if;

  update public.listing_request_milestone_submissions
  set
    preview_image_paths = '{}'::text[],
    preview_images_deleted_at = now()
  where listing_request_milestone_submissions.listing_request_id = p_listing_request_id
    and cardinality(listing_request_milestone_submissions.preview_image_paths) > 0;

  update public.listing_request_final_deliveries
  set
    delivery_file_paths = '{}'::text[],
    delivery_files_deleted_at = now()
  where listing_request_final_deliveries.listing_request_id = p_listing_request_id
    and cardinality(listing_request_final_deliveries.delivery_file_paths) > 0;

  update public.commission_image_retention
  set
    deleted_at = now(),
    deleted_file_count = greatest(coalesce(p_file_count, 0), 0)
  where commission_image_retention.listing_request_id = p_listing_request_id
    and commission_image_retention.deleted_at is null;
end;
$$;
