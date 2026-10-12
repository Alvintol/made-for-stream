-- Two gaps found in the launch rehearsal (2026-10-12).
--
-- 1. A change order could propose a completion date that had already
--    passed. A new trigger refuses that when the change order is drafted or
--    sent. It leaves answering and withdrawing alone, so a change order
--    written before this migration can still be accepted, declined or
--    withdrawn.
--
-- 2. A creator who sent a change order by mistake could do nothing until
--    the buyer answered, and the open change order held up milestone
--    submissions meanwhile. withdraw_listing_request_change_order lets the
--    creator withdraw their own draft or sent change order. It is marked
--    'cancelled' (a status the table already had), stays in the history, and
--    the "waiting for the buyer's answer" hold ends, exactly as it does when
--    the buyer answers. Once the buyer has accepted or declined it can no
--    longer be withdrawn.

create or replace function public.enforce_listing_request_change_order_completion_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.changes_timeline
    and new.status in ('draft', 'sent')
    and new.revised_completion_at <= now()
    and (
      tg_op = 'INSERT'
      or new.status is distinct from old.status
      or new.revised_completion_at is distinct from old.revised_completion_at
    )
  then
    raise exception 'The revised completion date must be in the future.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_request_change_order_completion_date()
  from public, anon, authenticated;

drop trigger if exists listing_request_change_orders_enforce_completion_date
  on public.listing_request_change_orders;
create trigger listing_request_change_orders_enforce_completion_date
  before insert or update on public.listing_request_change_orders
  for each row execute function public.enforce_listing_request_change_order_completion_date();

create or replace function public.withdraw_listing_request_change_order(
  p_change_order_id uuid
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  change_order_row public.listing_request_change_orders%rowtype;
  withdrawn_at timestamptz := now();
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to withdraw a change order.'
      using errcode = '42501';
  end if;

  select *
  into change_order_row
  from public.listing_request_change_orders
  where listing_request_change_orders.id = p_change_order_id
    and listing_request_change_orders.creator_user_id = auth.uid()
    and listing_request_change_orders.status in ('draft', 'sent')
  for update;

  if not found then
    raise exception 'This change order can no longer be withdrawn. The buyer may already have answered it.'
      using errcode = 'P0001';
  end if;

  update public.listing_request_change_orders
  set
    status = 'cancelled',
    cancelled_at = withdrawn_at
  where listing_request_change_orders.id = change_order_row.id;

  update public.listing_request_timeline_holds
  set ended_at = withdrawn_at
  where listing_request_timeline_holds.listing_request_id =
      change_order_row.listing_request_id
    and listing_request_timeline_holds.agreement_id =
      change_order_row.agreement_id
    and listing_request_timeline_holds.reason =
      'change_order_response_pending'
    and listing_request_timeline_holds.ended_at is null;

  -- A draft was never shown to the buyer, so only a sent one is announced.
  if change_order_row.status = 'sent' then
    select conversations.id
    into conversation_id
    from public.conversations
    where conversations.listing_request_id =
      change_order_row.listing_request_id
    limit 1;

    if conversation_id is not null then
      insert into public.conversation_messages (
        conversation_id,
        sender_user_id,
        message_type,
        body
      )
      values (
        conversation_id,
        auth.uid(),
        'system',
        format(
          'The creator withdrew the project change order before it was answered: %s',
          change_order_row.title
        )
      );
    end if;
  end if;

  return query
  select
    listing_request_change_orders.id,
    listing_request_change_orders.listing_request_id,
    listing_request_change_orders.agreement_id,
    listing_request_change_orders.status,
    listing_request_change_orders.cancelled_at
  from public.listing_request_change_orders
  where listing_request_change_orders.id = change_order_row.id;
end;
$$;

revoke all on function public.withdraw_listing_request_change_order(uuid)
  from public, anon;
grant execute on function public.withdraw_listing_request_change_order(uuid)
  to authenticated;
