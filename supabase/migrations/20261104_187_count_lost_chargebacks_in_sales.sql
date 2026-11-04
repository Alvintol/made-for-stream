-- Lost chargebacks come off sales (2026-11-04).
--
-- When a buyer's bank decides a chargeback against the seller, the money goes
-- back to the buyer, but sales, earnings, the graphs and tax estimates still
-- counted the payment in full (the ponytail note in 20261102_180). Now:
--
-- 1. listing_request_payments.dispute_lost_at: set by the charge.dispute.closed
--    webhook when Stripe says the dispute was lost. Won or warning-closed
--    disputes leave it empty, since the money stays.
-- 2. sale_movements(): a lost chargeback is a 'chargeback' movement on that
--    day, taking off whatever of the payment hadn't already been refunded,
--    with the tax in it worked out the same way as a refund.
-- 3. sales_by_period(): counts a chargeback as refunded, like a refund.
--
-- Everything else that adds up sale_movements picks this up unchanged.
-- ponytail: a chargeback takes the whole unrefunded amount. Stripe can lose a
-- dispute for less than that; store the dispute amount if that ever happens.

alter table public.listing_request_payments
  add column if not exists dispute_lost_at timestamptz null;

comment on column public.listing_request_payments.dispute_lost_at is
  'When Stripe closed a chargeback on this payment as lost. Set by the charge.dispute.closed webhook.';

-- 2. As in 20261103_182, plus the chargeback movement.
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
    and (p_creator is null or payment.creator_user_id = p_creator)

  union all

  -- A lost chargeback: the buyer's bank took back whatever hadn't already
  -- been refunded, so it comes off the sale like a full refund of the rest.
  select
    md5(payment.id::text || ':chargeback')::uuid,
    payment.id,
    'chargeback'::text,
    payment.dispute_lost_at,
    payment.creator_user_id,
    payment.currency,
    -(payment.base_amount_cents + payment.creator_tip_cents - refunded.sold_cents)::bigint,
    -(payment.buyer_service_fee_cents - refunded.buyer_fee_cents)::bigint,
    -(payment.creator_platform_fee_cents - refunded.creator_fee_cents)::bigint,
    -(payment.platform_support_cents - refunded.support_cents)::bigint,
    coalesce(details.buyer_tax_place, '?'),
    coalesce(details.buyer_tax_bps, 500),
    public.included_tax_cents(
      -(
        payment.buyer_service_fee_cents - refunded.buyer_fee_cents
        + payment.platform_support_cents - refunded.support_cents
        + case when request.fulfilment_mode = 'instant'
            then payment.base_amount_cents + payment.creator_tip_cents - refunded.sold_cents
            else 0
          end
      )::bigint,
      coalesce(details.buyer_tax_bps, 500)
    ) - (payment.tax_cents - refunded.tax_cents),
    coalesce(details.creator_tax_place, '?'),
    coalesce(details.creator_tax_bps, 500),
    case
      when request.fulfilment_mode = 'instant' then 0::bigint
      else public.included_tax_cents(
        -(payment.creator_platform_fee_cents - refunded.creator_fee_cents)::bigint,
        coalesce(details.creator_tax_bps, 500)
      )
    end,
    request.fulfilment_mode = 'instant'
  from public.listing_request_payments as payment
  inner join public.listing_requests as request
    on request.id = payment.listing_request_id
  left join public.paid_payment_details as details
    on details.payment_id = payment.id
  cross join lateral (
    select
      coalesce(sum(refund.base_refund_cents + refund.tip_refund_cents), 0) as sold_cents,
      coalesce(sum(refund.buyer_fee_refund_cents), 0) as buyer_fee_cents,
      coalesce(sum(refund.creator_fee_reversal_cents), 0) as creator_fee_cents,
      coalesce(sum(refund.contribution_refund_cents), 0) as support_cents,
      coalesce(sum(refund.tax_refund_cents), 0) as tax_cents
    from public.listing_request_payment_refunds as refund
    where refund.payment_id = payment.id
  ) as refunded
  where payment.dispute_lost_at >= p_from
    and payment.dispute_lost_at < p_to
    and payment.status <> 'refunded'
    and (p_creator is null or payment.creator_user_id = p_creator);
end;
$$;

revoke all on function public.sale_movements(timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- 3. As in 20261103_184, except refunded counts every movement that isn't a sale.
create or replace function public.sales_by_period(
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
      case when movement.kind <> 'sale' then -movement.sold_cents else 0 end,
      case
        when movement.kind <> 'sale'
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
