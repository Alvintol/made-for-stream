-- A sale is now one completed commission or listing, however many payments it
-- took. Every payment is a transaction. Earnings, fees and tax still follow the
-- transactions, because that's when the money moved and when tax is due.
-- Playbook: docs/support/payments/sales.md.

create index if not exists listing_requests_creator_completed_idx
  on public.listing_requests (creator_user_id, completed_at desc)
  where status = 'completed';

-- 1. Each completed project once, with all its payments added together less
-- anything refunded, even when they were paid in other months. A project that
-- was refunded in full is no longer a sale.

create or replace function public.completed_sales(
  p_from timestamptz,
  p_to timestamptz,
  p_creator uuid default null
)
returns table (
  listing_request_id uuid,
  completed_at timestamptz,
  creator_user_id uuid,
  currency text,
  transactions bigint,
  sold_cents bigint,
  buyer_fee_cents bigint,
  creator_fee_cents bigint,
  support_cents bigint
)
language plpgsql
stable
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
begin
  return query
  select
    request.id,
    request.completed_at,
    request.creator_user_id,
    payment.currency,
    count(*),
    sum(payment.base_amount_cents + payment.creator_tip_cents - refunded.sold)::bigint,
    sum(payment.buyer_service_fee_cents - refunded.buyer_fee)::bigint,
    sum(payment.creator_platform_fee_cents - refunded.creator_fee)::bigint,
    sum(payment.platform_support_cents - refunded.support)::bigint
  from public.listing_requests as request
  inner join public.listing_request_payments as payment
    on payment.listing_request_id = request.id
    and payment.paid_at is not null
  cross join lateral (
    select
      coalesce(sum(refund.base_refund_cents + refund.tip_refund_cents), 0) as sold,
      coalesce(sum(refund.buyer_fee_refund_cents), 0) as buyer_fee,
      coalesce(sum(refund.creator_fee_reversal_cents), 0) as creator_fee,
      coalesce(sum(refund.contribution_refund_cents), 0) as support
    from public.listing_request_payment_refunds as refund
    where refund.payment_id = payment.id
  ) as refunded
  where request.status = 'completed'
    and request.completed_at >= p_from
    and request.completed_at < p_to
    and (p_creator is null or request.creator_user_id = p_creator)
  group by request.id, request.completed_at, request.creator_user_id, payment.currency
  having sum(payment.base_amount_cents + payment.creator_tip_cents - refunded.sold) > 0;
end;
$$;

revoke all on function public.completed_sales(timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- 2. Sales and transactions added up by day or month. Sales land when the
-- project completed; transactions land when they were paid or refunded. The
-- totals, the graphs and the month cards all read this, so they always agree.
-- The *_total_cents columns are what buyers paid, for the admin pages.

create or replace function public.sales_by_period(
  p_from timestamptz,
  p_to timestamptz,
  p_unit text,
  p_creator uuid default null
)
returns table (
  period date,
  currency text,
  sales bigint,
  sold_cents bigint,
  sold_total_cents bigint,
  transactions bigint,
  paid_cents bigint,
  paid_total_cents bigint,
  refunded_cents bigint,
  refunded_total_cents bigint,
  creator_fee_cents bigint,
  creator_fee_tax_cents bigint,
  kept_cents bigint,
  tax_cents bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  return query
  select
    date_trunc(p_unit, entry.happened_at at time zone 'utc')::date,
    entry.currency,
    sum(entry.sales)::bigint,
    sum(entry.sold_cents)::bigint,
    sum(entry.sold_total_cents)::bigint,
    sum(entry.transactions)::bigint,
    sum(entry.paid_cents)::bigint,
    sum(entry.paid_total_cents)::bigint,
    sum(entry.refunded_cents)::bigint,
    sum(entry.refunded_total_cents)::bigint,
    sum(entry.creator_fee_cents)::bigint,
    sum(entry.creator_fee_tax_cents)::bigint,
    sum(entry.kept_cents)::bigint,
    sum(entry.tax_cents)::bigint
  from (
    select
      sale.completed_at as happened_at,
      sale.currency,
      1 as sales,
      sale.sold_cents,
      sale.sold_cents + sale.buyer_fee_cents + sale.support_cents as sold_total_cents,
      0 as transactions,
      0::bigint as paid_cents,
      0::bigint as paid_total_cents,
      0::bigint as refunded_cents,
      0::bigint as refunded_total_cents,
      0::bigint as creator_fee_cents,
      0::bigint as creator_fee_tax_cents,
      0::bigint as kept_cents,
      0::bigint as tax_cents
    from public.completed_sales(p_from, p_to, p_creator) as sale

    union all

    select
      movement.happened_at,
      movement.currency,
      0,
      0::bigint,
      0::bigint,
      (movement.kind = 'sale')::int,
      movement.sold_cents,
      movement.sold_cents + movement.buyer_fee_cents + movement.support_cents,
      case when movement.kind = 'refund' then -movement.sold_cents else 0 end,
      case
        when movement.kind = 'refund'
          then -(movement.sold_cents + movement.buyer_fee_cents + movement.support_cents)
        else 0
      end,
      movement.creator_fee_cents,
      movement.creator_tax_cents,
      movement.buyer_fee_cents + movement.creator_fee_cents + movement.support_cents,
      movement.buyer_tax_cents + movement.creator_tax_cents
    from public.sale_movements(p_from, p_to, p_creator) as movement
  ) as entry
  group by 1, 2;
end;
$$;

revoke all on function public.sales_by_period(timestamptz, timestamptz, text, uuid) from public, anon, authenticated;

-- 3. The month cards. The names keep their places, so a page still open on the
-- old site goes on working until it's reloaded.

create or replace function public.my_sales_summary(p_month date)
returns jsonb
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

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'currency', totals.currency,
      'sales', totals.sales,
      'sold_cents', totals.sold_cents,
      'transactions', totals.transactions,
      'paid_cents', totals.paid_cents,
      'refunded_cents', totals.refunded_cents,
      'fee_cents', totals.creator_fee_cents,
      'fee_tax_cents', totals.creator_fee_tax_cents,
      'earned_cents', totals.paid_cents - totals.creator_fee_cents
    ) order by totals.currency), '[]'::jsonb)
    from public.sales_by_period(
      public.sales_month_start(p_month),
      public.sales_month_end(p_month),
      'month',
      auth.uid()
    ) as totals
  );
end;
$$;

revoke all on function public.my_sales_summary(date) from public, anon;
grant execute on function public.my_sales_summary(date) to authenticated;

-- Tax to set aside still comes from the transactions, sale by sale.
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
              movement.buyer_fee_cents + movement.support_cents as fees_cents,
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

-- 4. Each completed project, one row however many payments it took. my_sales
-- and admin_sales go on listing the transactions.

create or replace function public.my_completed_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  listing_request_id uuid,
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

create or replace function public.admin_completed_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  listing_request_id uuid,
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

-- 5. The graphs. Up to 90 days runs by day and anything longer is the last 12
-- whole months, so a page can never ask for more than a year.
--
-- ponytail: each graph adds up the period when it's opened, which is fine into
-- the tens of thousands of sales a month. Past that, keep daily totals in a table.

create or replace function public.sales_chart_range(p_days integer)
returns table (
  from_at timestamptz,
  to_at timestamptz,
  unit text,
  periods jsonb
)
language plpgsql
stable
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  days integer := least(greatest(coalesce(p_days, 28), 1), 365);
  first_day date := today - (days - 1);
begin
  unit := 'day';

  if days > 90 then
    unit := 'month';
    first_day := (date_trunc('month', today) - interval '11 months')::date;
  end if;

  from_at := first_day::timestamp at time zone 'utc';
  to_at := (today + 1)::timestamp at time zone 'utc';

  select jsonb_agg(period::date order by period)
  into periods
  from generate_series(first_day::timestamp, today::timestamp, ('1 ' || unit)::interval) as period;

  return next;
end;
$$;

revoke all on function public.sales_chart_range(integer) from public, anon, authenticated;

create or replace function public.my_sales_chart(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  chart record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your sales.'
      using errcode = '42501';
  end if;

  select * into chart from public.sales_chart_range(p_days);

  return jsonb_build_object(
    'unit', chart.unit,
    'periods', chart.periods,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'period', totals.period,
        'currency', totals.currency,
        'sales', totals.sales,
        'sold_cents', totals.sold_cents,
        'transactions', totals.transactions,
        'paid_cents', totals.paid_cents,
        'fee_cents', totals.creator_fee_cents,
        'earned_cents', totals.paid_cents - totals.creator_fee_cents
      ) order by totals.period, totals.currency), '[]'::jsonb)
      from public.sales_by_period(chart.from_at, chart.to_at, chart.unit, auth.uid()) as totals
    )
  );
end;
$$;

revoke all on function public.my_sales_chart(integer) from public, anon;
grant execute on function public.my_sales_chart(integer) to authenticated;

create or replace function public.admin_sales_chart(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  chart record;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see sales.'
      using errcode = '42501';
  end if;

  select * into chart from public.sales_chart_range(p_days);

  return jsonb_build_object(
    'unit', chart.unit,
    'periods', chart.periods,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'period', totals.period,
        'currency', totals.currency,
        'sales', totals.sales,
        'sold_cents', totals.sold_total_cents,
        'transactions', totals.transactions,
        'paid_cents', totals.paid_total_cents,
        'kept_cents', totals.kept_cents,
        'tax_cents', totals.tax_cents,
        'earned_cents', totals.kept_cents - totals.tax_cents
      ) order by totals.period, totals.currency), '[]'::jsonb)
      from public.sales_by_period(chart.from_at, chart.to_at, chart.unit) as totals
    )
  );
end;
$$;

revoke all on function public.admin_sales_chart(integer) from public, anon;
grant execute on function public.admin_sales_chart(integer) to authenticated;
