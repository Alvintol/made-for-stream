-- Sales numbers, GST/HST on what Made for Stream charges, and invoices
-- (decided 2026-11-02).
--
-- Made for Stream's fees and contributions already include any GST/HST: nothing
-- is added at checkout and no amount a buyer or creator pays changes. So this
-- only works out, after a sale, how much of each amount is tax to set aside:
--
-- 1. A creator can choose to show their tax number on invoices.
-- 2. canada_sales_tax_bps(): the rate in each province and territory. The rate
--    follows the customer's address, not Alberta (CRA Memorandum 3-3-6). Outside
--    Canada it is 0, which assumes the fee is zero-rated.
-- 3. paid_payment_details: when a payment is paid, the place and rate for each
--    side, and the seller's name and tax number as they were that day. A changed
--    address or a new rate never rewrites an old sale.
-- 4. sale_movements(): every sale and refund, with the tax in it worked out. A
--    refund counts in the month it was made, as negative amounts, the same as
--    tax_report_seller_rows() (20261028_170).
-- 5. my_sales_summary(), my_sales(), admin_sales_summary(), admin_sales() and
--    get_payment_invoice() for the pages. A creator's numbers never include the
--    buyer's place or rate: the Privacy Policy says creators aren't told.
-- 6. The buyer's tax place on listing_request_payments stops being readable
--    from the browser, because creators can read that row.

-- 1. A creator's choice. The database refuses a bare nine-digit number, because
-- that's the shape of a social insurance or social security number, and this
-- one is shown to buyers. A GST/HST number carries its RT0001 ending.

alter table public.user_account_details
  add column if not exists show_tax_number_on_invoices boolean not null default false;

alter table public.user_account_details
  drop constraint if exists user_account_details_invoice_tax_number_check;

alter table public.user_account_details
  add constraint user_account_details_invoice_tax_number_check
  check (
    not show_tax_number_on_invoices
    or (
      tax_number is not null
      and regexp_replace(tax_number, '[^0-9A-Za-z]', '', 'g') !~ '^[0-9]{9}$'
    )
  );

-- 2. The rates, in basis points. A change is a new migration; sales already
-- made keep the rate they were recorded at.

create or replace function public.canada_sales_tax_bps(p_region text)
returns integer
language sql
immutable
as $$
  select case p_region
    when 'ON' then 1300
    when 'NS' then 1400
    when 'NB' then 1500
    when 'NL' then 1500
    when 'PE' then 1500
    else 500
  end;
$$;

-- An unknown place is taxed at 5% and shown as '?', so it gets looked at.
create or replace function public.sales_tax_place(p_country text, p_region text)
returns text
language sql
immutable
as $$
  select case
    when p_country = 'CA' then 'CA-' || coalesce(nullif(p_region, ''), '?')
    else coalesce(p_country, '?')
  end;
$$;

create or replace function public.sales_tax_bps(p_country text, p_region text)
returns integer
language sql
immutable
as $$
  select case
    when p_country is null or p_country = 'CA' then public.canada_sales_tax_bps(p_region)
    else 0
  end;
$$;

-- The tax inside a tax-included amount: 100.00 at 13% holds 11.50.
create or replace function public.included_tax_cents(p_amount_cents bigint, p_bps integer)
returns bigint
language sql
immutable
as $$
  select round(p_amount_cents::numeric * p_bps / (10000 + p_bps))::bigint;
$$;

revoke all on function public.canada_sales_tax_bps(text) from public, anon, authenticated;
revoke all on function public.sales_tax_place(text, text) from public, anon, authenticated;
revoke all on function public.sales_tax_bps(text, text) from public, anon, authenticated;
revoke all on function public.included_tax_cents(bigint, integer) from public, anon, authenticated;

-- 3. What was true when each payment was paid. Its own table because both
-- parties can read a payment's row, and neither may see the other's place.

create table if not exists public.paid_payment_details (
  payment_id uuid primary key references public.listing_request_payments (id) on delete cascade,
  buyer_tax_place text not null,
  buyer_tax_bps integer not null check (buyer_tax_bps >= 0),
  creator_tax_place text not null,
  creator_tax_bps integer not null check (creator_tax_bps >= 0),
  seller_name text not null,
  seller_tax_number text,
  created_at timestamptz not null default now()
);

alter table public.paid_payment_details enable row level security;

revoke all on table public.paid_payment_details from public, anon, authenticated;

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
    seller_tax_number
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
    case when seller_shows_number then seller.tax_number end
  )
  on conflict (payment_id) do nothing;
end;
$$;

revoke all on function public.record_paid_payment_details(uuid) from public, anon, authenticated;

-- Never stops a payment being marked paid: the money has already moved. A
-- missing row shows up as place '?' at 5% (TAX-009).
create or replace function public.record_details_when_payment_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_paid_payment_details(new.id);

  return null;
exception
  when others then
    raise warning 'TAX-009: paid payment details could not be recorded for %: %', new.id, sqlerrm;

    return null;
end;
$$;

revoke all on function public.record_details_when_payment_paid() from public, anon, authenticated;

drop trigger if exists listing_request_payments_record_details
  on public.listing_request_payments;

create trigger listing_request_payments_record_details
  after update of paid_at on public.listing_request_payments
  for each row
  when (old.paid_at is null and new.paid_at is not null)
  execute function public.record_details_when_payment_paid();

select public.record_paid_payment_details(id)
from public.listing_request_payments
where paid_at is not null;

create index if not exists listing_request_payments_paid_idx
  on public.listing_request_payments (paid_at desc)
  where paid_at is not null;

create index if not exists listing_request_payments_creator_paid_idx
  on public.listing_request_payments (creator_user_id, paid_at desc)
  where paid_at is not null;

create index if not exists listing_request_payment_refunds_created_idx
  on public.listing_request_payment_refunds (created_at desc);

-- 4. Every sale and refund in a period, for one creator or everyone. Plain
-- plpgsql with a custom plan, so a creator's page uses the creator index
-- instead of reading the whole month.
--
-- ponytail: a lost chargeback is not a movement, so its sale still counts here.
-- Add one when disputes write to the refund ledger.

create or replace function public.sale_movements(
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
  creator_tax_cents bigint
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
      (payment.buyer_service_fee_cents + payment.platform_support_cents)::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) + payment.tax_cents,
    coalesce(details.creator_tax_place, '?'),
    coalesce(details.creator_tax_bps, 500),
    public.included_tax_cents(
      payment.creator_platform_fee_cents::bigint,
      coalesce(details.creator_tax_bps, 500)
    )
  from public.listing_request_payments as payment
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
      -(refund.buyer_fee_refund_cents + refund.contribution_refund_cents)::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) - refund.tax_refund_cents,
    coalesce(details.creator_tax_place, '?'),
    coalesce(details.creator_tax_bps, 500),
    public.included_tax_cents(
      -refund.creator_fee_reversal_cents::bigint,
      coalesce(details.creator_tax_bps, 500)
    )
  from public.listing_request_payment_refunds as refund
  inner join public.listing_request_payments as payment
    on payment.id = refund.payment_id
  left join public.paid_payment_details as details
    on details.payment_id = payment.id
  where refund.created_at >= p_from
    and refund.created_at < p_to
    and (p_creator is null or payment.creator_user_id = p_creator);
end;
$$;

revoke all on function public.sale_movements(timestamptz, timestamptz, uuid) from public, anon, authenticated;

create or replace function public.sales_month_start(p_month date)
returns timestamptz
language sql
immutable
as $$
  select date_trunc('month', p_month::timestamp) at time zone 'utc';
$$;

create or replace function public.sales_month_end(p_month date)
returns timestamptz
language sql
immutable
as $$
  select (date_trunc('month', p_month::timestamp) + interval '1 month') at time zone 'utc';
$$;

revoke all on function public.sales_month_start(date) from public, anon, authenticated;
revoke all on function public.sales_month_end(date) from public, anon, authenticated;

-- 5. The pages.

-- One row per currency, because amounts in different currencies can't be added.
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
      'refunded_cents', totals.refunded_cents,
      'fee_cents', totals.fee_cents,
      'fee_tax_cents', totals.fee_tax_cents,
      'earned_cents', totals.sold_cents - totals.fee_cents
    ) order by totals.currency), '[]'::jsonb)
    from (
      select
        movement.currency,
        count(*) filter (where movement.kind = 'sale') as sales,
        sum(movement.sold_cents) as sold_cents,
        -coalesce(sum(movement.sold_cents) filter (where movement.kind = 'refund'), 0) as refunded_cents,
        sum(movement.creator_fee_cents) as fee_cents,
        sum(movement.creator_tax_cents) as fee_tax_cents
      from public.sale_movements(
        public.sales_month_start(p_month),
        public.sales_month_end(p_month),
        auth.uid()
      ) as movement
      group by movement.currency
    ) as totals
  );
end;
$$;

revoke all on function public.my_sales_summary(date) from public, anon;
grant execute on function public.my_sales_summary(date) to authenticated;

create or replace function public.my_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  movement_id uuid,
  payment_id uuid,
  listing_request_id uuid,
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

-- Everyone's totals and the tax to set aside for each place. Earnings are what
-- Made for Stream kept after that tax, before its own costs.
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
          'sold_cents', totals.sold_cents,
          'refunded_cents', totals.refunded_cents,
          'kept_cents', totals.kept_cents,
          'tax_cents', totals.tax_cents,
          'earned_cents', totals.kept_cents - totals.tax_cents
        ) order by totals.currency), '[]'::jsonb)
        from (
          select
            movement.currency,
            count(*) filter (where movement.kind = 'sale') as sales,
            sum(movement.sold_cents + movement.buyer_fee_cents + movement.support_cents) as sold_cents,
            -coalesce(sum(movement.sold_cents + movement.buyer_fee_cents + movement.support_cents)
              filter (where movement.kind = 'refund'), 0) as refunded_cents,
            sum(movement.buyer_fee_cents + movement.creator_fee_cents + movement.support_cents) as kept_cents,
            sum(movement.buyer_tax_cents + movement.creator_tax_cents) as tax_cents
          from movements as movement
          group by movement.currency
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

create or replace function public.admin_sales(
  p_month date,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  movement_id uuid,
  payment_id uuid,
  listing_request_id uuid,
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

-- One paid payment's invoice. The buyer sees their own rate; the creator sees
-- the fee they paid and never the buyer's rate, which would give away where the
-- buyer lives. An administrator sees both.
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

  select coalesce(request.request_title, request.listing_snapshot ->> 'title')
  into invoice_title
  from public.listing_requests as request
  where request.id = payment.listing_request_id;

  return jsonb_build_object(
    'id', payment.id,
    'number', upper(left(payment.id::text, 8)),
    'paid_at', payment.paid_at,
    'title', invoice_title,
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
      (payment.buyer_service_fee_cents + payment.platform_support_cents)::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) end,
    'creator_fee_cents', case when is_creator or is_admin then payment.creator_platform_fee_cents end,
    'creator_tax_bps', case when is_creator or is_admin then coalesce(details.creator_tax_bps, 500) end,
    'creator_fee_tax_cents', case when is_creator or is_admin then public.included_tax_cents(
      payment.creator_platform_fee_cents::bigint,
      coalesce(details.creator_tax_bps, 500)
    ) end
  );
end;
$$;

revoke all on function public.get_payment_invoice(uuid) from public, anon;
grant execute on function public.get_payment_invoice(uuid) to authenticated;

-- 6. Row level security can't hide one column, and creators can read this row,
-- so every column stays readable except the buyer's tax place. A column added
-- later is private until a migration grants it.

revoke select on table public.listing_request_payments from anon, authenticated;

do $$
declare
  readable text;
begin
  select string_agg(quote_ident(column_name), ', ')
  into readable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'listing_request_payments'
    and column_name not in ('tax_jurisdiction_country', 'tax_jurisdiction_region');

  execute format(
    'grant select (%s) on table public.listing_request_payments to authenticated',
    readable
  );
end;
$$;
