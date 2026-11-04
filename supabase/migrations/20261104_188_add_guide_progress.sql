-- The guide (2026-11-04): a welcome window on first sign-in, and creator and
-- buyer guides whose steps tick themselves off from what the account has done.
--
-- 1. user_site_update_preferences.guide_welcome_seen_at: when this person
--    closed the welcome window, so it shows once on whichever device they use.
--    The table already holds the "what's new" window's per-person state, with
--    policies that let people read and write only their own row.
-- 2. my_guide_progress(): yes or no for each guide step that a real action
--    completes. Only for the person asking. Profile, application and payout
--    steps come from what the website already reads.

alter table public.user_site_update_preferences
  add column if not exists guide_welcome_seen_at timestamptz null;

comment on column public.user_site_update_preferences.guide_welcome_seen_at is
  'When this person closed the guide''s welcome window. Null means it has not been shown yet.';

create or replace function public.my_guide_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in to see your guide progress.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'listing_published', exists (
      select 1 from public.listings
      where user_id = me and status = 'published' and is_active
    ),
    'request_received', exists (
      select 1 from public.listing_requests
      where creator_user_id = me and fulfilment_mode = 'request'
    ),
    'commission_delivered', exists (
      select 1 from public.listing_requests
      where creator_user_id = me and fulfilment_mode = 'request' and status = 'completed'
    ),
    'download_sold', exists (
      select 1
      from public.listing_request_payments as payment
      inner join public.listing_requests as request on request.id = payment.listing_request_id
      where payment.creator_user_id = me
        and request.fulfilment_mode = 'instant'
        and payment.paid_at is not null
    ),
    'sale_made', exists (
      select 1 from public.listing_request_payments
      where creator_user_id = me and paid_at is not null
    ),
    'request_sent', exists (
      select 1 from public.listing_requests
      where buyer_user_id = me and fulfilment_mode = 'request'
    ),
    'payment_made', exists (
      select 1 from public.listing_request_payments
      where payer_user_id = me and paid_at is not null
    ),
    'commission_received', exists (
      select 1 from public.listing_requests
      where buyer_user_id = me and fulfilment_mode = 'request' and status = 'completed'
    ),
    'download_bought', exists (
      select 1
      from public.listing_request_payments as payment
      inner join public.listing_requests as request on request.id = payment.listing_request_id
      where payment.payer_user_id = me
        and request.fulfilment_mode = 'instant'
        and payment.paid_at is not null
    )
  );
end;
$$;

revoke all on function public.my_guide_progress() from public, anon;
grant execute on function public.my_guide_progress() to authenticated;
