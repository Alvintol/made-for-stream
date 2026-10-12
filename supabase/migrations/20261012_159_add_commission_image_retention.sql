-- Images uploaded to a commission are kept only as long as they are needed.
--
-- Rule (Privacy Policy 2026-10-12, section 8): while the commission is open
-- the images stay. Once it is completed, cancelled, declined or archived
-- they are kept 180 days, then deleted. 180 days covers the period in which
-- a card payment can ordinarily be disputed (about 120 days) with room to
-- answer one. An admin can put a commission on hold when a dispute or legal
-- matter needs its images longer.
--
-- So that the daily check does not look at every commission, one row is
-- written here at the moment a commission WITH images closes. The check
-- reads only these rows.
--
-- Deleting a stored file cannot be done from SQL (Storage refuses direct
-- deletes), so the API does it, from the hourly ops job:
--   1. list_commission_images_due_for_deletion()  -> what is due
--   2. the Storage API removes the files
--   3. mark_commission_images_deleted()           -> records it, and refuses
--      if any file is still there
--
-- Today the only commission images are milestone previews (20261011_154).
-- Reference images, when they are built, belong in
-- list_commission_image_paths() and nowhere else.

-- The one place the retention period is set.
create or replace function public.commission_image_retention_days()
returns integer
language sql
immutable
as $$
  select 180;
$$;

create table if not exists public.commission_image_retention (
  listing_request_id uuid primary key
    references public.listing_requests (id) on delete cascade,
  closed_at timestamptz not null,
  delete_after timestamptz not null,
  -- Set by an admin, in SQL, when a dispute or legal matter needs the
  -- images kept. A row on hold is skipped until the hold is cleared.
  on_hold boolean not null default false,
  hold_reason text,
  deleted_at timestamptz,
  deleted_file_count integer,
  check (not on_hold or char_length(btrim(coalesce(hold_reason, ''))) >= 5)
);

create index if not exists commission_image_retention_due_idx
  on public.commission_image_retention (delete_after)
  where deleted_at is null;

alter table public.commission_image_retention enable row level security;
revoke all on public.commission_image_retention from anon, authenticated;

alter table public.listing_request_milestone_submissions
  add column if not exists preview_images_deleted_at timestamptz;

comment on column public.listing_request_milestone_submissions.preview_images_deleted_at is
  'When this submission''s preview images were deleted under the retention rule (20261012_159). preview_image_paths is emptied at the same time.';

-- Every stored image that belongs to a commission, attached to a submission
-- or not (an upload whose submission then failed is still in the folder).
create or replace function public.list_commission_image_paths(
  p_listing_request_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(objects.name order by objects.name), '{}'::text[])
  from public.listing_request_milestones
  inner join storage.objects
    on objects.bucket_id = 'milestone-previews'
    and objects.name like listing_request_milestones.id::text || '/%'
  where listing_request_milestones.listing_request_id = p_listing_request_id;
$$;

revoke all on function public.list_commission_image_paths(uuid)
  from public, anon, authenticated;

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
    if cardinality(public.list_commission_image_paths(new.id)) > 0 then
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
    -- Open again: the images are in use, so the clock is dropped.
    delete from public.commission_image_retention
    where listing_request_id = new.id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.track_commission_image_retention()
  from public, anon, authenticated;

drop trigger if exists listing_requests_track_image_retention on public.listing_requests;
create trigger listing_requests_track_image_retention
  after update of status on public.listing_requests
  for each row
  when (old.status is distinct from new.status)
  execute function public.track_commission_image_retention();

-- Commissions that closed before this migration and still have images.
insert into public.commission_image_retention (listing_request_id, closed_at, delete_after)
select
  listing_requests.id,
  coalesce(listing_requests.completed_at, listing_requests.cancelled_at, listing_requests.archived_at, listing_requests.updated_at),
  coalesce(listing_requests.completed_at, listing_requests.cancelled_at, listing_requests.archived_at, listing_requests.updated_at)
    + make_interval(days => public.commission_image_retention_days())
from public.listing_requests
where listing_requests.status in ('completed', 'cancelled', 'declined', 'archived')
  and cardinality(public.list_commission_image_paths(listing_requests.id)) > 0
on conflict (listing_request_id) do nothing;

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
  select
    commission_image_retention.listing_request_id,
    'milestone-previews'::text,
    public.list_commission_image_paths(commission_image_retention.listing_request_id)
  from public.commission_image_retention
  where commission_image_retention.deleted_at is null
    and not commission_image_retention.on_hold
    and commission_image_retention.delete_after <= now()
  order by commission_image_retention.delete_after
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.list_commission_images_due_for_deletion(integer)
  from public, anon, authenticated;
grant execute on function public.list_commission_images_due_for_deletion(integer)
  to service_role;

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
    cardinality(public.list_commission_image_paths(p_listing_request_id));
begin
  if remaining > 0 then
    raise exception 'IMG-001: commission % still has % stored image(s), so it was not marked as deleted.',
      p_listing_request_id, remaining
      using errcode = 'P0001';
  end if;

  update public.listing_request_milestone_submissions
  set
    preview_image_paths = '{}'::text[],
    preview_images_deleted_at = now()
  where listing_request_milestone_submissions.listing_request_id = p_listing_request_id
    and cardinality(listing_request_milestone_submissions.preview_image_paths) > 0;

  update public.commission_image_retention
  set
    deleted_at = now(),
    deleted_file_count = greatest(coalesce(p_file_count, 0), 0)
  where commission_image_retention.listing_request_id = p_listing_request_id
    and commission_image_retention.deleted_at is null;
end;
$$;

revoke all on function public.mark_commission_images_deleted(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.mark_commission_images_deleted(uuid, integer)
  to service_role;
