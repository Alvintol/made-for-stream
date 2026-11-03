-- Instant downloads: a ready-made digital listing that anyone can buy and
-- download straight away, sold as many times as people buy it.
-- Playbook: docs/support/listings/instant-downloads.md.
--
-- A purchase is a listing request with fulfilment_mode 'instant', made by
-- start_instant_purchase() with one payment. That keeps payments, refunds,
-- invoices, sales and tax on the paths commissions already use. It has no
-- conversation, sends no commission emails, and completes itself when paid.
--
-- Owner's decisions (2026-11-02): Made for Stream absorbs the GST/HST on the
-- whole price, at the buyer's rate; a sale is final once a file is
-- downloaded, except for a faulty file or one that isn't as described.

-- 1. What a purchase is, and the licence a listing sells.

alter table public.listing_requests
  add column if not exists fulfilment_mode text not null default 'request';

alter table public.listing_requests
  drop constraint if exists listing_requests_fulfilment_mode_check;

alter table public.listing_requests
  add constraint listing_requests_fulfilment_mode_check
  check (fulfilment_mode in ('request', 'instant'));

create index if not exists listing_requests_instant_buyer_idx
  on public.listing_requests (buyer_user_id, listing_id)
  where fulfilment_mode = 'instant';

alter table public.listings
  add column if not exists instant_licence text null;

alter table public.listings
  drop constraint if exists listings_instant_licence_check;

alter table public.listings
  add constraint listings_instant_licence_check
  check (instant_licence is null or instant_licence in ('personal', 'stream', 'commercial'));

-- A buyer can only ask for a commission. Purchases come from
-- start_instant_purchase().
drop policy if exists "listing requests buyer insert" on public.listing_requests;
create policy "listing requests buyer insert" on public.listing_requests
  for insert to authenticated
  with check (
    auth.uid() = buyer_user_id
    and buyer_user_id <> creator_user_id
    and fulfilment_mode = 'request'
    and not public.creator_has_outstanding_recovery_balance(creator_user_id)
    and exists (
      select 1
      from public.listings
      where listings.id = listing_requests.listing_id
        and listings.user_id = listing_requests.creator_user_id
        and listings.status = 'published'
        and listings.is_active = true
        and listings.fulfilment_mode = 'request'
        and listings.admin_hidden_at is null
    )
  );

-- A commission can never become a purchase, or the other way round: that
-- would let it complete on its first payment.
create or replace function public.keep_listing_request_fulfilment_mode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fulfilment_mode is distinct from old.fulfilment_mode then
    raise exception 'A request''s kind cannot be changed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_keep_fulfilment_mode on public.listing_requests;
create trigger listing_requests_keep_fulfilment_mode
  before update on public.listing_requests
  for each row
  execute function public.keep_listing_request_fulfilment_mode();

-- 2. The files. A private bucket, one folder per listing, the same file
-- types as commission deliveries, up to 10 files of 2 GB each.

insert into storage.buckets (id, name, public, file_size_limit)
values ('product-files', 'product-files', false, 2147483648)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

create or replace function public.product_file_listing_id(p_path text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_path, '/', 1)::uuid
  end;
$$;

create or replace function public.product_file_count(p_listing_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from storage.objects
  where objects.bucket_id = 'product-files'
    and public.product_file_listing_id(objects.name) = p_listing_id;
$$;

-- Paid and not refunded in full. A partial refund keeps the files.
create or replace function public.has_paid_instant_purchase(p_user_id uuid, p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listing_requests as request
    inner join public.listing_request_payments as payment
      on payment.listing_request_id = request.id
    where request.buyer_user_id = p_user_id
      and request.listing_id = p_listing_id
      and request.fulfilment_mode = 'instant'
      and payment.status in ('paid', 'partially_refunded')
  );
$$;

create or replace function public.can_download_product_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.listings
      where listings.id = public.product_file_listing_id(p_path)
        and (
          listings.user_id = auth.uid()
          or public.is_admin_user(auth.uid())
          or public.has_paid_instant_purchase(auth.uid(), listings.id)
        )
    );
$$;

grant execute on function public.product_file_listing_id(text) to authenticated;
grant execute on function public.can_download_product_file(text) to authenticated;
revoke all on function public.product_file_count(uuid) from public, anon;
grant execute on function public.product_file_count(uuid) to authenticated;
revoke all on function public.has_paid_instant_purchase(uuid, uuid) from public, anon, authenticated;

drop policy if exists "product files creator upload" on storage.objects;
create policy "product files creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and public.is_allowed_delivery_file_name(objects.name)
    and array_length(storage.foldername(objects.name), 1) = 1
    and public.product_file_count(public.product_file_listing_id(objects.name)) < 10
    and exists (
      select 1
      from public.listings
      where listings.id = public.product_file_listing_id(objects.name)
        and listings.user_id = auth.uid()
        and listings.offering_type = 'digital'
        and listings.fulfilment_mode = 'instant'
    )
  );

drop policy if exists "product files read" on storage.objects;
create policy "product files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-files'
    and public.can_download_product_file(objects.name)
  );

drop policy if exists "product files creator delete" on storage.objects;
create policy "product files creator delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-files'
    and exists (
      select 1
      from public.listings
      where listings.id = public.product_file_listing_id(objects.name)
        and listings.user_id = auth.uid()
    )
  );

-- Each download by a buyer, so a refund decision can see whether the files
-- were downloaded. Read only through the functions below.
create table if not exists public.product_file_downloads (
  id uuid primary key default gen_random_uuid(),
  listing_request_id uuid not null references public.listing_requests (id) on delete cascade,
  path text not null,
  user_id uuid not null,
  bytes bigint not null default 0,
  downloaded_at timestamptz not null default now()
);

create index if not exists product_file_downloads_request_idx
  on public.product_file_downloads (listing_request_id, downloaded_at);

alter table public.product_file_downloads enable row level security;
revoke all on table public.product_file_downloads from anon, authenticated;

create or replace function public.record_product_file_download(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_download_product_file(p_path) then
    raise exception 'This file isn''t available to you.'
      using errcode = '42501';
  end if;

  -- Only a buyer's downloads are recorded. The creator and admins can open
  -- the files too, for checking.
  insert into public.product_file_downloads (listing_request_id, path, user_id, bytes)
  select
    request.id,
    p_path,
    auth.uid(),
    coalesce((
      select (objects.metadata ->> 'size')::bigint
      from storage.objects
      where objects.bucket_id = 'product-files'
        and objects.name = p_path
    ), 0)
  from public.listing_requests as request
  inner join public.listing_request_payments as payment
    on payment.listing_request_id = request.id
  where request.buyer_user_id = auth.uid()
    and request.listing_id = public.product_file_listing_id(p_path)
    and request.fulfilment_mode = 'instant'
    and payment.status in ('paid', 'partially_refunded')
  order by payment.paid_at desc
  limit 1;
end;
$$;

revoke all on function public.record_product_file_download(text) from public, anon;
grant execute on function public.record_product_file_download(text) to authenticated;

create or replace function public.product_files_json(p_listing_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'path', objects.name,
    'name', substring(objects.name from '[^/]+$'),
    'size_bytes', coalesce((objects.metadata ->> 'size')::bigint, 0),
    'uploaded_at', objects.created_at
  ) order by objects.name), '[]'::jsonb)
  from storage.objects
  where objects.bucket_id = 'product-files'
    and public.product_file_listing_id(objects.name) = p_listing_id;
$$;

revoke all on function public.product_files_json(uuid) from public, anon, authenticated;

-- 3. What the listing page needs: what's included, and whether the viewer
-- already owns it or has a payment waiting. File names and sizes are public
-- for a live listing, so a buyer can see what they get.
create or replace function public.get_instant_listing(p_listing_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  listing public.listings%rowtype;
  viewer uuid := auth.uid();
  pending_payment uuid;
begin
  select * into listing
  from public.listings
  where listings.id = p_listing_id
    and listings.fulfilment_mode = 'instant';

  if not found
    or not (
      (listing.status = 'published' and listing.is_active and listing.admin_hidden_at is null)
      or listing.user_id = viewer
      or (viewer is not null and public.is_admin_user(viewer))
    )
  then
    raise exception 'That listing could not be found.'
      using errcode = 'P0002';
  end if;

  if viewer is not null then
    select payment.id into pending_payment
    from public.listing_requests as request
    inner join public.listing_request_payments as payment
      on payment.listing_request_id = request.id
    where request.buyer_user_id = viewer
      and request.listing_id = p_listing_id
      and request.fulfilment_mode = 'instant'
      and request.status = 'accepted'
      and payment.status in ('requires_checkout', 'checkout_opened', 'failed', 'cancelled', 'processing')
    order by payment.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'files', (
      select coalesce(jsonb_agg(file.value - 'path'), '[]'::jsonb)
      from jsonb_array_elements(public.product_files_json(p_listing_id)) as file(value)
    ),
    'owned', viewer is not null and public.has_paid_instant_purchase(viewer, p_listing_id),
    'pending_payment_id', pending_payment
  );
end;
$$;

revoke all on function public.get_instant_listing(uuid) from public;
grant execute on function public.get_instant_listing(uuid) to anon, authenticated;

-- The creator's own files, with their paths, for the edit page.
create or replace function public.my_product_files(p_listing_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.listings
    where listings.id = p_listing_id
      and (listings.user_id = auth.uid() or public.is_admin_user(auth.uid()))
  ) then
    raise exception 'That listing could not be found.'
      using errcode = 'P0002';
  end if;

  return public.product_files_json(p_listing_id);
end;
$$;

revoke all on function public.my_product_files(uuid) from public, anon;
grant execute on function public.my_product_files(uuid) to authenticated;

-- 4. Buying. Everything is checked here, then one payment is made for the
-- listing's price. A second try reuses the payment that's waiting.

create or replace function public.start_instant_purchase(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  minimum_price_cents constant integer := 1000;
  viewer uuid := auth.uid();
  listing public.listings%rowtype;
  rates record;
  base_cents integer;
  buyer_fee_cents integer;
  creator_fee_cents integer;
  recovery_cents integer;
  waiting record;
  request_id uuid;
  payment_id uuid;
begin
  if viewer is null then
    raise exception 'Sign in to buy this.'
      using errcode = '42501';
  end if;

  -- One purchase at a time for each buyer and listing, so two clicks can't
  -- make two payments.
  perform pg_advisory_xact_lock(hashtextextended(viewer::text || ':' || p_listing_id::text, 0));

  select * into listing
  from public.listings
  where listings.id = p_listing_id;

  if not found
    or listing.status <> 'published'
    or not listing.is_active
    or listing.admin_hidden_at is not null
    or listing.fulfilment_mode <> 'instant'
    or listing.offering_type <> 'digital'
    or listing.is_free
  then
    raise exception 'This item isn''t for sale right now.'
      using errcode = 'P0001';
  end if;

  if listing.user_id = viewer then
    raise exception 'You can''t buy your own listing.'
      using errcode = 'P0001';
  end if;

  if listing.price_type <> 'fixed'
    or listing.instant_licence is null
    or public.product_file_count(listing.id) = 0
  then
    raise exception 'This item isn''t ready to buy yet. The creator still needs to finish setting it up.'
      using errcode = 'P0001';
  end if;

  base_cents := listing.price_min * 100;

  if base_cents < minimum_price_cents then
    raise exception 'This item isn''t ready to buy yet. The creator still needs to finish setting it up.'
      using errcode = 'P0001';
  end if;

  if public.has_paid_instant_purchase(viewer, listing.id) then
    raise exception 'You already own this. You''ll find it under Downloads.'
      using errcode = 'P0001';
  end if;

  if public.creator_has_outstanding_recovery_balance(listing.user_id) then
    raise exception 'This creator cannot take new paid work right now. Please try again later.'
      using errcode = 'P0001';
  end if;

  perform public.assert_creator_ready_for_paid_work(listing.user_id, 'buyer');

  select * into rates
  from public.resolve_listing_request_fee_rates(viewer, listing.user_id);

  buyer_fee_cents := ceil((base_cents::numeric * rates.buyer_service_fee_bps) / 10000)::integer;
  creator_fee_cents := ceil((base_cents::numeric * rates.creator_platform_fee_bps) / 10000)::integer;
  recovery_cents := public.resolve_listing_request_payment_recovery_instalment(listing.user_id, base_cents);

  select request.id as request_id, payment.id as payment_id, payment.status, payment.base_amount_cents
  into waiting
  from public.listing_requests as request
  inner join public.listing_request_payments as payment
    on payment.listing_request_id = request.id
  where request.buyer_user_id = viewer
    and request.listing_id = listing.id
    and request.fulfilment_mode = 'instant'
    and request.status = 'accepted'
    and payment.status in ('requires_checkout', 'checkout_opened', 'failed', 'cancelled', 'processing')
  order by payment.created_at desc
  limit 1
  for update of payment;

  if found then
    if waiting.status = 'processing' then
      raise exception 'Your payment for this is still going through. Check Downloads in a few minutes.'
        using errcode = 'P0001';
    end if;

    -- The price changed since the last try: start the checkout again at the
    -- new price.
    if waiting.base_amount_cents <> base_cents then
      update public.listing_request_payments
      set
        status = 'requires_checkout',
        stripe_checkout_session_id = null,
        base_amount_cents = base_cents,
        buyer_service_fee_cents = buyer_fee_cents,
        creator_platform_fee_cents = creator_fee_cents,
        recovery_instalment_cents = recovery_cents,
        buyer_service_fee_bps = rates.buyer_service_fee_bps,
        creator_platform_fee_bps = rates.creator_platform_fee_bps,
        buyer_service_fee_reason = rates.buyer_service_fee_reason,
        creator_platform_fee_reason = rates.creator_platform_fee_reason,
        creator_tip_cents = 0,
        platform_support_cents = 0,
        tax_on_base_cents = 0,
        tax_on_buyer_fee_cents = 0,
        tax_on_tip_cents = 0,
        tax_on_support_cents = 0,
        tax_cents = 0,
        tax_treatment = null,
        tax_jurisdiction_country = null,
        tax_jurisdiction_region = null,
        stripe_tax_calculation_id = null,
        tax_calculated_at = null,
        application_fee_cents = buyer_fee_cents + creator_fee_cents + recovery_cents,
        total_checkout_cents = base_cents + buyer_fee_cents,
        updated_at = now()
      where id = waiting.payment_id;
    end if;

    return jsonb_build_object(
      'listing_request_id', waiting.request_id,
      'payment_id', waiting.payment_id
    );
  end if;

  insert into public.listing_requests (
    listing_id,
    buyer_user_id,
    creator_user_id,
    status,
    message,
    listing_snapshot,
    request_title,
    fulfilment_mode
  )
  values (
    listing.id,
    viewer,
    listing.user_id,
    'accepted',
    'Instant purchase of a ready-made digital item.',
    jsonb_build_object(
      'listing_id', listing.id,
      'title', listing.title,
      'short', listing.short,
      'offering_type', listing.offering_type,
      'fulfilment_mode', listing.fulfilment_mode,
      'category', listing.category,
      'video_subtype', listing.video_subtype,
      'price_type', listing.price_type,
      'price_min', listing.price_min,
      'price_max', listing.price_max,
      'currency', listing.currency,
      'deliverables', listing.deliverables,
      'tags', listing.tags,
      'preview_url', listing.preview_url,
      'status', listing.status,
      'is_active', listing.is_active,
      'updated_at', listing.updated_at,
      'instant_licence', listing.instant_licence,
      'files', public.product_files_json(listing.id)
    ),
    case when char_length(btrim(listing.title)) >= 3 then left(btrim(listing.title), 120) end,
    'instant'
  )
  returning id into request_id;

  insert into public.listing_request_payments (
    listing_request_id,
    payment_type,
    status,
    currency,
    base_amount_cents,
    buyer_service_fee_cents,
    creator_platform_fee_cents,
    recovery_instalment_cents,
    application_fee_cents,
    total_checkout_cents,
    buyer_service_fee_bps,
    creator_platform_fee_bps,
    buyer_service_fee_reason,
    creator_platform_fee_reason,
    payer_user_id,
    creator_user_id,
    metadata
  )
  values (
    request_id,
    'one_time',
    'requires_checkout',
    lower(listing.currency),
    base_cents,
    buyer_fee_cents,
    creator_fee_cents,
    recovery_cents,
    buyer_fee_cents + creator_fee_cents + recovery_cents,
    base_cents + buyer_fee_cents,
    rates.buyer_service_fee_bps,
    rates.creator_platform_fee_bps,
    rates.buyer_service_fee_reason,
    rates.creator_platform_fee_reason,
    viewer,
    listing.user_id,
    jsonb_build_object(
      'payment_title', listing.title,
      'instant', true,
      'listing_id', listing.id,
      'instant_licence', listing.instant_licence
    )
  )
  returning id into payment_id;

  return jsonb_build_object('listing_request_id', request_id, 'payment_id', payment_id);
end;
$$;

revoke all on function public.start_instant_purchase(uuid) from public, anon;
grant execute on function public.start_instant_purchase(uuid) to authenticated;

-- 5. A paid purchase completes itself. If that fails the payment still
-- stands and the files still open, because access follows the payment.

create or replace function public.complete_instant_purchase_when_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listing_requests
  set
    status = 'completed',
    completed_at = new.paid_at,
    completed_by_user_id = new.payer_user_id
  where id = new.listing_request_id
    and fulfilment_mode = 'instant'
    and status = 'accepted';

  return new;
exception
  when others then
    raise warning 'DL-001: instant purchase % could not be marked complete: %',
      new.listing_request_id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists listing_request_payments_complete_instant on public.listing_request_payments;
create trigger listing_request_payments_complete_instant
  after update of paid_at on public.listing_request_payments
  for each row
  when (old.paid_at is null and new.paid_at is not null)
  execute function public.complete_instant_purchase_when_paid();

-- As in 20260611_093, plus an instant purchase, which completes once paid.
create or replace function public.protect_listing_request_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'completed' then
    if new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at
      or new.completed_by_user_id
        is distinct from old.completed_by_user_id then
      raise exception
        'A completed listing request cannot be reopened or have its completion metadata changed.'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  if new.status = 'completed' then
    if old.status <> 'accepted' then
      raise exception
        'Only an accepted listing request can be completed.'
        using errcode = 'P0001';
    end if;

    if new.fulfilment_mode = 'instant' then
      if not exists (
        select 1
        from public.listing_request_payments
        where listing_request_payments.listing_request_id = new.id
          and listing_request_payments.paid_at is not null
      ) then
        raise exception
          'An instant purchase completes only once it is paid.'
          using errcode = 'P0001';
      end if;

      new.completed_at := coalesce(new.completed_at, now());
      new.completed_by_user_id := coalesce(new.completed_by_user_id, new.buyer_user_id);

      return new;
    end if;

    if auth.uid() is null
      or auth.uid() <> new.buyer_user_id then
      raise exception
        'Only the buyer can complete this listing request through final-delivery approval.'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.listing_request_final_deliveries
      where listing_request_final_deliveries.listing_request_id =
          new.id
        and listing_request_final_deliveries.agreement_id
          is not null
        and listing_request_final_deliveries.buyer_user_id =
          new.buyer_user_id
        and listing_request_final_deliveries.status =
          'buyer_approved'
        and listing_request_final_deliveries.buyer_approved_at
          is not null
    ) then
      raise exception
        'An approved final delivery is required before completing this listing request.'
        using errcode = 'P0001';
    end if;

    new.completed_at :=
      coalesce(new.completed_at, now());

    new.completed_by_user_id :=
      coalesce(
        new.completed_by_user_id,
        auth.uid()
      );

    return new;
  end if;

  new.completed_at := null;
  new.completed_by_user_id := null;

  return new;
end;
$$;

-- 6. No conversation and no commission emails for a purchase. The creator
-- still hears that a payment arrived.

create or replace function public.create_conversation_for_listing_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  conversation_subject text;
begin
  if new.fulfilment_mode = 'instant' then
    return new;
  end if;

  conversation_subject := left(
    coalesce(
      nullif(btrim(new.request_title), ''),
      nullif(new.listing_snapshot ->> 'title', ''),
      'Listing request'
    ),
    120
  );

  insert into public.conversations (
    conversation_type,
    buyer_user_id,
    creator_user_id,
    created_by_user_id,
    listing_id,
    listing_request_id,
    subject
  )
  values (
    'listing_request',
    new.buyer_user_id,
    new.creator_user_id,
    new.buyer_user_id,
    new.listing_id,
    new.id,
    conversation_subject
  )
  returning id into conversation_id;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role
  )
  values
    (conversation_id, new.buyer_user_id, 'buyer'),
    (conversation_id, new.creator_user_id, 'creator');

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    new.buyer_user_id,
    'conversation_created',
    jsonb_build_object(
      'conversation_type', 'listing_request',
      'listing_request_id', new.id,
      'listing_id', new.listing_id,
      'request_title', new.request_title
    )
  );

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    new.buyer_user_id,
    'request_linked',
    jsonb_build_object(
      'listing_request_id', new.id,
      'request_title', new.request_title
    )
  );

  return new;
end;
$$;

create or replace function public.notify_listing_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  party uuid;
begin
  if new.fulfilment_mode = 'instant' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'submitted' then
      perform public.enqueue_listing_request_notification(
        new.id, new.creator_user_id, 'request_received',
        'request_received:' || new.id
      );
    end if;

    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'accepted' then
    perform public.enqueue_listing_request_notification(
      new.id, new.buyer_user_id, 'request_accepted',
      'request_accepted:' || new.id
    );
  elsif new.status = 'declined' then
    perform public.enqueue_listing_request_notification(
      new.id, new.buyer_user_id, 'request_declined',
      'request_declined:' || new.id,
      jsonb_build_object('reason', new.creator_status_reason)
    );
  elsif new.status = 'archived' and old.status = 'submitted' then
    -- Tell whoever did not archive it that it is no longer waiting.
    foreach party in array array[new.buyer_user_id, new.creator_user_id] loop
      if party is distinct from new.archived_by_user_id then
        perform public.enqueue_listing_request_notification(
          new.id, party, 'request_withdrawn',
          'request_withdrawn:' || new.id || ':' || party
        );
      end if;
    end loop;
  elsif new.status = 'cancelled' then
    -- Everyone except whoever cancelled. An administrative closure is
    -- cancelled by an admin, so both parties are told.
    foreach party in array array[new.buyer_user_id, new.creator_user_id] loop
      if party is distinct from new.cancelled_by_user_id then
        perform public.enqueue_listing_request_notification(
          new.id, party, 'request_cancelled',
          'request_cancelled:' || new.id || ':' || party,
          jsonb_build_object('reason', new.cancellation_reason)
        );
      end if;
    end loop;
  elsif new.status = 'completed' then
    foreach party in array array[new.buyer_user_id, new.creator_user_id] loop
      perform public.enqueue_listing_request_notification(
        new.id, party, 'request_completed',
        'request_completed:' || new.id || ':' || party
      );
    end loop;
  end if;

  return new;
end;
$$;

create or replace function public.notify_listing_request_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  details jsonb := jsonb_build_object(
    'title', new.metadata ->> 'payment_title',
    'currency', new.currency
  );
begin
  if tg_op = 'INSERT' then
    -- A buyer opens a purchase's checkout themselves, so it isn't owed.
    if new.status = 'requires_checkout'
      and coalesce(new.metadata ->> 'instant', '') <> 'true'
    then
      perform public.enqueue_listing_request_notification(
        new.listing_request_id, new.payer_user_id, 'payment_required',
        'payment_required:' || new.id,
        details || jsonb_build_object('amount_cents', new.total_checkout_cents)
      );
    end if;

    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'paid' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'payment_received',
      'payment_received:' || new.id,
      details || jsonb_build_object('amount_cents', new.base_amount_cents)
    );
  elsif new.status in ('refunded', 'partially_refunded') then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.payer_user_id, 'payment_refunded',
      'payment_refunded:' || new.id || ':' || new.status || ':buyer', details
    );
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'payment_refunded',
      'payment_refunded:' || new.id || ':' || new.status || ':creator', details
    );
  elsif new.status = 'disputed' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'payment_disputed',
      'payment_disputed:' || new.id, details
    );
  end if;

  return new;
end;
$$;

-- 7. The buyer's downloads, and one purchase for its buyer or an admin, with
-- whether and when the files were downloaded. Creators aren't told.

create or replace function public.my_downloads()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your downloads.'
      using errcode = '42501';
  end if;

  -- ponytail: every purchase at once, capped at 200. Page it when a buyer
  -- owns more than that.
  return (
    select coalesce(jsonb_agg(item order by item ->> 'paid_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'listing_request_id', request.id,
        'listing_id', request.listing_id,
        'payment_id', payment.id,
        'title', coalesce(listing.title, request.listing_snapshot ->> 'title'),
        'licence', coalesce(listing.instant_licence, request.listing_snapshot ->> 'instant_licence'),
        'paid_at', payment.paid_at,
        'files', public.product_files_json(request.listing_id),
        'downloaded', exists (
          select 1 from public.product_file_downloads as download
          where download.listing_request_id = request.id
        )
      ) as item
      from public.listing_requests as request
      inner join public.listing_request_payments as payment
        on payment.listing_request_id = request.id
      left join public.listings as listing
        on listing.id = request.listing_id
      where request.buyer_user_id = auth.uid()
        and request.fulfilment_mode = 'instant'
        and payment.status in ('paid', 'partially_refunded')
      order by payment.paid_at desc
      limit 200
    ) as purchases
  );
end;
$$;

revoke all on function public.my_downloads() from public, anon;
grant execute on function public.my_downloads() to authenticated;

create or replace function public.get_instant_purchase_downloads(p_listing_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  request public.listing_requests%rowtype;
begin
  select * into request
  from public.listing_requests
  where id = p_listing_request_id
    and fulfilment_mode = 'instant';

  if not found
    or auth.uid() is null
    or not (
      auth.uid() = request.buyer_user_id
      or public.is_admin_user(auth.uid())
    )
  then
    raise exception 'That purchase could not be found.'
      using errcode = 'P0002';
  end if;

  return (
    select jsonb_build_object(
      'downloads', count(*),
      'first_downloaded_at', min(download.downloaded_at),
      'last_downloaded_at', max(download.downloaded_at)
    )
    from public.product_file_downloads as download
    where download.listing_request_id = request.id
  );
end;
$$;

revoke all on function public.get_instant_purchase_downloads(uuid) from public, anon;
grant execute on function public.get_instant_purchase_downloads(uuid) to authenticated;

-- 8. Tax. On a download Made for Stream absorbs the GST/HST on the whole
-- price, at the buyer's rate, so there is no separate creator-side tax.
-- As in 20261102_180, plus the instant column.

drop function if exists public.sale_movements(timestamptz, timestamptz, uuid);

create function public.sale_movements(
  p_from timestamptz,
  p_to timestamptz,
  p_creator uuid default null
)
returns table (
  movement_id uuid,
  payment_id uuid,
  kind text,
  happened_at timestamptz,
  creator_user_id uuid,
  currency text,
  sold_cents bigint,
  buyer_fee_cents bigint,
  creator_fee_cents bigint,
  support_cents bigint,
  buyer_tax_place text,
  buyer_tax_bps integer,
  buyer_tax_cents bigint,
  creator_tax_place text,
  creator_tax_bps integer,
  creator_tax_cents bigint,
  instant boolean
)
language plpgsql
stable
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
begin
  return query
  select
    payment.id,
    payment.id,
    'sale'::text,
    payment.paid_at,
    payment.creator_user_id,
    payment.currency,
    (payment.base_amount_cents + payment.creator_tip_cents)::bigint,
    payment.buyer_service_fee_cents::bigint,
    payment.creator_platform_fee_cents::bigint,
    payment.platform_support_cents::bigint,
    coalesce(details.buyer_tax_place, '?'),
    coalesce(details.buyer_tax_bps, 500),
    public.included_tax_cents(
      (
        payment.buyer_service_fee_cents + payment.platform_support_cents
        + case when request.fulfilment_mode = 'instant'
            then payment.base_amount_cents + payment.creator_tip_cents
            else 0
          end
      )::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) + payment.tax_cents,
    coalesce(details.creator_tax_place, '?'),
    coalesce(details.creator_tax_bps, 500),
    case
      when request.fulfilment_mode = 'instant' then 0::bigint
      else public.included_tax_cents(
        payment.creator_platform_fee_cents::bigint,
        coalesce(details.creator_tax_bps, 500)
      )
    end,
    request.fulfilment_mode = 'instant'
  from public.listing_request_payments as payment
  inner join public.listing_requests as request
    on request.id = payment.listing_request_id
  left join public.paid_payment_details as details
    on details.payment_id = payment.id
  where payment.paid_at >= p_from
    and payment.paid_at < p_to
    and (p_creator is null or payment.creator_user_id = p_creator)

  union all

  select
    refund.id,
    payment.id,
    'refund'::text,
    refund.created_at,
    payment.creator_user_id,
    refund.currency,
    -(refund.base_refund_cents + refund.tip_refund_cents)::bigint,
    -refund.buyer_fee_refund_cents::bigint,
    -refund.creator_fee_reversal_cents::bigint,
    -refund.contribution_refund_cents::bigint,
    coalesce(details.buyer_tax_place, '?'),
    coalesce(details.buyer_tax_bps, 500),
    public.included_tax_cents(
      -(
        refund.buyer_fee_refund_cents + refund.contribution_refund_cents
        + case when request.fulfilment_mode = 'instant'
            then refund.base_refund_cents + refund.tip_refund_cents
            else 0
          end
      )::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) - refund.tax_refund_cents,
    coalesce(details.creator_tax_place, '?'),
    coalesce(details.creator_tax_bps, 500),
    case
      when request.fulfilment_mode = 'instant' then 0::bigint
      else public.included_tax_cents(
        -refund.creator_fee_reversal_cents::bigint,
        coalesce(details.creator_tax_bps, 500)
      )
    end,
    request.fulfilment_mode = 'instant'
  from public.listing_request_payment_refunds as refund
  inner join public.listing_request_payments as payment
    on payment.id = refund.payment_id
  inner join public.listing_requests as request
    on request.id = payment.listing_request_id
  left join public.paid_payment_details as details
    on details.payment_id = payment.id
  where refund.created_at >= p_from
    and refund.created_at < p_to
    and (p_creator is null or payment.creator_user_id = p_creator);
end;
$$;

revoke all on function public.sale_movements(timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- As in 20261103_181. On a download the taxable amount is the whole price,
-- and the creator side has nothing to add.
create or replace function public.admin_sales_summary(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see sales.'
      using errcode = '42501';
  end if;

  return (
    with movements as materialized (
      select *
      from public.sale_movements(
        public.sales_month_start(p_month),
        public.sales_month_end(p_month)
      )
    )
    select jsonb_build_object(
      'totals', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'currency', totals.currency,
          'sales', totals.sales,
          'sold_cents', totals.sold_total_cents,
          'transactions', totals.transactions,
          'paid_cents', totals.paid_total_cents,
          'refunded_cents', totals.refunded_total_cents,
          'kept_cents', totals.kept_cents,
          'tax_cents', totals.tax_cents,
          'earned_cents', totals.kept_cents - totals.tax_cents
        ) order by totals.currency), '[]'::jsonb)
        from public.sales_by_period(
          public.sales_month_start(p_month),
          public.sales_month_end(p_month),
          'month'
        ) as totals
      ),
      'tax', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'place', tax.place,
          'bps', tax.bps,
          'currency', tax.currency,
          'fees_cents', tax.fees_cents,
          'tax_cents', tax.tax_cents
        ) order by tax.currency, tax.tax_cents desc, tax.place), '[]'::jsonb)
        from (
          select
            sides.place,
            sides.bps,
            sides.currency,
            sum(sides.fees_cents) as fees_cents,
            sum(sides.tax_cents) as tax_cents
          from (
            select
              movement.buyer_tax_place as place,
              movement.buyer_tax_bps as bps,
              movement.currency,
              movement.buyer_fee_cents + movement.support_cents
                + case when movement.instant then movement.sold_cents else 0 end as fees_cents,
              movement.buyer_tax_cents as tax_cents
            from movements as movement

            union all

            select
              movement.creator_tax_place,
              movement.creator_tax_bps,
              movement.currency,
              movement.creator_fee_cents,
              movement.creator_tax_cents
            from movements as movement
            where not movement.instant
          ) as sides
          group by sides.place, sides.bps, sides.currency
        ) as tax
      )
    )
  );
end;
$$;

revoke all on function public.admin_sales_summary(date) from public, anon;
grant execute on function public.admin_sales_summary(date) to authenticated;

-- As in 20261102_180, plus whether it's a download. A download's tax is on
-- the whole price at the buyer's rate, and there's no creator-side tax.
create or replace function public.get_payment_invoice(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  payment public.listing_request_payments%rowtype;
  details public.paid_payment_details%rowtype;
  invoice_title text;
  instant boolean;
  is_buyer boolean;
  is_creator boolean;
  is_admin boolean;
begin
  if viewer is null then
    raise exception 'Sign in to see this invoice.'
      using errcode = '42501';
  end if;

  select * into payment
  from public.listing_request_payments
  where id = p_payment_id
    and paid_at is not null;

  is_buyer := found and payment.payer_user_id = viewer;
  is_creator := found and payment.creator_user_id = viewer;
  is_admin := found and public.is_admin_user(viewer);

  if not (is_buyer or is_creator or is_admin) then
    raise exception 'That invoice could not be found.'
      using errcode = 'P0002';
  end if;

  select * into details
  from public.paid_payment_details
  where payment_id = payment.id;

  select
    coalesce(request.request_title, request.listing_snapshot ->> 'title'),
    request.fulfilment_mode = 'instant'
  into invoice_title, instant
  from public.listing_requests as request
  where request.id = payment.listing_request_id;

  return jsonb_build_object(
    'id', payment.id,
    'number', upper(left(payment.id::text, 8)),
    'paid_at', payment.paid_at,
    'title', invoice_title,
    'instant', instant,
    'currency', payment.currency,
    'seller_name', coalesce(details.seller_name, 'Creator'),
    'seller_tax_number', details.seller_tax_number,
    'base_cents', payment.base_amount_cents,
    'tip_cents', payment.creator_tip_cents,
    'buyer_fee_cents', payment.buyer_service_fee_cents,
    'support_cents', payment.platform_support_cents,
    'added_tax_cents', payment.tax_cents,
    'total_cents', payment.total_checkout_cents,
    'refunded_cents', (
      select coalesce(sum(
        refund.base_refund_cents + refund.buyer_fee_refund_cents
          + refund.tip_refund_cents + refund.contribution_refund_cents
      ), 0)
      from public.listing_request_payment_refunds as refund
      where refund.payment_id = payment.id
    ),
    'buyer_tax_bps', case when is_buyer or is_admin then coalesce(details.buyer_tax_bps, 500) end,
    'buyer_fee_tax_cents', case when is_buyer or is_admin then public.included_tax_cents(
      (
        payment.buyer_service_fee_cents + payment.platform_support_cents
        + case when instant then payment.base_amount_cents + payment.creator_tip_cents else 0 end
      )::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) end,
    'creator_fee_cents', case when is_creator or is_admin then payment.creator_platform_fee_cents end,
    'creator_tax_bps', case when (is_creator or is_admin) and not instant then coalesce(details.creator_tax_bps, 500) end,
    'creator_fee_tax_cents', case when (is_creator or is_admin) and not instant then public.included_tax_cents(
      payment.creator_platform_fee_cents::bigint,
      coalesce(details.creator_tax_bps, 500)
    ) end
  );
end;
$$;

-- 9. The sales lists say which rows are downloads, so a page can link to the
-- listing instead of a commission. As in 20261102_180 and 20261103_181, plus
-- listing_id and instant.

drop function if exists public.my_sales(date, timestamptz, uuid, integer);
drop function if exists public.admin_sales(date, timestamptz, uuid, integer);
drop function if exists public.my_completed_sales(date, timestamptz, uuid, integer);
drop function if exists public.admin_completed_sales(date, timestamptz, uuid, integer);

create function public.my_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  movement_id uuid,
  payment_id uuid,
  listing_request_id uuid,
  listing_id uuid,
  instant boolean,
  kind text,
  happened_at timestamptz,
  title text,
  currency text,
  sold_cents bigint,
  fee_cents bigint,
  earned_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your sales.'
      using errcode = '42501';
  end if;

  return query
  select
    movement.movement_id,
    movement.payment_id,
    request.id,
    request.listing_id,
    movement.instant,
    movement.kind,
    movement.happened_at,
    coalesce(request.request_title, request.listing_snapshot ->> 'title'),
    movement.currency,
    movement.sold_cents,
    movement.creator_fee_cents,
    movement.sold_cents - movement.creator_fee_cents
  from public.sale_movements(
    public.sales_month_start(p_month),
    public.sales_month_end(p_month),
    auth.uid()
  ) as movement
  inner join public.listing_request_payments as payment
    on payment.id = movement.payment_id
  inner join public.listing_requests as request
    on request.id = payment.listing_request_id
  where p_after_at is null
    or (movement.happened_at, movement.movement_id) < (p_after_at, p_after_id)
  order by movement.happened_at desc, movement.movement_id desc
  limit least(greatest(coalesce(p_limit, 25), 1), 51);
end;
$$;

revoke all on function public.my_sales(date, timestamptz, uuid, integer) from public, anon;
grant execute on function public.my_sales(date, timestamptz, uuid, integer) to authenticated;

create function public.admin_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  movement_id uuid,
  payment_id uuid,
  listing_request_id uuid,
  listing_id uuid,
  instant boolean,
  kind text,
  happened_at timestamptz,
  title text,
  creator_handle text,
  currency text,
  sold_cents bigint,
  kept_cents bigint,
  tax_cents bigint,
  buyer_tax_place text,
  creator_tax_place text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see sales.'
      using errcode = '42501';
  end if;

  return query
  select
    movement.movement_id,
    movement.payment_id,
    request.id,
    request.listing_id,
    movement.instant,
    movement.kind,
    movement.happened_at,
    coalesce(request.request_title, request.listing_snapshot ->> 'title'),
    profile.handle,
    movement.currency,
    movement.sold_cents + movement.buyer_fee_cents + movement.support_cents,
    movement.buyer_fee_cents + movement.creator_fee_cents + movement.support_cents,
    movement.buyer_tax_cents + movement.creator_tax_cents,
    movement.buyer_tax_place,
    movement.creator_tax_place
  from public.sale_movements(
    public.sales_month_start(p_month),
    public.sales_month_end(p_month)
  ) as movement
  inner join public.listing_request_payments as payment
    on payment.id = movement.payment_id
  inner join public.listing_requests as request
    on request.id = payment.listing_request_id
  left join public.profiles as profile
    on profile.user_id = movement.creator_user_id
  where p_after_at is null
    or (movement.happened_at, movement.movement_id) < (p_after_at, p_after_id)
  order by movement.happened_at desc, movement.movement_id desc
  limit least(greatest(coalesce(p_limit, 25), 1), 51);
end;
$$;

revoke all on function public.admin_sales(date, timestamptz, uuid, integer) from public, anon;
grant execute on function public.admin_sales(date, timestamptz, uuid, integer) to authenticated;

create function public.my_completed_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  listing_request_id uuid,
  listing_id uuid,
  instant boolean,
  completed_at timestamptz,
  title text,
  currency text,
  transactions bigint,
  sold_cents bigint,
  fee_cents bigint,
  earned_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your sales.'
      using errcode = '42501';
  end if;

  return query
  select
    sale.listing_request_id,
    request.listing_id,
    request.fulfilment_mode = 'instant',
    sale.completed_at,
    coalesce(request.request_title, request.listing_snapshot ->> 'title'),
    sale.currency,
    sale.transactions,
    sale.sold_cents,
    sale.creator_fee_cents,
    sale.sold_cents - sale.creator_fee_cents
  from public.completed_sales(
    public.sales_month_start(p_month),
    public.sales_month_end(p_month),
    auth.uid()
  ) as sale
  inner join public.listing_requests as request
    on request.id = sale.listing_request_id
  where p_after_at is null
    or (sale.completed_at, sale.listing_request_id) < (p_after_at, p_after_id)
  order by sale.completed_at desc, sale.listing_request_id desc
  limit least(greatest(coalesce(p_limit, 25), 1), 51);
end;
$$;

revoke all on function public.my_completed_sales(date, timestamptz, uuid, integer) from public, anon;
grant execute on function public.my_completed_sales(date, timestamptz, uuid, integer) to authenticated;

create function public.admin_completed_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  listing_request_id uuid,
  listing_id uuid,
  instant boolean,
  completed_at timestamptz,
  title text,
  creator_handle text,
  currency text,
  transactions bigint,
  sold_cents bigint,
  kept_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see sales.'
      using errcode = '42501';
  end if;

  return query
  select
    sale.listing_request_id,
    request.listing_id,
    request.fulfilment_mode = 'instant',
    sale.completed_at,
    coalesce(request.request_title, request.listing_snapshot ->> 'title'),
    profile.handle,
    sale.currency,
    sale.transactions,
    sale.sold_cents + sale.buyer_fee_cents + sale.support_cents,
    sale.buyer_fee_cents + sale.creator_fee_cents + sale.support_cents
  from public.completed_sales(
    public.sales_month_start(p_month),
    public.sales_month_end(p_month)
  ) as sale
  inner join public.listing_requests as request
    on request.id = sale.listing_request_id
  left join public.profiles as profile
    on profile.user_id = sale.creator_user_id
  where p_after_at is null
    or (sale.completed_at, sale.listing_request_id) < (p_after_at, p_after_id)
  order by sale.completed_at desc, sale.listing_request_id desc
  limit least(greatest(coalesce(p_limit, 25), 1), 51);
end;
$$;

revoke all on function public.admin_completed_sales(date, timestamptz, uuid, integer) from public, anon;
grant execute on function public.admin_completed_sales(date, timestamptz, uuid, integer) to authenticated;
