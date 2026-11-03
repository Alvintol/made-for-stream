-- Earnings dashboard and sales by region. Playbook: docs/support/payments/sales.md.
--
-- 1. Each paid sale keeps the buyer's country and state or province, so the
--    admin page can add sales up by region. US sales tax is owed by state,
--    so this tracks how much is sold in each one.
-- 2. The graphs can be read for any dates, up to two years, and for
--    commissions, instant downloads or both. Up to 92 days is by day, and
--    anything longer is by month.
-- 3. The month totals say how many completed sales were commissions and how
--    many were downloads.
--
-- The p_days graph functions from 20261103_181 stay, so a page still open on
-- the old site goes on working until it's reloaded.

-- 1. Where each buyer was.

alter table public.paid_payment_details
  add column if not exists buyer_country text,
  add column if not exists buyer_region text;

-- As in 20261102_180, plus the buyer's country and region.
create or replace function public.record_paid_payment_details(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.listing_request_payments%rowtype;
  buyer public.user_account_details%rowtype;
  seller public.user_account_details%rowtype;
  buyer_country text;
  buyer_region text;
  seller_country text;
  seller_display_name text;
  seller_shows_number boolean;
begin
  select * into payment
  from public.listing_request_payments
  where id = p_payment_id;

  select * into buyer
  from public.user_account_details
  where user_id = payment.payer_user_id;

  select * into seller
  from public.user_account_details
  where user_id = payment.creator_user_id;

  buyer_country := coalesce(payment.tax_jurisdiction_country, buyer.country_code);
  buyer_region := coalesce(payment.tax_jurisdiction_region, buyer.region);

  seller_country := coalesce(seller.country_code, (
    select upper(account.country)
    from public.creator_payment_accounts as account
    where account.user_id = payment.creator_user_id
      and account.provider = 'stripe'
  ));

  select coalesce(profile.display_name, '@' || profile.handle)
  into seller_display_name
  from public.profiles as profile
  where profile.user_id = payment.creator_user_id;

  seller_shows_number := coalesce(seller.show_tax_number_on_invoices, false);

  insert into public.paid_payment_details (
    payment_id,
    buyer_tax_place,
    buyer_tax_bps,
    creator_tax_place,
    creator_tax_bps,
    seller_name,
    seller_tax_number,
    buyer_country,
    buyer_region
  )
  values (
    payment.id,
    public.sales_tax_place(buyer_country, buyer_region),
    -- Stripe Tax, if it's ever switched on, adds its tax on top instead.
    case
      when payment.tax_cents > 0 then 0
      else public.sales_tax_bps(buyer_country, buyer_region)
    end,
    public.sales_tax_place(seller_country, seller.region),
    public.sales_tax_bps(seller_country, seller.region),
    coalesce(
      case
        when seller_shows_number then coalesce(
          seller.business_legal_name,
          seller.legal_first_name || ' ' || seller.legal_last_name
        )
      end,
      seller_display_name,
      'Creator'
    ),
    case when seller_shows_number then seller.tax_number end,
    nullif(upper(btrim(coalesce(buyer_country, ''))), ''),
    nullif(btrim(coalesce(buyer_region, '')), '')
  )
  on conflict (payment_id) do nothing;
end;
$$;

revoke all on function public.record_paid_payment_details(uuid) from public, anon, authenticated;

-- Sales from before this migration: the place checkout recorded, or else
-- the buyer's address now, which may have changed since.
update public.paid_payment_details as details
set
  buyer_country = nullif(upper(btrim(coalesce(payment.tax_jurisdiction_country, account.country_code, ''))), ''),
  buyer_region = nullif(btrim(coalesce(payment.tax_jurisdiction_region, account.region, '')), '')
from public.listing_request_payments as payment
left join public.user_account_details as account
  on account.user_id = payment.payer_user_id
where payment.id = details.payment_id
  and details.buyer_country is null;

-- 2. Adding up, for commissions, instant downloads or both.

create or replace function public.check_sales_kind(p_kind text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if coalesce(p_kind, 'all') not in ('all', 'request', 'instant') then
    raise exception 'Choose commissions, instant downloads or everything.'
      using errcode = '22023';
  end if;

  return coalesce(p_kind, 'all');
end;
$$;

revoke all on function public.check_sales_kind(text) from public, anon, authenticated;

drop function if exists public.sales_by_period(timestamptz, timestamptz, text, uuid);

-- As in 20261103_181, plus p_kind and how many completed sales were downloads.
create function public.sales_by_period(
  p_from timestamptz,
  p_to timestamptz,
  p_unit text,
  p_creator uuid default null,
  p_kind text default 'all'
)
returns table (
  period date,
  currency text,
  sales bigint,
  instant_sales bigint,
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
declare
  wanted text := public.check_sales_kind(p_kind);
begin
  return query
  select
    date_trunc(p_unit, entry.happened_at at time zone 'utc')::date,
    entry.currency,
    sum(entry.sales)::bigint,
    sum(entry.instant_sales)::bigint,
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
      (request.fulfilment_mode = 'instant')::int as instant_sales,
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
    inner join public.listing_requests as request
      on request.id = sale.listing_request_id
    where wanted = 'all' or request.fulfilment_mode = wanted

    union all

    select
      movement.happened_at,
      movement.currency,
      0,
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
    where wanted = 'all' or movement.instant = (wanted = 'instant')
  ) as entry
  group by 1, 2;
end;
$$;

revoke all on function public.sales_by_period(timestamptz, timestamptz, text, uuid, text) from public, anon, authenticated;

-- 3. The month cards. As in 20261103_181, plus commissions and downloads.

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
      'commissions', totals.sales - totals.instant_sales,
      'downloads', totals.instant_sales,
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

-- As in 20261103_182, plus commissions, downloads and the month's sales by
-- the buyer's region. A region's sales follow the transactions, like tax:
-- what buyers there paid that month, less refunds.
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
          'commissions', totals.sales - totals.instant_sales,
          'downloads', totals.instant_sales,
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
      ),
      'regions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'country', region.country,
          'region', region.region,
          'currency', region.currency,
          'payments', region.payments,
          'paid_cents', region.paid_cents,
          'tax_cents', region.tax_cents
        ) order by region.currency, region.paid_cents desc, region.country, region.region), '[]'::jsonb)
        from (
          select
            coalesce(details.buyer_country, '?') as country,
            coalesce(details.buyer_region, '') as region,
            movement.currency,
            count(*) filter (where movement.kind = 'sale') as payments,
            sum(movement.sold_cents + movement.buyer_fee_cents + movement.support_cents) as paid_cents,
            sum(movement.buyer_tax_cents) as tax_cents
          from movements as movement
          left join public.paid_payment_details as details
            on details.payment_id = movement.payment_id
          group by 1, 2, 3
        ) as region
      )
    )
  );
end;
$$;

revoke all on function public.admin_sales_summary(date) from public, anon;
grant execute on function public.admin_sales_summary(date) to authenticated;

-- 4. The graphs for any dates. Up to two years back from the end date, and
-- never past today. Up to 92 days is by day; longer is by whole month.

create or replace function public.sales_chart_window(p_from date, p_to date)
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
  last_day date := least(coalesce(p_to, today), today);
  first_day date := greatest(coalesce(p_from, last_day - 27), last_day - 730);
begin
  if first_day > last_day then
    raise exception 'Choose a start date before the end date.'
      using errcode = '22023';
  end if;

  unit := 'day';

  if last_day - first_day >= 92 then
    unit := 'month';
    first_day := date_trunc('month', first_day)::date;
  end if;

  from_at := first_day::timestamp at time zone 'utc';
  to_at := (last_day + 1)::timestamp at time zone 'utc';

  select jsonb_agg(period::date order by period)
  into periods
  from generate_series(
    first_day::timestamp,
    case when unit = 'month' then date_trunc('month', last_day) else last_day::timestamp end,
    ('1 ' || unit)::interval
  ) as period;

  return next;
end;
$$;

revoke all on function public.sales_chart_window(date, date) from public, anon, authenticated;

create or replace function public.my_sales_chart(p_from date, p_to date, p_kind text default 'all')
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

  select * into chart from public.sales_chart_window(p_from, p_to);

  return jsonb_build_object(
    'unit', chart.unit,
    'periods', chart.periods,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'period', totals.period,
        'currency', totals.currency,
        'sales', totals.sales,
        'instant_sales', totals.instant_sales,
        'sold_cents', totals.sold_cents,
        'transactions', totals.transactions,
        'paid_cents', totals.paid_cents,
        'fee_cents', totals.creator_fee_cents,
        'earned_cents', totals.paid_cents - totals.creator_fee_cents
      ) order by totals.period, totals.currency), '[]'::jsonb)
      from public.sales_by_period(chart.from_at, chart.to_at, chart.unit, auth.uid(), p_kind) as totals
    )
  );
end;
$$;

revoke all on function public.my_sales_chart(date, date, text) from public, anon;
grant execute on function public.my_sales_chart(date, date, text) to authenticated;

create or replace function public.admin_sales_chart(p_from date, p_to date, p_kind text default 'all')
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

  select * into chart from public.sales_chart_window(p_from, p_to);

  return jsonb_build_object(
    'unit', chart.unit,
    'periods', chart.periods,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'period', totals.period,
        'currency', totals.currency,
        'sales', totals.sales,
        'instant_sales', totals.instant_sales,
        'sold_cents', totals.sold_total_cents,
        'transactions', totals.transactions,
        'paid_cents', totals.paid_total_cents,
        'kept_cents', totals.kept_cents,
        'tax_cents', totals.tax_cents,
        'earned_cents', totals.kept_cents - totals.tax_cents
      ) order by totals.period, totals.currency), '[]'::jsonb)
      from public.sales_by_period(chart.from_at, chart.to_at, chart.unit, null, p_kind) as totals
    )
  );
end;
$$;

revoke all on function public.admin_sales_chart(date, date, text) from public, anon;
grant execute on function public.admin_sales_chart(date, date, text) to authenticated;
