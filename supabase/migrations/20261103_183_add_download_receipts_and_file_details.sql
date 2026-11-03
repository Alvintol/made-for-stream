-- Instant downloads, part 2. Playbook: docs/support/listings/instant-downloads.md.
--
-- 1. The buyer gets a receipt by email when a download is paid, and the
--    creator gets a sale email instead of the commission one.
-- 2. Each file's measured details (an image's or video's size in pixels, a
--    video's or sound's length, what a zip holds), saved by the website when
--    the file is uploaded, are shown with the file. The purchase's snapshot
--    keeps them, as a record of what was sold.

-- As in 20261103_182, plus the two download emails.
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
  instant boolean := coalesce(new.metadata ->> 'instant', '') = 'true';
begin
  if tg_op = 'INSERT' then
    -- A buyer opens a purchase's checkout themselves, so it isn't owed.
    if new.status = 'requires_checkout' and not instant then
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

  if new.status = 'paid' and instant then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.payer_user_id, 'purchase_receipt',
      'purchase_receipt:' || new.id,
      details || jsonb_build_object(
        'amount_cents', new.total_checkout_cents,
        'item_cents', new.base_amount_cents,
        'fee_cents', new.buyer_service_fee_cents,
        'number', upper(left(new.id::text, 8)),
        'paid_at', coalesce(new.paid_at, now())
      )
    );
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'instant_sale',
      'instant_sale:' || new.id,
      details || jsonb_build_object('amount_cents', new.base_amount_cents)
    );
  elsif new.status = 'paid' then
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

-- As in 20261103_182, plus each file's measured details. The website writes
-- them as the upload's metadata; the database can't check them, so a page
-- says they were measured on upload.
create or replace function public.product_files_json(p_listing_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'path', objects.name,
    'name', substring(objects.name from '[^/]+$'),
    'size_bytes', coalesce((objects.metadata ->> 'size')::bigint, 0),
    'uploaded_at', objects.created_at,
    'details', case
      when jsonb_typeof(objects.user_metadata -> 'details') = 'object'
        then objects.user_metadata -> 'details'
    end
  )) order by objects.name), '[]'::jsonb)
  from storage.objects
  where objects.bucket_id = 'product-files'
    and public.product_file_listing_id(objects.name) = p_listing_id;
$$;

revoke all on function public.product_files_json(uuid) from public, anon, authenticated;

-- 3. As in 20261103_182, plus when the buyer ticked the final-sale box, the
-- version they agreed to, and the receipt number: with the downloads, it's
-- the evidence for a bank dispute. Buyer and admins only.
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
      'last_downloaded_at', max(download.downloaded_at),
      'final_sale', (
        select jsonb_build_object('accepted_at', acceptance.accepted_at, 'version', acceptance.policy_version)
        from public.policy_acceptances as acceptance
        where acceptance.related_listing_request_id = request.id
          and acceptance.user_id = request.buyer_user_id
          and acceptance.policy_type = 'early_service_request'
        order by acceptance.accepted_at desc
        limit 1
      )
    )
    from public.product_file_downloads as download
    where download.listing_request_id = request.id
  );
end;
$$;

revoke all on function public.get_instant_purchase_downloads(uuid) from public, anon;
grant execute on function public.get_instant_purchase_downloads(uuid) to authenticated;
