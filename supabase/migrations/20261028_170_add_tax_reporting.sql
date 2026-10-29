-- Tax reporting: the admin Tax reporting page and its deadline reminders
-- (decided 2026-10-28).
--
-- Made for Stream has to report each creator's earnings once a year (twice
-- in Australia) to the tax authority of the country the creator lives in,
-- and file its own GST/HST return. This adds:
--
-- 1. tax_report_regime_countries(): which creators each report covers, by
--    the country of their account address (user_account_details), falling
--    back to their Stripe account's country.
-- 2. tax_reporting_obligations(): the calendar of reports and their due
--    dates. Due dates are fixed rules; a deadline that falls on a weekend is
--    not moved, so the reminder is never late.
-- 3. tax_report_filings: the reports the admin has marked as filed.
-- 4. tax_report_seller_rows() and tax_report_seller_count(): each creator's
--    figures for a period, by currency and calendar quarter.
-- 5. admin_get_tax_reporting_overview(), admin_list_tax_report_sellers()
--    and admin_set_tax_report_filed() for the page.
-- 6. list_ops_alerts() gains tax_report_due (TAX-008): the ops email lists
--    an unfiled report 30, 14, 7 and 1 days before it is due, then every day
--    once overdue. A creator report is only listed when it has someone to
--    report; the GST/HST return always is.
--
-- The figures are the working file, not the filing: each authority has its
-- own format, and the admin uploads the report there. Nothing here sends
-- anything to a tax authority.

-- 1. Who each report covers.

create or replace function public.tax_report_regime_countries(p_regime text)
returns text[]
language sql
immutable
as $$
  select case p_regime
    -- The EU's DAC7 covers creators living in any of the 27 member states.
    when 'eu_dac7' then array[
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
      'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
      'SI', 'ES', 'SE'
    ]
    when 'ca_dpi' then array['CA']
    when 'uk_dpi' then array['GB']
    when 'nz_dpi' then array['NZ']
    when 'au_serr' then array['AU']
    when 'us_1099k' then array['US']
    -- ca_gst is Made for Stream's own return, not a report on creators.
    else array[]::text[]
  end;
$$;

-- 2. The calendar: every report whose due date falls between p_from and
-- p_to.
--
-- ponytail: the GST/HST return assumes an annual filer with a calendar
-- fiscal year (pay by 30 April, file by 15 June). A quarterly or monthly
-- filer changes the ca_gst rows here.
create or replace function public.tax_reporting_obligations(p_from date, p_to date)
returns table (
  regime text,
  period_start date,
  period_end date,
  due_date date
)
language sql
immutable
as $$
  with years as (
    select generate_series(
      extract(year from p_from)::integer - 1,
      extract(year from p_to)::integer
    ) as year
  ),
  calendar (regime, period_start, period_end, due_date) as (
    select yearly.regime, make_date(years.year, 1, 1), make_date(years.year, 12, 31),
      make_date(years.year + 1, 1, 31)
    from years
    cross join (values ('eu_dac7'), ('ca_dpi'), ('uk_dpi'), ('nz_dpi'), ('us_1099k'))
      as yearly (regime)

    union all

    -- Australia reports each half year.
    select 'au_serr', make_date(years.year, 1, 1), make_date(years.year, 6, 30),
      make_date(years.year, 7, 31)
    from years

    union all

    select 'au_serr', make_date(years.year, 7, 1), make_date(years.year, 12, 31),
      make_date(years.year + 1, 1, 31)
    from years

    union all

    select 'ca_gst', make_date(years.year, 1, 1), make_date(years.year, 12, 31),
      make_date(years.year + 1, 4, 30)
    from years
  )
  select calendar.regime, calendar.period_start, calendar.period_end, calendar.due_date
  from calendar
  where calendar.due_date between p_from and p_to;
$$;

-- 3. Reports marked as filed. Written only through
-- admin_set_tax_report_filed(); nobody reads the table directly.

create table if not exists public.tax_report_filings (
  regime text not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  filed_at timestamptz not null default now(),
  filed_by uuid not null references auth.users (id),
  reference text check (reference is null or char_length(reference) <= 200),
  primary key (regime, period_start)
);

alter table public.tax_report_filings enable row level security;

revoke all on table public.tax_report_filings from public, anon, authenticated;

-- 4. Each creator's figures for a period, by currency and calendar quarter
-- (UTC). A payment counts in the quarter it was paid; a refund in the
-- quarter it was made, as a separate amount. "Paid" is the work and the tip,
-- the money that goes to the creator; "creator fees" is what Made for Stream
-- kept from them, less fees given back on refunds. The buyer service fee and
-- the contribution are the buyer's, so they are not here.

create or replace function public.tax_report_seller_rows(
  p_regime text,
  p_period_start date,
  p_period_end date
)
returns table (
  creator_user_id uuid,
  country_code text,
  currency text,
  quarter integer,
  payments integer,
  paid_cents bigint,
  refunded_cents bigint,
  creator_fee_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_period_start::timestamp at time zone 'utc' as starts_at,
      (p_period_end + 1)::timestamp at time zone 'utc' as ends_at
  ),
  movements as (
    select
      payment.creator_user_id,
      payment.currency,
      payment.paid_at as happened_at,
      1 as payments,
      (coalesce(payment.base_amount_cents, 0) + coalesce(payment.creator_tip_cents, 0))::bigint as paid_cents,
      0::bigint as refunded_cents,
      coalesce(payment.creator_platform_fee_cents, 0)::bigint as creator_fee_cents
    from public.listing_request_payments as payment
    cross join bounds
    where payment.paid_at >= bounds.starts_at
      and payment.paid_at < bounds.ends_at

    union all

    select
      payment.creator_user_id,
      refund.currency,
      refund.created_at,
      0,
      0,
      (coalesce(refund.base_refund_cents, 0) + coalesce(refund.tip_refund_cents, 0))::bigint,
      -coalesce(refund.creator_fee_reversal_cents, 0)::bigint
    from public.listing_request_payment_refunds as refund
    inner join public.listing_request_payments as payment
      on payment.id = refund.payment_id
    cross join bounds
    where refund.created_at >= bounds.starts_at
      and refund.created_at < bounds.ends_at
  ),
  located as (
    select
      movement.*,
      coalesce(nullif(details.country_code, ''), upper(account.country)) as seller_country
    from movements as movement
    left join public.user_account_details as details
      on details.user_id = movement.creator_user_id
    left join public.creator_payment_accounts as account
      on account.user_id = movement.creator_user_id
      and account.provider = 'stripe'
  )
  select
    located.creator_user_id,
    located.seller_country,
    located.currency,
    extract(quarter from located.happened_at at time zone 'utc')::integer,
    sum(located.payments)::integer,
    sum(located.paid_cents)::bigint,
    sum(located.refunded_cents)::bigint,
    sum(located.creator_fee_cents)::bigint
  from located
  where located.seller_country = any (public.tax_report_regime_countries(p_regime))
  group by 1, 2, 3, 4;
$$;

revoke all on function public.tax_report_seller_rows(text, date, date) from public, anon, authenticated;

-- How many creators a report has to include. A 1099-K is only owed for a
-- US creator paid over $20,000 in more than 200 payments in the year.
--
-- ponytail: the 1099-K test counts USD payments only, which is what US
-- creators are paid in today. A US creator paid in another currency would
-- need that converted.
create or replace function public.tax_report_seller_count(
  p_regime text,
  p_period_start date,
  p_period_end date
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from (
    select
      seller_row.creator_user_id,
      coalesce(sum(seller_row.paid_cents) filter (where seller_row.currency = 'usd'), 0) as usd_paid_cents,
      coalesce(sum(seller_row.payments) filter (where seller_row.currency = 'usd'), 0) as usd_payments
    from public.tax_report_seller_rows(p_regime, p_period_start, p_period_end) as seller_row
    group by seller_row.creator_user_id
  ) as seller
  where p_regime <> 'us_1099k'
     or (seller.usd_paid_cents > 2000000 and seller.usd_payments > 200);
$$;

revoke all on function public.tax_report_seller_count(text, date, date) from public, anon, authenticated;

-- 5. The admin page.

-- The reports from launch onwards, due up to a year ahead, each with how
-- many creators it covers and whether it has been marked filed. Reports due
-- before 1 October 2026, when Made for Stream had taken no payments, are
-- left out.
create or replace function public.admin_get_tax_reporting_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see tax reporting.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'today', current_date,
    'obligations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'regime', obligation.regime,
        'period_start', obligation.period_start,
        'period_end', obligation.period_end,
        'due_date', obligation.due_date,
        'seller_count', case
          when obligation.regime = 'ca_gst' then null
          else public.tax_report_seller_count(
            obligation.regime, obligation.period_start, obligation.period_end
          )
        end,
        'filed_at', filing.filed_at,
        'reference', filing.reference
      ) order by obligation.due_date, obligation.regime), '[]'::jsonb)
      from public.tax_reporting_obligations(date '2026-10-01', current_date + 366) as obligation
      left join public.tax_report_filings as filing
        on filing.regime = obligation.regime
        and filing.period_start = obligation.period_start
    )
  );
end;
$$;

revoke all on function public.admin_get_tax_reporting_overview() from public, anon;
grant execute on function public.admin_get_tax_reporting_overview() to authenticated;

-- One report's rows, with each creator's private account details: the
-- identity fields the authorities ask for. Only an administrator can read
-- it, and the page hands it over as a file for the filing.
create or replace function public.admin_list_tax_report_sellers(
  p_regime text,
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see tax reporting.'
      using errcode = '42501';
  end if;

  if cardinality(public.tax_report_regime_countries(p_regime)) = 0 then
    raise exception 'That report does not list creators.'
      using errcode = '22023';
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Choose a report period.'
      using errcode = '22023';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'creator_user_id', seller_row.creator_user_id,
      'country_code', seller_row.country_code,
      'currency', seller_row.currency,
      'quarter', seller_row.quarter,
      'payments', seller_row.payments,
      'paid_cents', seller_row.paid_cents,
      'refunded_cents', seller_row.refunded_cents,
      'creator_fee_cents', seller_row.creator_fee_cents,
      'account_type', details.account_type,
      'legal_first_name', details.legal_first_name,
      'legal_last_name', details.legal_last_name,
      'business_legal_name', details.business_legal_name,
      'date_of_birth', details.date_of_birth,
      'address_line1', details.address_line1,
      'address_line2', details.address_line2,
      'city', details.city,
      'region', details.region,
      'postal_code', details.postal_code,
      'tax_number', details.tax_number,
      'business_registration_number', details.business_registration_number,
      'stripe_account_id', account.stripe_account_id
    ) order by details.legal_last_name, details.legal_first_name,
      seller_row.creator_user_id, seller_row.currency, seller_row.quarter), '[]'::jsonb)
    from public.tax_report_seller_rows(p_regime, p_period_start, p_period_end) as seller_row
    left join public.user_account_details as details
      on details.user_id = seller_row.creator_user_id
    left join public.creator_payment_accounts as account
      on account.user_id = seller_row.creator_user_id
      and account.provider = 'stripe'
  );
end;
$$;

revoke all on function public.admin_list_tax_report_sellers(text, date, date) from public, anon;
grant execute on function public.admin_list_tax_report_sellers(text, date, date) to authenticated;

-- Marks a report filed (with an optional confirmation number), or takes the
-- mark off. Only a report on the calendar can be marked.
create or replace function public.admin_set_tax_report_filed(
  p_regime text,
  p_period_start date,
  p_filed boolean,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  obligation record;
  cleaned_reference text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can mark a tax report filed.'
      using errcode = '42501';
  end if;

  select *
  into obligation
  from public.tax_reporting_obligations(p_period_start, p_period_start + 500) as listed
  where listed.regime = p_regime
    and listed.period_start = p_period_start;

  if not found then
    raise exception 'That report period is not on the tax calendar.'
      using errcode = '22023';
  end if;

  if not coalesce(p_filed, false) then
    delete from public.tax_report_filings
    where regime = p_regime
      and period_start = p_period_start;

    return;
  end if;

  if char_length(coalesce(cleaned_reference, '')) > 200 then
    raise exception 'Keep the confirmation number under 200 characters.'
      using errcode = '22023';
  end if;

  insert into public.tax_report_filings (
    regime, period_start, period_end, due_date, filed_by, reference
  )
  values (
    obligation.regime, obligation.period_start, obligation.period_end,
    obligation.due_date, auth.uid(), cleaned_reference
  )
  on conflict (regime, period_start) do update
  set filed_at = now(),
      filed_by = excluded.filed_by,
      reference = excluded.reference;
end;
$$;

revoke all on function public.admin_set_tax_report_filed(text, date, boolean, text) from public, anon;
grant execute on function public.admin_set_tax_report_filed(text, date, boolean, text) to authenticated;

-- 6. list_ops_alerts(), as last defined in 20261016_166, with TAX-008 added
-- at the end.

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
  having count(*) >= 25

  union all

  -- OPS-008. Stored files, or this month's delivery downloads (as logged by
  -- record_delivery_file_download), passing a share of what the Supabase
  -- Pro plan includes (100 GB stored, 250 GB downloaded a month) or a
  -- larger mark. Each mark is emailed once: the stored ones once ever, the
  -- download ones once a month.
  select
    'storage_usage_high',
    'OPS-008',
    marks.subject_id,
    now(),
    jsonb_build_object(
      'kind', marks.kind,
      'threshold_bytes', marks.threshold_bytes,
      'used_bytes', marks.used_bytes,
      'included_bytes', marks.included_bytes
    )
  from (
    select
      'stored:' || stored_marks.label as subject_id,
      'stored' as kind,
      stored_marks.threshold_bytes,
      107374182400::bigint as included_bytes,
      (
        select coalesce(sum((objects.metadata ->> 'size')::bigint), 0)
        from storage.objects
      ) as used_bytes
    from (
      values
        ('80GB', 85899345920::bigint),
        ('500GB', 536870912000::bigint),
        ('2TB', 2199023255552::bigint)
    ) as stored_marks (label, threshold_bytes)

    union all

    select
      'downloads:' || to_char(now() at time zone 'utc', 'YYYY-MM') || ':' || download_marks.label,
      'downloads',
      download_marks.threshold_bytes,
      268435456000::bigint,
      (
        select coalesce(sum(downloads.bytes), 0)
        from public.delivery_file_downloads as downloads
        where downloads.downloaded_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
      )
    from (
      values
        ('200GB', 214748364800::bigint),
        ('1TB', 1099511627776::bigint)
    ) as download_marks (label, threshold_bytes)
  ) as marks
  where marks.used_bytes >= marks.threshold_bytes

  union all

  -- MIL-008. Work sent outside Made for Stream that the buyer has still not
  -- confirmed 10 days after it was sent, on an active commission. Receipts
  -- of a final delivery that was replaced do not count.
  select
    'off_site_receipt_overdue',
    'MIL-008',
    receipt.id::text,
    receipt.sent_at,
    jsonb_build_object(
      'listing_request_id', receipt.listing_request_id,
      'subject', receipt.subject,
      'status', receipt.status,
      'waiting_days', floor(extract(epoch from (now() - receipt.sent_at)) / 86400)::integer
    )
  from public.off_site_delivery_receipts as receipt
  inner join public.listing_requests as request
    on request.id = receipt.listing_request_id
    and request.status = 'accepted'
  left join public.listing_request_final_deliveries as delivery
    on delivery.id = receipt.final_delivery_id
  where receipt.status <> 'received'
    and receipt.sent_at < now() - interval '10 days'
    and (receipt.final_delivery_id is null or delivery.status = 'submitted')

  union all

  -- TAX-008. A tax report or GST/HST return not yet marked filed on the
  -- admin Tax reporting page, listed 30, 14, 7 and 1 days before it is due
  -- and every day once overdue: the subject carries the step (or the day),
  -- so each is emailed once. A creator report only counts when it has
  -- someone to report (tax_report_seller_count, 20261028_170).
  select
    'tax_report_due',
    'TAX-008',
    due.regime || ':' || due.period_start || ':' || case
      when due.days_left < 0 then 'overdue:' || current_date
      when due.days_left <= 1 then '1'
      when due.days_left <= 7 then '7'
      when due.days_left <= 14 then '14'
      else '30'
    end,
    now(),
    jsonb_build_object(
      'regime', due.regime,
      'period_start', due.period_start,
      'period_end', due.period_end,
      'due_date', due.due_date,
      'days_left', due.days_left,
      'seller_count', due.seller_count
    )
  from (
    select
      obligation.regime,
      obligation.period_start,
      obligation.period_end,
      obligation.due_date,
      obligation.due_date - current_date as days_left,
      case
        when obligation.regime = 'ca_gst' then null
        else public.tax_report_seller_count(
          obligation.regime, obligation.period_start, obligation.period_end
        )
      end as seller_count
    from public.tax_reporting_obligations(date '2026-10-01', current_date + 30) as obligation
    where not exists (
      select 1
      from public.tax_report_filings as filing
      where filing.regime = obligation.regime
        and filing.period_start = obligation.period_start
    )
  ) as due
  where due.regime = 'ca_gst'
     or due.seller_count > 0;
$$;

revoke all on function public.list_ops_alerts() from public, anon, authenticated;
grant execute on function public.list_ops_alerts() to service_role;
