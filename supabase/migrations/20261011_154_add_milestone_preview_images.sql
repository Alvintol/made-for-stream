-- A creator can attach preview images to a milestone submission.
--
-- The website shrinks each image, draws the "Made for Stream · @handle"
-- watermark across it and re-saves it in the browser, then uploads only
-- that copy here (the same steps as listing thumbnails, 20261006_143, but
-- the watermark is always on). The creator's original never leaves their
-- device, so what the buyer reviews before paying is never the clean file.
--
-- Unlike listing thumbnails these are private: work in progress on one
-- buyer's commission.
--
-- 1. A private bucket, images only, size-capped.
-- 2. Only the milestone's creator may upload, into that milestone's folder,
--    and only while the milestone can be submitted.
-- 3. The creator can read their own uploads. The buyer and admins can read
--    an image once a submission they can see names it.
-- 4. No update or delete policy: a submitted image cannot be swapped or
--    removed underneath the buyer's approval.
-- 5. listing_request_milestone_submissions.preview_image_paths holds the
--    files, and submit_listing_request_milestone takes them as a fourth,
--    optional argument, so the website that does not send it keeps working.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-previews',
  'milestone-previews',
  false,
  2097152, -- 2 MB; the browser's copy is at most 1200 px and far smaller
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.listing_request_milestone_submissions
  add column if not exists preview_image_paths text[] not null default '{}'::text[];

comment on column public.listing_request_milestone_submissions.preview_image_paths is
  'Files in the private milestone-previews bucket, "<milestone id>/<file>". Watermarked copies made in the creator''s browser. Written only by submit_listing_request_milestone.';

create index if not exists listing_request_milestone_submissions_preview_image_paths_idx
  on public.listing_request_milestone_submissions using gin (preview_image_paths);

drop policy if exists "milestone previews creator upload" on storage.objects;
create policy "milestone previews creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'milestone-previews'
    and exists (
      select 1
      from public.listing_request_milestones
      where listing_request_milestones.id::text = (storage.foldername(objects.name))[1]
        and listing_request_milestones.creator_user_id = auth.uid()
        and listing_request_milestones.status in ('pending', 'revision_requested')
    )
  );

-- The inner query runs as the person asking, so the existing rule on
-- submissions (creator, buyer or admin) decides who gets a match.
drop policy if exists "milestone previews participant read" on storage.objects;
create policy "milestone previews participant read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'milestone-previews'
    and (
      owner_id = auth.uid()::text
      or exists (
        select 1
        from public.listing_request_milestone_submissions
        where listing_request_milestone_submissions.preview_image_paths @> array[objects.name]
      )
    )
  );

drop function if exists public.submit_listing_request_milestone(uuid, text, text[]);
drop function if exists public.submit_listing_request_milestone(uuid, text, text[], text[]);

create or replace function
public.submit_listing_request_milestone(
  p_milestone_id uuid,
  p_summary text,
  p_delivery_links text[] default '{}'::text[],
  p_preview_image_paths text[] default '{}'::text[]
)
returns table (
  submission_id uuid,
  milestone_id uuid,
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
  milestone_row
    public.listing_request_milestones%rowtype;

  agreement_row
    public.listing_request_agreements%rowtype;

  payment_row
    public.listing_request_payment_schedule_items%rowtype;

  clean_summary text :=
    btrim(coalesce(p_summary, ''));

  normalized_delivery_links text[] :=
    '{}'::text[];

  normalized_preview_image_paths text[] :=
    '{}'::text[];

  next_version_number integer;
  new_submission_id uuid;
  submitted_time timestamptz := now();

  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'You must be signed in to submit a milestone.'
      using errcode = '42501';
  end if;

  if char_length(clean_summary) < 10
    or char_length(clean_summary) > 4000 then
    raise exception
      'Milestone submission summary must be between 10 and 4000 characters.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(btrim(delivery_link)),
    '{}'::text[]
  )
  into normalized_delivery_links
  from unnest(
    coalesce(
      p_delivery_links,
      '{}'::text[]
    )
  ) as delivery_link
  where btrim(delivery_link) <> '';

  if cardinality(normalized_delivery_links) > 20 then
    raise exception
      'A milestone submission can contain no more than 20 delivery links.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      normalized_delivery_links
    ) as delivery_link
    where char_length(delivery_link) > 2000
  ) then
    raise exception
      'Each milestone delivery link must be 2000 characters or fewer.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(btrim(preview_image_path)),
    '{}'::text[]
  )
  into normalized_preview_image_paths
  from unnest(
    coalesce(
      p_preview_image_paths,
      '{}'::text[]
    )
  ) as preview_image_path
  where btrim(preview_image_path) <> '';

  if cardinality(normalized_preview_image_paths) > 6 then
    raise exception
      'A milestone submission can contain no more than 6 preview images.'
      using errcode = '22023';
  end if;

  select *
  into milestone_row
  from public.listing_request_milestones
  where listing_request_milestones.id =
      p_milestone_id
    and listing_request_milestones.creator_user_id =
      auth.uid()
    and listing_request_milestones.status in (
      'pending',
      'revision_requested'
    )
  for update;

  if not found then
    raise exception
      'This milestone is not available for submission.'
      using errcode = 'P0001';
  end if;

  -- Every preview image must be a file this creator uploaded into this
  -- milestone's own folder of the private bucket.
  if exists (
    select 1
    from unnest(
      normalized_preview_image_paths
    ) as preview_image_path
    where preview_image_path not like
        milestone_row.id::text || '/%'
      or not exists (
        select 1
        from storage.objects
        where objects.bucket_id = 'milestone-previews'
          and objects.name = preview_image_path
          and objects.owner_id = auth.uid()::text
      )
  ) then
    raise exception
      'A milestone preview image was not uploaded for this milestone. Choose the image again.'
      using errcode = '22023';
  end if;

  select *
  into agreement_row
  from public.listing_request_agreements
  where listing_request_agreements.id =
      milestone_row.agreement_id
    and listing_request_agreements.listing_request_id =
      milestone_row.listing_request_id
    and listing_request_agreements.creator_user_id =
      auth.uid()
    and listing_request_agreements.status =
      'buyer_accepted'
    and listing_request_agreements.payment_structure =
      'milestone_payments'
  for update;

  if not found then
    raise exception
      'The accepted milestone agreement could not be found.'
      using errcode = 'P0001';
  end if;

  if agreement_row.starting_payment_status not in (
    'paid',
    'not_required'
  ) then
    raise exception
      'The starting payment must be resolved before milestone work can be submitted.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.listing_requests
    where listing_requests.id =
        milestone_row.listing_request_id
      and listing_requests.creator_user_id =
        auth.uid()
      and listing_requests.status = 'accepted'
  ) then
    raise exception
      'This request is not in an active accepted state.'
      using errcode = 'P0001';
  end if;

  select *
  into payment_row
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.id =
      milestone_row.payment_schedule_item_id
    and listing_request_payment_schedule_items.agreement_id =
      milestone_row.agreement_id
    and listing_request_payment_schedule_items.agreement_item_id =
      milestone_row.agreement_item_id
    and listing_request_payment_schedule_items.payment_timing =
      'due_at_milestone_approval'
    and listing_request_payment_schedule_items.status =
      'pending'
  for update;

  if not found then
    raise exception
      'The pending milestone payment could not be found.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_milestones
    where listing_request_milestones.agreement_id =
        milestone_row.agreement_id
      and listing_request_milestones.sort_order <
        milestone_row.sort_order
      and listing_request_milestones.status not in (
        'paid',
        'cancelled'
      )
  ) then
    raise exception
      'Earlier milestones must be completed before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_milestones
    where listing_request_milestones.agreement_id =
        milestone_row.agreement_id
      and listing_request_milestones.id <>
        milestone_row.id
      and listing_request_milestones.status in (
        'submitted',
        'buyer_approved',
        'payment_required'
      )
  ) then
    raise exception
      'Another milestone must be resolved before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_timeline_holds
    where listing_request_timeline_holds.agreement_id =
        milestone_row.agreement_id
      and listing_request_timeline_holds.ended_at
        is null
  ) then
    raise exception
      'The project has an unresolved hold that must be completed before this milestone can be submitted.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.listing_request_milestone_submissions
    where listing_request_milestone_submissions.milestone_id =
        milestone_row.id
      and listing_request_milestone_submissions.status =
        'submitted'
  ) then
    raise exception
      'This milestone already has a submission awaiting buyer review.'
      using errcode = 'P0001';
  end if;

  select coalesce(
    max(
      listing_request_milestone_submissions.version_number
    ),
    0
  ) + 1
  into next_version_number
  from public.listing_request_milestone_submissions
  where listing_request_milestone_submissions.milestone_id =
    milestone_row.id;

  insert into
  public.listing_request_milestone_submissions (
    milestone_id,
    listing_request_id,
    agreement_id,
    creator_user_id,
    buyer_user_id,
    version_number,
    status,
    summary,
    delivery_links,
    preview_image_paths,
    submitted_at
  )
  values (
    milestone_row.id,
    milestone_row.listing_request_id,
    milestone_row.agreement_id,
    milestone_row.creator_user_id,
    milestone_row.buyer_user_id,
    next_version_number,
    'submitted',
    clean_summary,
    normalized_delivery_links,
    normalized_preview_image_paths,
    submitted_time
  )
  returning
    listing_request_milestone_submissions.id
  into new_submission_id;

  update public.listing_request_milestones
  set
    status = 'submitted',
    submission_version =
      next_version_number,
    latest_submitted_at =
      submitted_time
  where listing_request_milestones.id =
    milestone_row.id;

  insert into public.listing_request_timeline_holds (
    listing_request_id,
    agreement_id,
    payment_schedule_item_id,
    reason,
    started_at
  )
  values (
    milestone_row.listing_request_id,
    milestone_row.agreement_id,
    milestone_row.payment_schedule_item_id,
    'milestone_approval_pending',
    submitted_time
  )
  on conflict do nothing;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id =
    milestone_row.listing_request_id
  limit 1;

  if conversation_id is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      conversation_id,
      auth.uid(),
      'system',
      format(
        'The creator submitted milestone %s for buyer review: %s',
        milestone_row.sort_order + 1,
        milestone_row.title
      )
    );
  end if;

  return query
  select
    milestone_submission.id,
    milestone_submission.milestone_id,
    milestone_submission.listing_request_id,
    milestone_submission.agreement_id,
    milestone_submission.status,
    milestone_submission.version_number,
    milestone_submission.submitted_at
  from public.listing_request_milestone_submissions
    as milestone_submission
  where milestone_submission.id =
    new_submission_id;
end;
$$;

revoke all on function public.submit_listing_request_milestone(uuid, text, text[], text[])
  from public, anon;
grant execute on function public.submit_listing_request_milestone(uuid, text, text[], text[])
  to authenticated;