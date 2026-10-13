-- Follows 20261012_159 (commission images are deleted 180 days after a
-- commission closes).
--
-- 1. "In dispute" hold, for admins. An admin can mark a commission as in
--    dispute at any time, open or closed. While it is, its images are not
--    deleted. When the admin ends the hold, the images are kept at least 30
--    more days, so nothing disappears the hour a dispute is settled.
--    A hold can now exist before a commission closes, so the closing dates
--    on the tracking row may be empty until it does.
--
-- 2. Listing images get the same treatment. When a listing stops being
--    offered (it was published and active, and no longer is), one tracking
--    row is written; 180 days later its preview image and animated preview
--    are deleted and the listing is put back to draft with no image. Making
--    it active again removes the row.
--
-- 3. A listing cannot be made live without a preview image. This is what
--    makes a creator upload a new one after the old one was deleted.

-- ---------------------------------------------------------------------
-- 1. Dispute hold
-- ---------------------------------------------------------------------
alter table public.commission_image_retention
  alter column closed_at drop not null,
  alter column delete_after drop not null,
  add column if not exists hold_placed_by uuid references auth.users (id) on delete set null,
  add column if not exists hold_placed_at timestamptz;

-- Admins may read the tracking rows (the admin commission page shows them).
grant select on public.commission_image_retention to authenticated;

drop policy if exists "admins read commission image retention"
  on public.commission_image_retention;
create policy "admins read commission image retention"
  on public.commission_image_retention
  for select to authenticated
  using (public.is_admin_user(auth.uid()));

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
    -- Completed and then archived keeps the first clock. A row that only
    -- held a dispute hold gets its dates now.
    if cardinality(public.list_commission_image_paths(new.id)) > 0 then
      insert into public.commission_image_retention (
        listing_request_id, closed_at, delete_after
      )
      values (
        new.id,
        now(),
        now() + make_interval(days => public.commission_image_retention_days())
      )
      on conflict (listing_request_id) do update
        set closed_at = coalesce(commission_image_retention.closed_at, excluded.closed_at),
            delete_after = coalesce(commission_image_retention.delete_after, excluded.delete_after);
    end if;
  else
    -- Open again: the images are in use, so the clock is dropped. A hold
    -- stays.
    delete from public.commission_image_retention
    where listing_request_id = new.id
      and deleted_at is null
      and not on_hold;

    update public.commission_image_retention
    set closed_at = null, delete_after = null
    where listing_request_id = new.id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

create or replace function public.admin_set_commission_dispute_hold(
  p_listing_request_id uuid,
  p_in_dispute boolean,
  p_reason text default null
)
returns table (
  listing_request_id uuid,
  on_hold boolean,
  hold_reason text,
  delete_after timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can change a dispute hold.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.listing_requests
    where listing_requests.id = p_listing_request_id
  ) then
    raise exception 'This commission could not be found.'
      using errcode = 'P0001';
  end if;

  if coalesce(p_in_dispute, false) then
    if char_length(clean_reason) < 5 or char_length(clean_reason) > 500 then
      raise exception 'Say why this commission is in dispute, in 5 to 500 characters.'
        using errcode = '22023';
    end if;

    insert into public.commission_image_retention as retention (
      listing_request_id, on_hold, hold_reason, hold_placed_by, hold_placed_at
    )
    values (p_listing_request_id, true, clean_reason, auth.uid(), now())
    on conflict on constraint commission_image_retention_pkey do update
      set on_hold = true,
          hold_reason = excluded.hold_reason,
          hold_placed_by = excluded.hold_placed_by,
          hold_placed_at = excluded.hold_placed_at
      where retention.deleted_at is null;
  else
    -- Ending a hold never deletes at once: at least 30 more days.
    update public.commission_image_retention as retention
    set on_hold = false,
        hold_reason = null,
        delete_after = case
          when retention.delete_after is null then null
          else greatest(retention.delete_after, now() + interval '30 days')
        end
    where retention.listing_request_id = p_listing_request_id
      and retention.on_hold;

    -- A row that only existed for the hold has nothing left to track.
    delete from public.commission_image_retention as retention
    where retention.listing_request_id = p_listing_request_id
      and retention.closed_at is null
      and retention.deleted_at is null
      and not retention.on_hold;
  end if;

  return query
  select retention.listing_request_id, retention.on_hold, retention.hold_reason, retention.delete_after
  from public.commission_image_retention as retention
  where retention.listing_request_id = p_listing_request_id;
end;
$$;

revoke all on function public.admin_set_commission_dispute_hold(uuid, boolean, text)
  from public, anon;
grant execute on function public.admin_set_commission_dispute_hold(uuid, boolean, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 2. Listing images
-- ---------------------------------------------------------------------
create table if not exists public.listing_image_retention (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  closed_at timestamptz not null,
  delete_after timestamptz not null,
  deleted_at timestamptz,
  deleted_file_count integer
);

create index if not exists listing_image_retention_due_idx
  on public.listing_image_retention (delete_after)
  where deleted_at is null;

alter table public.listing_image_retention enable row level security;
revoke all on public.listing_image_retention from anon, authenticated;

-- The listing's own uploads, as (bucket, path). A pasted link from before
-- uploads existed is not a stored file and is not listed.
create or replace function public.list_listing_image_files(p_listing_id uuid)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = public
as $$
  select 'listing-previews'::text,
         substring(listings.preview_url from '/storage/v1/object/public/listing-previews/(.+)$')
  from public.listings
  where listings.id = p_listing_id
    and listings.preview_url ~ '/storage/v1/object/public/listing-previews/.+$'
  union all
  select 'listing-animations'::text,
         substring(listings.animated_preview_url from '/storage/v1/object/public/listing-animations/(.+)$')
  from public.listings
  where listings.id = p_listing_id
    and listings.animated_preview_url ~ '/storage/v1/object/public/listing-animations/.+$';
$$;

revoke all on function public.list_listing_image_files(uuid)
  from public, anon, authenticated;

create or replace function public.track_listing_image_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_live boolean := old.status = 'published' and old.is_active;
  is_live boolean := new.status = 'published' and new.is_active;
begin
  if was_live and not is_live then
    if new.preview_url is not null or new.animated_preview_url is not null then
      insert into public.listing_image_retention (listing_id, closed_at, delete_after)
      values (
        new.id,
        now(),
        now() + make_interval(days => public.commission_image_retention_days())
      )
      on conflict (listing_id) do nothing;
    end if;
  elsif is_live then
    delete from public.listing_image_retention
    where listing_id = new.id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.track_listing_image_retention()
  from public, anon, authenticated;

drop trigger if exists listings_track_image_retention on public.listings;
create trigger listings_track_image_retention
  after update of status, is_active on public.listings
  for each row
  execute function public.track_listing_image_retention();

create or replace function public.list_listing_images_due_for_deletion(
  p_limit integer default 20
)
returns table (
  listing_id uuid,
  bucket text,
  paths text[]
)
language sql
stable
security definer
set search_path = public
as $$
  -- One row per bucket that holds a file. A listing whose image was only
  -- ever a pasted link has no stored file: it comes back once, with no
  -- bucket and no paths, so it can still be put back to draft.
  select
    due.listing_id,
    files.bucket,
    coalesce(array_agg(files.path) filter (where files.path is not null), '{}'::text[])
  from (
    select listing_image_retention.listing_id
    from public.listing_image_retention
    where listing_image_retention.deleted_at is null
      and listing_image_retention.delete_after <= now()
    order by listing_image_retention.delete_after
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) as due
  left join lateral public.list_listing_image_files(due.listing_id) as files on true
  group by due.listing_id, files.bucket;
$$;

revoke all on function public.list_listing_images_due_for_deletion(integer)
  from public, anon, authenticated;
grant execute on function public.list_listing_images_due_for_deletion(integer)
  to service_role;

create or replace function public.mark_listing_images_deleted(
  p_listing_id uuid,
  p_file_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  select count(*)
  into remaining
  from public.list_listing_image_files(p_listing_id) as files
  inner join storage.objects
    on objects.bucket_id = files.bucket
    and objects.name = files.path;

  if remaining > 0 then
    raise exception 'IMG-001: listing % still has % stored image(s), so it was not marked as deleted.',
      p_listing_id, remaining
      using errcode = 'P0001';
  end if;

  -- Back to a draft with no image. It needs a new one before it can be
  -- offered again (the rule in section 3).
  update public.listings
  set preview_url = null,
      animated_preview_url = null,
      status = 'draft',
      is_active = false
  where listings.id = p_listing_id;

  update public.listing_image_retention
  set deleted_at = now(),
      deleted_file_count = greatest(coalesce(p_file_count, 0), 0)
  where listing_image_retention.listing_id = p_listing_id
    and listing_image_retention.deleted_at is null;
end;
$$;

revoke all on function public.mark_listing_images_deleted(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.mark_listing_images_deleted(uuid, integer)
  to service_role;

-- ---------------------------------------------------------------------
-- 3. No live listing without a preview image
-- ---------------------------------------------------------------------
create or replace function public.enforce_listing_preview_before_live()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only at the moment a listing goes live, so listings that are already
  -- live are left alone.
  if new.status = 'published'
    and new.is_active
    and (
      tg_op = 'INSERT'
      or not (old.status = 'published' and old.is_active)
    )
    and (new.preview_url is null or btrim(new.preview_url) = '')
  then
    raise exception 'Add a preview image before making this listing live.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_preview_before_live()
  from public, anon, authenticated;

drop trigger if exists listings_enforce_preview_before_live on public.listings;
create trigger listings_enforce_preview_before_live
  before insert or update of status, is_active, preview_url on public.listings
  for each row execute function public.enforce_listing_preview_before_live();
