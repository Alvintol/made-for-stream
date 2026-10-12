-- A change order that LOWERS the price (a discount) after some of the
-- project has been paid.
--
-- Until now, accepting one changed the agreement's total and nothing else:
-- the payments still to come kept their old amounts, so the buyer would
-- have gone on paying the old price. A price INCREASE already had its own
-- path (a new payment for the difference, 20260608_086) and is not touched.
--
-- The rule: a change order that lowers the total must say what every
-- payment that is not yet due becomes, and
--
--     paid or due  +  the new remaining payments  =  the new total.
--
-- - Only payments still 'pending' can be lowered. A payment that is already
--   due or paid is fixed; money already paid is returned by a refund, never
--   by a change order.
-- - No remaining payment may go up, and each must still be at least the
--   instalment floor (AGR-005).
-- - If nothing is left to pay, the price cannot be lowered this way.
--
-- The creator's page sends the new amounts inside proposed_snapshot, as
-- revised_payment_amounts: [{ payment_schedule_item_id, amount }]. The
-- database checks them when the change order is drafted or sent, and
-- rewrites the list with each payment's real title and current amount, so
-- what the buyer is shown comes from the database, not from the creator's
-- browser. It checks again when the buyer accepts, because a payment can
-- become due in between, and only then changes the amounts: on the payment
-- schedule, the milestone and the agreement line.

create or replace function public.check_listing_request_change_order_reduction(
  p_agreement_id uuid,
  p_revised_total numeric,
  p_revised_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_currency text;
  entry record;
  item public.listing_request_payment_schedule_items%rowtype;
  pending_count integer;
  settled_total numeric;
  remaining_total numeric := 0;
  new_amount numeric;
  normalised jsonb := '[]'::jsonb;
begin
  select listing_request_agreements.currency
  into agreement_currency
  from public.listing_request_agreements
  where listing_request_agreements.id = p_agreement_id;

  select count(*)
  into pending_count
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id = p_agreement_id
    and listing_request_payment_schedule_items.status = 'pending';

  if pending_count = 0 then
    raise exception 'Nothing is left to pay on this project, so a change order cannot lower its price. Money already paid can only be returned as a refund.'
      using errcode = 'P0001';
  end if;

  if p_revised_payments is null
    or jsonb_typeof(p_revised_payments) <> 'array'
    or jsonb_array_length(p_revised_payments) <> pending_count
    or (
      select count(distinct element ->> 'payment_schedule_item_id')
      from jsonb_array_elements(p_revised_payments) as element
    ) <> pending_count
  then
    raise exception 'A lower total must say what each remaining payment becomes.'
      using errcode = '22023';
  end if;

  for entry in
    select
      element ->> 'payment_schedule_item_id' as item_id,
      element ->> 'amount' as amount_text
    from jsonb_array_elements(p_revised_payments) as element
  loop
    select *
    into item
    from public.listing_request_payment_schedule_items
    where listing_request_payment_schedule_items.id::text = entry.item_id
      and listing_request_payment_schedule_items.agreement_id = p_agreement_id
      and listing_request_payment_schedule_items.status = 'pending'
    for update;

    if not found then
      raise exception 'A change order can only lower payments that are not yet due.'
        using errcode = 'P0001';
    end if;

    if entry.amount_text is null
      or entry.amount_text !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then
      raise exception 'Enter an amount for every remaining payment.'
        using errcode = '22023';
    end if;

    new_amount := entry.amount_text::numeric;

    if new_amount > item.amount then
      raise exception 'A lower total cannot raise a remaining payment.'
        using errcode = '22023';
    end if;

    perform public.assert_listing_request_instalment_allowed(
      new_amount,
      agreement_currency
    );

    remaining_total := remaining_total + new_amount;

    normalised := normalised || jsonb_build_object(
      'payment_schedule_item_id', item.id,
      'title', item.title,
      'current_amount', item.amount,
      'amount', new_amount
    );
  end loop;

  select coalesce(sum(listing_request_payment_schedule_items.amount), 0)
  into settled_total
  from public.listing_request_payment_schedule_items
  where listing_request_payment_schedule_items.agreement_id = p_agreement_id
    and listing_request_payment_schedule_items.status in ('paid', 'payment_required');

  if settled_total + remaining_total <> p_revised_total then
    raise exception 'The remaining payments must add up to the new total: % already paid or due plus % remaining is %, not %.',
      to_char(settled_total, 'FM999999990.00'),
      to_char(remaining_total, 'FM999999990.00'),
      to_char(settled_total + remaining_total, 'FM999999990.00'),
      to_char(p_revised_total, 'FM999999990.00')
      using errcode = '22023';
  end if;

  return normalised;
end;
$$;

revoke all on function public.check_listing_request_change_order_reduction(uuid, numeric, jsonb)
  from public, anon, authenticated;

create or replace function public.handle_listing_request_change_order_reduction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revised jsonb;
begin
  if not new.changes_price or coalesce(new.price_delta, 0) >= 0 then
    return new;
  end if;

  if tg_when = 'BEFORE' then
    -- Drafted or sent: check the plan and keep the database's own copy.
    if new.status in ('draft', 'sent')
      and (
        tg_op = 'INSERT'
        or new.status is distinct from old.status
        or new.revised_total_amount is distinct from old.revised_total_amount
        or new.proposed_snapshot is distinct from old.proposed_snapshot
      )
    then
      new.proposed_snapshot := jsonb_set(
        new.proposed_snapshot,
        '{revised_payment_amounts}',
        public.check_listing_request_change_order_reduction(
          new.agreement_id,
          new.revised_total_amount,
          new.proposed_snapshot -> 'revised_payment_amounts'
        )
      );
    end if;

    return new;
  end if;

  -- Accepted: check once more, then change the amounts.
  if new.status = 'buyer_accepted'
    and old.status is distinct from new.status
  then
    begin
      revised := public.check_listing_request_change_order_reduction(
        new.agreement_id,
        new.revised_total_amount,
        new.proposed_snapshot -> 'revised_payment_amounts'
      );
    exception
      when others then
        raise exception 'The payment plan changed after this change order was sent, so it can no longer be accepted as written. Ask the creator to withdraw it and send a new one.'
          using errcode = 'P0001';
    end;

    update public.listing_request_payment_schedule_items
    set amount = (change.value ->> 'amount')::numeric
    from jsonb_array_elements(revised) as change
    where listing_request_payment_schedule_items.id =
      (change.value ->> 'payment_schedule_item_id')::uuid;

    update public.listing_request_milestones
    set amount = (change.value ->> 'amount')::numeric
    from jsonb_array_elements(revised) as change
    where listing_request_milestones.payment_schedule_item_id =
      (change.value ->> 'payment_schedule_item_id')::uuid;

    update public.listing_request_agreement_items
    set price_amount = (change.value ->> 'amount')::numeric
    from jsonb_array_elements(revised) as change
    inner join public.listing_request_payment_schedule_items
      on listing_request_payment_schedule_items.id =
        (change.value ->> 'payment_schedule_item_id')::uuid
    where listing_request_agreement_items.id =
      listing_request_payment_schedule_items.agreement_item_id;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_listing_request_change_order_reduction()
  from public, anon, authenticated;

drop trigger if exists listing_request_change_orders_check_reduction
  on public.listing_request_change_orders;
create trigger listing_request_change_orders_check_reduction
  before insert or update on public.listing_request_change_orders
  for each row execute function public.handle_listing_request_change_order_reduction();

drop trigger if exists listing_request_change_orders_apply_reduction
  on public.listing_request_change_orders;
create trigger listing_request_change_orders_apply_reduction
  after update on public.listing_request_change_orders
  for each row execute function public.handle_listing_request_change_order_reduction();
