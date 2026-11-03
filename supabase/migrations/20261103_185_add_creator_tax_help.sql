-- Tax help for creators. Playbook: docs/support/payments/sales.md.
--
-- Creators get a year of numbers for their own tax records: earnings and
-- the fees Made for Stream charged, with the GST/HST in those fees; sales by
-- the buyer's country and province or state, with the GST/HST rate there;
-- and what they sold over the last four quarters, against the $30,000 small
-- supplier limit. Every figure is an estimate from Made for Stream sales.
--
-- A buyer's region is shown only for payments made after that buyer accepted
-- Privacy Policy version 2026-11-03-3, which says creators see it. The admin
-- page's sales by region (20261103_184) is unchanged.

-- Privacy Policy version 2026-11-03-3 tells buyers that the creator they pay
-- sees their country and province or state, added up with the creator's
-- other sales from there. A payment from a buyer who hadn't accepted that
-- version when they paid stays hidden from the creator, so nothing collected
-- under the old promise is shown.
create or replace function public.creator_sees_buyer_region(p_buyer uuid, p_paid_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.policy_acceptances as acceptance
    where acceptance.user_id = p_buyer
      and acceptance.policy_type = 'privacy'
      -- ponytail: versions compare as text, which holds while they are dates
      -- with at most a single-digit suffix. Use a version table if that changes.
      and acceptance.policy_version >= '2026-11-03-3'
      and acceptance.accepted_at <= p_paid_at
  );
$$;

revoke all on function public.creator_sees_buyer_region(uuid, timestamptz) from public, anon, authenticated;

-- A creator's year for their own tax records: earnings and fees, sales by the
-- buyer's region with the GST/HST rate there, and for the $30,000 small
-- supplier limit, what they sold in Canadian dollars over the last four
-- calendar quarters. Estimates from Made for Stream sales only.
--
-- tax_cents is the buyer's GST/HST rate on the creator's commission sales,
-- for a creator who is registered. Downloads are left out: Made for Stream
-- pays the GST/HST on those itself (20261103_182).
create or replace function public.my_tax_summary(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  year_start timestamptz;
  quarters_start timestamptz :=
    (date_trunc('quarter', now() at time zone 'utc') - interval '9 months') at time zone 'utc';
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your sales.'
      using errcode = '42501';
  end if;

  if p_year is null or p_year < 2020 or p_year > extract(year from now() at time zone 'utc') then
    raise exception 'Choose a year from 2020 to this one.'
      using errcode = '22023';
  end if;

  year_start := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC');

  return (
    with movements as materialized (
      select
        movement.*,
        case
          when public.creator_sees_buyer_region(payment.payer_user_id, payment.paid_at)
            then coalesce(details.buyer_country, '?')
          else '-'
        end as country,
        case
          when public.creator_sees_buyer_region(payment.payer_user_id, payment.paid_at)
            then coalesce(details.buyer_region, '')
          else ''
        end as region
      from public.sale_movements(year_start, year_start + interval '1 year', auth.uid()) as movement
      inner join public.listing_request_payments as payment
        on payment.id = movement.payment_id
      left join public.paid_payment_details as details
        on details.payment_id = movement.payment_id
    )
    select jsonb_build_object(
      'creator_country', (
        select account.country_code
        from public.user_account_details as account
        where account.user_id = auth.uid()
      ),
      'totals', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'currency', totals.currency,
          'payments', totals.payments,
          'sold_cents', totals.sold_cents,
          'fee_cents', totals.fee_cents,
          'fee_tax_cents', totals.fee_tax_cents,
          'earned_cents', totals.sold_cents - totals.fee_cents
        ) order by totals.currency), '[]'::jsonb)
        from (
          select
            movement.currency,
            count(*) filter (where movement.kind = 'sale') as payments,
            sum(movement.sold_cents) as sold_cents,
            sum(movement.creator_fee_cents) as fee_cents,
            sum(movement.creator_tax_cents) as fee_tax_cents
          from movements as movement
          group by movement.currency
        ) as totals
      ),
      'regions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'country', region.country,
          'region', region.region,
          'currency', region.currency,
          'payments', region.payments,
          'sold_cents', region.sold_cents,
          'earned_cents', region.earned_cents,
          'commission_sold_cents', region.commission_sold_cents,
          'bps', region.bps,
          'tax_cents', round(region.commission_sold_cents * region.bps / 10000.0)::bigint
        ) order by region.currency, region.sold_cents desc, region.country, region.region), '[]'::jsonb)
        from (
          select
            movement.country,
            movement.region,
            movement.currency,
            -- A rate only where it's GST/HST: buyers in Canada.
            case when movement.country = 'CA' then movement.buyer_tax_bps end as bps,
            count(*) filter (where movement.kind = 'sale') as payments,
            sum(movement.sold_cents) as sold_cents,
            sum(movement.sold_cents - movement.creator_fee_cents) as earned_cents,
            coalesce(sum(movement.sold_cents) filter (where not movement.instant), 0) as commission_sold_cents
          from movements as movement
          group by 1, 2, 3, 4
        ) as region
      ),
      'small_supplier', (
        select jsonb_build_object(
          'from', (quarters_start at time zone 'utc')::date,
          'sold_cents', coalesce(sum(movement.sold_cents), 0)
        )
        from public.sale_movements(quarters_start, now(), auth.uid()) as movement
        where lower(movement.currency) = 'cad'
      )
    )
  );
end;
$$;

revoke all on function public.my_tax_summary(integer) from public, anon;
grant execute on function public.my_tax_summary(integer) to authenticated;
