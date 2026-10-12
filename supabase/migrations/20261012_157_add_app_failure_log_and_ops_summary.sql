-- A log of things that did not go through, and a daily list of them for ops.
--
-- Asked for after the launch rehearsal (2026-10-12): failures that nobody
-- reports are invisible, and a rehearsal only finds the ones it happens to
-- walk into. The website now reports every failed action (a refused save, a
-- refused payment step) and every failed page load here, and the ops digest
-- lists each distinct failure with how many times it happened.
--
-- What this is not: it only records what the website reports. Someone who
-- calls the database or the API directly, without the website, appears in
-- Supabase's and Cloud Run's own request logs, not here.
--
-- 1. public.app_failure_events: one row per reported failure. No policies:
--    nobody reads or writes it from the website except through (2); admins
--    and ops read it in SQL.
-- 2. public.log_app_failure(): what the website calls. It trims everything,
--    caps how much one account can log per hour, never raises, and now and
--    then deletes rows older than 90 days.
-- 3. list_ops_alerts() gains OPS-006 (yesterday's failures, itemised) and
--    OPS-007 (one account failing over and over). The rest of it is copied
--    unchanged from 20260924_139.

create table if not exists public.app_failure_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- Null when the person was signed out.
  user_id uuid references auth.users (id) on delete set null,
  -- 'action': something a person tried to do. 'load': a page could not
  -- fetch something it needed.
  source text not null check (source in ('action', 'load')),
  -- The query or action name when the website knows it.
  label text,
  -- The page, with ids replaced by ":id".
  route text,
  -- The database or API error code, when there is one.
  code text,
  message text not null,
  -- The message with numbers and ids replaced, so "at least 10.00 CAD, and
  -- this one is 5.00" and "... 7.50" count as the same failure.
  signature text not null
);

create index if not exists app_failure_events_occurred_at_idx
  on public.app_failure_events (occurred_at);
create index if not exists app_failure_events_user_occurred_at_idx
  on public.app_failure_events (user_id, occurred_at);

alter table public.app_failure_events enable row level security;
revoke all on public.app_failure_events from anon, authenticated;

create or replace function public.log_app_failure(
  p_source text,
  p_message text,
  p_code text default null,
  p_route text default null,
  p_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  clean_message text := left(btrim(coalesce(p_message, '')), 500);
begin
  if clean_message = '' or p_source is null or p_source not in ('action', 'load') then
    return;
  end if;

  -- ponytail: fixed hourly caps (120 per account, 500 for everyone signed
  -- out together) so the table cannot be flooded; tune if real use hits them.
  if (
    select count(*)
    from public.app_failure_events e
    where e.occurred_at > now() - interval '1 hour'
      and e.user_id is not distinct from caller
  ) >= (case when caller is null then 500 else 120 end) then
    return;
  end if;

  insert into public.app_failure_events (
    user_id, source, label, route, code, message, signature
  )
  values (
    caller,
    p_source,
    nullif(left(btrim(coalesce(p_label, '')), 120), ''),
    nullif(left(btrim(coalesce(p_route, '')), 200), ''),
    nullif(left(btrim(coalesce(p_code, '')), 20), ''),
    clean_message,
    regexp_replace(
      regexp_replace(
        clean_message,
        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        ':id',
        'gi'
      ),
      '[0-9]+([.,][0-9]+)*',
      '#',
      'g'
    )
  );

  -- ponytail: housekeeping rides along on about one call in a hundred
  -- instead of a scheduled job; move it to a job if the table grows large.
  if random() < 0.01 then
    delete from public.app_failure_events
    where occurred_at < now() - interval '90 days';
  end if;
exception
  when others then
    -- Logging a failure must never become a second failure.
    return;
end;
$$;

revoke all on function public.log_app_failure(text, text, text, text, text) from public;
grant execute on function public.log_app_failure(text, text, text, text, text)
  to anon, authenticated;

create or replace function public.list_ops_alerts()
returns table (
  alert_id text,
  playbook_issue text,
  subject_id text,
  observed_at timestamptz,
  detail jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  -- PAY-005. Checkout sessions expire after 24 hours, so a session still
  -- open after 25 means the expiry (or payment) webhook never landed.
  -- 'processing' is a delayed payment method and is only raised after 7
  -- days. Younger stuck payments are the agent's 30-minute signal, not an
  -- email.
  select
    'stuck_payment'::text,
    'PAY-005'::text,
    p.id::text,
    p.updated_at,
    jsonb_build_object(
      'status', p.status,
      'currency', p.currency,
      'total_checkout_cents', p.total_checkout_cents,
      'listing_request_id', p.listing_request_id
    )
  from public.listing_request_payments p
  where (p.status = 'checkout_opened' and p.updated_at < now() - interval '25 hours')
     or (p.status = 'processing' and p.updated_at < now() - interval '7 days')

  union all

  -- CHG-003. An accepted price-increasing change order should have a
  -- schedule item (create_listing_request_change_order_payment) and that
  -- item a payment (create_listing_request_payment_when_schedule_item_required).
  select
    'change_order_payment_missing',
    'CHG-003',
    co.id::text,
    co.buyer_accepted_at,
    jsonb_build_object(
      'listing_request_id', co.listing_request_id,
      'price_delta', co.price_delta,
      'revised_total_amount', co.revised_total_amount,
      'has_schedule_item', exists (
        select 1 from public.listing_request_payment_schedule_items si
        where si.change_order_id = co.id
      )
    )
  from public.listing_request_change_orders co
  where co.status = 'buyer_accepted'
    and co.changes_price
    and co.price_delta > 0
    and coalesce(co.buyer_accepted_at, co.updated_at) < now() - interval '15 minutes'
    and not exists (
      select 1
      from public.listing_request_payment_schedule_items si
      join public.listing_request_payments p
        on p.payment_schedule_item_id = si.id
      where si.change_order_id = co.id
    )

  union all

  -- REQ-003 (Sprint 6's staleness query).
  select
    'stale_request',
    'REQ-003',
    s.listing_request_id::text,
    s.last_activity_at,
    jsonb_build_object(
      'days_since_activity', s.days_since_activity,
      'has_open_notice', s.has_open_notice
    )
  from public.admin_list_stale_listing_requests(14) s

  union all

  -- TAX-002.
  select
    'tax_evidence_insufficient',
    'TAX-002',
    p.id::text,
    p.paid_at,
    jsonb_build_object(
      'evidence_status', e.evidence_status,
      'tax_jurisdiction_country', p.tax_jurisdiction_country,
      'conflicting_country', e.conflicting_country
    )
  from public.listing_request_payments p
  cross join lateral public.get_listing_request_payment_tax_evidence_status(p.id) e
  where p.tax_treatment = 'calculated'
    and p.status in ('paid', 'partially_refunded', 'refunded')
    and e.evidence_status <> 'sufficient'

  union all

  -- TAX-003.
  select
    'tax_transaction_missing',
    'TAX-003',
    p.id::text,
    p.paid_at,
    jsonb_build_object('stripe_tax_calculation_id', p.stripe_tax_calculation_id)
  from public.listing_request_payments p
  where p.tax_treatment = 'calculated'
    and p.status in ('paid', 'partially_refunded', 'refunded')
    and p.stripe_tax_transaction_id is null
    and p.paid_at < now() - interval '1 hour'

  union all

  -- TAX-004. The reversal is created right after the refund; an hour's
  -- grace keeps an in-flight refund out of the alert.
  select
    'tax_reversal_missing',
    'TAX-004',
    r.id::text,
    r.created_at,
    jsonb_build_object(
      'payment_id', r.payment_id,
      'stripe_refund_id', r.stripe_refund_id,
      'tax_refund_cents', r.tax_refund_cents
    )
  from public.listing_request_payment_refunds r
  where r.tax_refund_cents > 0
    and r.stripe_tax_reversal_id is null
    and r.created_at < now() - interval '1 hour'

  union all

  -- TAX-007. Wave 2 currencies are enabled while the tax advice is open.
  select
    'paid_wave2_currency',
    'TAX-007',
    p.id::text,
    p.paid_at,
    jsonb_build_object('currency', p.currency, 'status', p.status)
  from public.listing_request_payments p
  where p.currency not in ('cad', 'usd')
    and p.paid_at is not null

  union all

  -- CON-003. Stripe restricted an account that still has live listings.
  select
    'payment_account_lost_readiness',
    'CON-003',
    a.user_id::text,
    a.readiness_lost_at,
    jsonb_build_object(
      'stripe_account_id', a.stripe_account_id,
      'charges_enabled', a.charges_enabled,
      'payouts_enabled', a.payouts_enabled,
      'details_submitted', a.details_submitted,
      'requirements_due_count', a.requirements_due_count,
      'requirements_past_due_count', a.requirements_past_due_count,
      'active_listing_count', (
        select count(*) from public.listings l
        where l.user_id = a.user_id and l.status = 'published' and l.is_active
      )
    )
  from public.creator_payment_accounts a
  where a.readiness_lost_at is not null
    and not (a.charges_enabled and a.payouts_enabled and a.details_submitted)
    and exists (
      select 1 from public.listings l
      where l.user_id = a.user_id and l.status = 'published' and l.is_active
    )

  union all

  -- CON-006. The hourly resync refreshes anything older than 6 hours, so a
  -- mirror 48 hours old means the resync is not running or is failing.
  select
    'payment_account_mirror_stale',
    'CON-006',
    a.user_id::text,
    a.last_synced_at,
    jsonb_build_object('stripe_account_id', a.stripe_account_id)
  from public.creator_payment_accounts a
  where a.last_synced_at is null
     or a.last_synced_at < now() - interval '48 hours'

  union all

  -- OPS-006. Yesterday's failed actions and failed page loads (UTC day),
  -- one row per distinct failure with how often it happened. The subject
  -- carries the day, so each is emailed once, in the first run after
  -- midnight UTC, and drops out a day later. Capped at the 40 most frequent
  -- so a flood of made-up messages cannot bury the digest.
  select
    'app_failure_summary',
    'OPS-006',
    summary.subject_id,
    summary.last_seen_at,
    summary.detail
  from (
    select
      to_char(date_trunc('day', now()) - interval '1 day', 'YYYY-MM-DD') || ':'
        || md5(f.source || '|' || coalesce(f.route, '') || '|' || coalesce(f.code, '') || '|' || f.signature)
        as subject_id,
      max(f.occurred_at) as last_seen_at,
      jsonb_build_object(
        'day', to_char(date_trunc('day', now()) - interval '1 day', 'YYYY-MM-DD'),
        'source', f.source,
        'route', f.route,
        'code', f.code,
        'message', min(f.message),
        'occurrences', count(*),
        'accounts', count(distinct f.user_id),
        'signed_out', count(*) filter (where f.user_id is null)
      ) as detail
    from public.app_failure_events f
    where f.occurred_at >= date_trunc('day', now()) - interval '1 day'
      and f.occurred_at < date_trunc('day', now())
    group by f.source, f.route, f.code, f.signature
    order by count(*) desc
    limit 40
  ) as summary

  union all

  -- OPS-007. One account (or everyone signed out, taken together) failing
  -- 25 times or more within an hour: a broken screen, or someone probing.
  select
    'app_failure_burst',
    'OPS-007',
    coalesce(f.user_id::text, 'signed-out'),
    max(f.occurred_at),
    jsonb_build_object(
      'user_id', f.user_id,
      'occurrences', count(*),
      'distinct_failures', count(distinct f.signature),
      'most_common', mode() within group (order by f.message)
    )
  from public.app_failure_events f
  where f.occurred_at > now() - interval '1 hour'
  group by f.user_id
  having count(*) >= 25;
$$;

revoke all on function public.list_ops_alerts() from public, anon, authenticated;
grant execute on function public.list_ops_alerts() to service_role;
