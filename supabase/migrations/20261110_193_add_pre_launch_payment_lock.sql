-- Before launch, nothing can be paid (decided 2026-11-10, for TwitchCon).
-- Made for Stream has no legal review yet, so visitors can browse, apply,
-- make listings, send commission requests and chat, but no money can move.
--
-- 1. public.payments_are_live(): the one switch. It returns false here.
--    At launch a migration redefines it to return true; the site, the API
--    and the rules below all read it.
-- 2. While it is false:
--    a. a paid listing can be published without a ready payout account
--       (enforce_listing_payment_account_readiness);
--    b. a buyer can send a request to a creator who has no payout account
--       (enforce_listing_request_creator_readiness);
--    c. a creator cannot accept a request (new trigger on listing_requests);
--    d. no project agreement, change order or instant purchase can start
--       (assert_creator_ready_for_paid_work, which all three call);
--    e. no checkout can open, even for a payment that was already due
--       (new trigger on listing_request_payments).
--
-- ponytail: one constant function, not a settings table. Flipping it at
-- launch is a reviewed migration, which is what that moment deserves.

create or replace function public.payments_are_live()
returns boolean
language sql
-- stable, not immutable, so redefining it at launch takes effect at once
-- instead of being folded into plans that are already cached.
stable
as $$
  select false;
$$;

grant execute on function public.payments_are_live() to anon, authenticated;

-- a. Publishing.
create or replace function public.enforce_listing_payment_account_readiness()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.payments_are_live()
    and new.status = 'published'
    and new.is_active = true
    and new.is_free = false
    and not public.has_ready_creator_payment_account(new.user_id) then
    raise exception 'Creator payout account must be ready before publishing active listings.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- b. Sending a request.
create or replace function public.enforce_listing_request_creator_readiness()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.payments_are_live()
    and new.status = 'submitted'
    and not exists (
      select 1 from public.listings
      where listings.id = new.listing_id and listings.is_free
    ) then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'buyer');
  end if;

  return new;
end;
$$;

-- c. Accepting a request.
create or replace function public.refuse_listing_request_accept_before_launch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if not public.payments_are_live() then
    raise exception 'Requests can''t be accepted yet. Made for Stream hasn''t launched in any region, and there''s no date yet for when it will.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_refuse_accept_before_launch on public.listing_requests;
create trigger listing_requests_refuse_accept_before_launch
  before update of status on public.listing_requests
  for each row
  when (new.status = 'accepted' and old.status is distinct from 'accepted')
  execute function public.refuse_listing_request_accept_before_launch();

-- d. Agreements, change orders and instant purchases.
create or replace function public.assert_creator_ready_for_paid_work(p_creator_user_id uuid, p_actor text)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.payments_are_live() then
    raise exception 'Payments aren''t open yet, so this can''t go ahead. There''s no date yet for when they will open in your region.'
      using errcode = 'P0001';
  end if;

  if public.has_ready_creator_payment_account(p_creator_user_id) then
    return;
  end if;

  if p_actor = 'creator' then
    raise exception 'Your payout account needs attention before you can send paid work. Open Settings and finish what Stripe is asking for, then try again.'
      using errcode = 'check_violation';
  end if;

  raise exception 'This creator cannot take new paid work right now because their payout account needs attention. Please try again later.'
    using errcode = 'check_violation';
end;
$$;

-- e. Opening a checkout.
create or replace function public.refuse_checkout_before_launch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if not public.payments_are_live() then
    raise exception 'Payments aren''t open yet, so this can''t go ahead. There''s no date yet for when they will open in your region.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_request_payments_refuse_before_launch on public.listing_request_payments;
create trigger listing_request_payments_refuse_before_launch
  before update of status on public.listing_request_payments
  for each row
  when (new.status = 'checkout_opened' and old.status is distinct from 'checkout_opened')
  execute function public.refuse_checkout_before_launch();

-- 3. Creator applications (decided 2026-11-10).
--    a. Each application records the applicant's own audience numbers:
--       Twitch status and followers, YouTube subscribers. Alvin checks them
--       by hand against the linked channel when reviewing; nothing here
--       trusts them beyond refusing a submission below the minimums.
--    b. Submitting needs Twitch Affiliate or Partner with at least 300
--       followers, or at least 500 YouTube subscribers, and the 18+
--       agreement. Checked by a trigger, because the update policy lets an
--       applicant set status 'submitted' without submit_seller_application.
--    c. The review queue grows from 10 to 100 open applications, for
--       TwitchCon sign-ups.

alter table public.seller_applications
  add column if not exists twitch_status text
    check (twitch_status in ('none', 'affiliate', 'partner')),
  add column if not exists twitch_follower_count integer
    check (twitch_follower_count between 0 and 100000000),
  add column if not exists youtube_subscriber_count integer
    check (youtube_subscriber_count between 0 and 1000000000);

create or replace function public.check_seller_application_submission()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Only the moment of submitting; earlier applications are left alone.
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  if not new.agreed_to_age_and_capacity then
    raise exception 'You must confirm you are at least 18 to apply.'
      using errcode = 'P0001';
  end if;

  if not (
    (new.twitch_status in ('affiliate', 'partner') and coalesce(new.twitch_follower_count, 0) >= 300)
    or coalesce(new.youtube_subscriber_count, 0) >= 500
  ) then
    raise exception 'To apply you need Twitch Affiliate or Partner with at least 300 followers, or at least 500 YouTube subscribers.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists seller_applications_check_submission on public.seller_applications;
create trigger seller_applications_check_submission
  before insert or update of status on public.seller_applications
  for each row
  when (new.status = 'submitted')
  execute function public.check_seller_application_submission();

create or replace function public.get_creator_application_queue_state()
returns table(open_count integer, max_open integer, remaining integer, has_capacity boolean)
language sql
security definer
set search_path to 'public'
as $$
  with queue_state as (
    select count(*)::integer as open_count
    from public.seller_applications
    where status in ('submitted', 'under_review')
  )
  select
    queue_state.open_count,
    100::integer as max_open,
    greatest(100::integer - queue_state.open_count, 0) as remaining,
    queue_state.open_count < 100::integer as has_capacity
  from queue_state;
$$;

create or replace function public.submit_seller_application(application_id uuid)
returns public.seller_applications
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  queue_open_count integer;
  updated_row public.seller_applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  -- Serialize submissions so two users cannot both slip in at the same time
  perform pg_advisory_xact_lock(90421001);

  select count(*)::integer
  into queue_open_count
  from public.seller_applications
  where status in ('submitted', 'under_review');

  if queue_open_count >= 100 then
    raise exception 'Creator applications are full right now. Please check again later.';
  end if;

  update public.seller_applications
  set
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
  where id = application_id
    and profile_user_id = auth.uid()
    and status in ('draft', 'needs_changes')
  returning *
  into updated_row;

  if updated_row.id is null then
    raise exception 'Application could not be submitted. Only draft or needs-changes applications can be submitted.';
  end if;

  return updated_row;
end;
$$;
