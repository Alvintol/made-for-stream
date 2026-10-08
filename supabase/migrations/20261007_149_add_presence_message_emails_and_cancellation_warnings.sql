-- Three things (docs/support/messaging/commission-notifications.md NOTIF-005,
-- docs/support/requests/cancellation-warnings.md WARN-001..004):
--
-- 1. Who is online. One table and two functions that every "is this person
--    here right now?" question goes through. Today the website reports
--    activity; when live chat over websockets arrives, its presence channel
--    reports through the same function and nothing else has to change.
-- 2. Email for chat messages: always for the first message of a new
--    conversation, otherwise only when the recipient is not online.
-- 3. Cancellation warnings: either side of an active commission can start a
--    7, 10 or 14 day timer. If the other person neither replies in the
--    chat nor takes a step in the project (pays, accepts, approves,
--    submits) before it runs out, the commission is cancelled
--    automatically. Nothing is ever cancelled unless a person started that
--    timer.

-- =====================================================================
-- 1. Presence
-- =====================================================================
create table public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

-- Nobody reads this table directly: who is online is not public.
alter table public.user_presence enable row level security;
revoke all on public.user_presence from public, anon, authenticated;

-- "I am here." Called by the website on activity, and later by the live
-- chat connection. Writes at most once every 30 seconds per person.
create or replace function public.touch_user_presence()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_presence (user_id, last_seen_at)
  select auth.uid(), now()
   where auth.uid() is not null
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at
    where public.user_presence.last_seen_at < now() - interval '30 seconds';
$$;

revoke execute on function public.touch_user_presence() from public, anon;
grant execute on function public.touch_user_presence() to authenticated;

-- The one definition of "online": seen within the last five minutes.
create or replace function public.is_user_online(
  p_user_id uuid,
  p_within interval default interval '5 minutes'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.user_presence
     where user_id = p_user_id
       and last_seen_at > now() - p_within
  );
$$;

-- Internal for now. Granting this to site users is what would let a chat
-- show an "online" dot; that is a deliberate later step.
revoke execute on function public.is_user_online(uuid, interval)
  from public, anon, authenticated;

-- =====================================================================
-- 2. Chat message emails
-- =====================================================================
-- The notification queue (20261007_148) now also carries emails about
-- conversations that have no commission (inquiries).
alter table public.listing_request_notifications
  alter column listing_request_id drop not null,
  add column conversation_id uuid
    references public.conversations (id) on delete cascade,
  add constraint listing_request_notifications_subject_check
    check (listing_request_id is not null or conversation_id is not null);

drop function public.enqueue_listing_request_notification(uuid, uuid, text, text, jsonb);

create or replace function public.enqueue_listing_request_notification(
  p_request_id uuid,
  p_recipient_user_id uuid,
  p_kind text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_conversation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_user_id is null
     or (p_request_id is null and p_conversation_id is null)
  then
    return;
  end if;

  insert into public.listing_request_notifications (
    listing_request_id, conversation_id, recipient_user_id, kind, dedupe_key, payload
  )
  values (
    p_request_id, p_conversation_id, p_recipient_user_id, p_kind, p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (dedupe_key) do nothing;
exception
  when others then
    -- Never fail the step over its notification.
    raise warning 'NOTIF-003: could not enqueue % for request %: %',
      p_kind, coalesce(p_request_id, p_conversation_id), sqlerrm;
end;
$$;

revoke execute on function public.enqueue_listing_request_notification(uuid, uuid, text, text, jsonb, uuid)
  from public, anon, authenticated;

-- Queues the email for one unread stretch of a conversation. The key
-- includes when the recipient last read it, so however many messages
-- arrive, they get one email until they come back and read.
create or replace function public.enqueue_unread_message_notification(
  p_conversation_id uuid,
  p_recipient_user_id uuid,
  p_sender_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation public.conversations%rowtype;
  participant public.conversation_participants%rowtype;
begin
  select * into conversation
    from public.conversations where id = p_conversation_id;

  select * into participant
    from public.conversation_participants
   where conversation_id = p_conversation_id
     and user_id = p_recipient_user_id;

  -- Someone who muted the conversation asked not to hear about it.
  if participant.muted_at is not null then
    return;
  end if;

  perform public.enqueue_listing_request_notification(
    conversation.listing_request_id,
    p_recipient_user_id,
    'message_received',
    'message_received:' || p_conversation_id || ':' || p_recipient_user_id || ':'
      || coalesce(extract(epoch from participant.last_read_at)::bigint, 0),
    jsonb_build_object(
      'sender', (
        select coalesce(nullif(btrim(display_name), ''), handle)
          from public.profiles where user_id = p_sender_user_id
      ),
      'subject', conversation.subject
    ),
    p_conversation_id
  );
end;
$$;

revoke execute on function public.enqueue_unread_message_notification(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.notify_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation public.conversations%rowtype;
  recipient uuid;
begin
  -- Automatic messages ("A first notice was sent...") are not chat.
  if new.message_type = 'system' then
    return new;
  end if;

  select * into conversation
    from public.conversations where id = new.conversation_id;

  recipient := case new.sender_user_id
    when conversation.buyer_user_id then conversation.creator_user_id
    when conversation.creator_user_id then conversation.buyer_user_id
    else null
  end;

  if recipient is null then
    return new;
  end if;

  -- A reply in the chat answers an open cancellation warning (section 3).
  perform public.stop_listing_request_cancellation_warning(
    conversation.listing_request_id, new.sender_user_id, new.id
  );

  if conversation.listing_request_id is null
     and not exists (
       select 1
         from public.conversation_messages as earlier
        where earlier.conversation_id = new.conversation_id
          and earlier.message_type <> 'system'
          and earlier.id <> new.id
     )
  then
    -- The first message of a new inquiry: always emailed. (A commission's
    -- conversation starts with the request_received email instead.)
    perform public.enqueue_listing_request_notification(
      null, recipient, 'conversation_started',
      'conversation_started:' || new.conversation_id,
      jsonb_build_object(
        'sender', (
          select coalesce(nullif(btrim(display_name), ''), handle)
            from public.profiles where user_id = new.sender_user_id
        ),
        'subject', conversation.subject
      ),
      new.conversation_id
    );
  elsif not public.is_user_online(recipient) then
    perform public.enqueue_unread_message_notification(
      new.conversation_id, recipient, new.sender_user_id
    );
  end if;

  return new;
exception
  when others then
    -- A chat message must never fail to send because of this.
    raise warning 'NOTIF-005: message notification failed for conversation %: %',
      new.conversation_id, sqlerrm;
    return new;
end;
$$;

-- Hourly safety net: someone who looked online when a message arrived but
-- had in fact left, and never read it. Ten minutes unread is enough.
create or replace function public.enqueue_unread_message_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  waiting record;
  queued integer := 0;
begin
  for waiting in
    select conversation.id as conversation_id,
           participant.user_id as recipient_user_id,
           conversation.last_message_sender_user_id as sender_user_id
      from public.conversations as conversation
      join public.conversation_participants as participant
        on participant.conversation_id = conversation.id
     where conversation.status = 'open'
       and conversation.last_message_at < now() - interval '10 minutes'
       and conversation.last_message_at > now() - interval '2 days'
       and conversation.last_message_sender_user_id is not null
       and conversation.last_message_sender_user_id <> participant.user_id
       and participant.user_id in (conversation.buyer_user_id, conversation.creator_user_id)
       and conversation.last_message_sender_user_id
             in (conversation.buyer_user_id, conversation.creator_user_id)
       and (participant.last_read_at is null
            or participant.last_read_at < conversation.last_message_at)
  loop
    perform public.enqueue_unread_message_notification(
      waiting.conversation_id, waiting.recipient_user_id, waiting.sender_user_id
    );
    queued := queued + 1;
  end loop;

  return queued;
end;
$$;

revoke execute on function public.enqueue_unread_message_notifications()
  from public, anon, authenticated;
grant execute on function public.enqueue_unread_message_notifications() to service_role;

-- =====================================================================
-- 3. Cancellation warnings
-- =====================================================================
create table public.listing_request_cancellation_warnings (
  id uuid primary key default gen_random_uuid(),
  listing_request_id uuid not null
    references public.listing_requests (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id),
  recipient_user_id uuid not null references auth.users (id),
  requested_action text not null
    check (char_length(btrim(requested_action)) between 10 and 1000),
  -- The sender's choice. People have different thresholds for waiting.
  response_days integer not null check (response_days in (7, 10, 14)),
  status text not null default 'open'
    check (status in ('open', 'answered', 'withdrawn', 'cancelled_request', 'lapsed')),
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  answered_at timestamptz,
  answered_by_message_id uuid references public.conversation_messages (id),
  closed_at timestamptz,
  check (sender_user_id <> recipient_user_id),
  check (expires_at > sent_at)
);

-- One timer at a time per commission.
create unique index listing_request_cancellation_warnings_one_open_idx
  on public.listing_request_cancellation_warnings (listing_request_id)
  where status = 'open';

alter table public.listing_request_cancellation_warnings enable row level security;

create policy "warning participants can read"
  on public.listing_request_cancellation_warnings
  for select to authenticated
  using (sender_user_id = auth.uid() or recipient_user_id = auth.uid());

create policy "admins can read warnings"
  on public.listing_request_cancellation_warnings
  for select to authenticated
  using (public.is_admin_user(auth.uid()));

revoke insert, update, delete on public.listing_request_cancellation_warnings
  from public, anon, authenticated;

-- Stops the timer when the person it was sent to responds: with a chat
-- message, or by doing something in the project. Tells both sides in the
-- chat and emails the sender. Does nothing when no warning is running or
-- the actor is not its recipient.
create or replace function public.stop_listing_request_cancellation_warning(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  warning public.listing_request_cancellation_warnings%rowtype;
  conversation_id_value uuid;
begin
  if p_request_id is null or p_actor_user_id is null then
    return;
  end if;

  update public.listing_request_cancellation_warnings as open_warning
     set status = 'answered',
         answered_at = now(),
         answered_by_message_id = p_message_id
   where open_warning.listing_request_id = p_request_id
     and open_warning.recipient_user_id = p_actor_user_id
     and open_warning.status = 'open'
  returning * into warning;

  if not found then
    return;
  end if;

  select conversation.id into conversation_id_value
    from public.conversations as conversation
   where conversation.listing_request_id = p_request_id
   limit 1;

  if conversation_id_value is not null then
    insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
    values (
      conversation_id_value, p_actor_user_id, 'system',
      'The cancellation warning was answered, so its timer has stopped. The commission continues.'
    );
  end if;

  perform public.enqueue_listing_request_notification(
    p_request_id, warning.sender_user_id, 'cancellation_warning_answered',
    'cancellation_warning_answered:' || warning.id
  );
end;
$$;

revoke execute on function public.stop_listing_request_cancellation_warning(uuid, uuid, uuid)
  from public, anon, authenticated;

-- Doing what was asked counts as an answer: no message is needed. Whoever
-- makes a change to the project is the signed-in person; a payment turning
-- paid is recorded by the API on the payer's behalf, so there it is the
-- payer. Changes made by the hourly job have no signed-in person and stop
-- nothing.
create or replace function public.stop_cancellation_warning_on_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_table_name = 'listing_request_payments'
     and tg_op = 'UPDATE'
     and new.status = 'paid'
     and old.status is distinct from 'paid'
  then
    actor := new.payer_user_id;
  end if;

  perform public.stop_listing_request_cancellation_warning(new.listing_request_id, actor);

  return new;
exception
  when others then
    -- Never block a payment or a project step over this.
    raise warning 'WARN-005: could not stop a cancellation warning for request %: %',
      new.listing_request_id, sqlerrm;
    return new;
end;
$$;

create trigger listing_request_agreements_stop_warning
  after insert or update on public.listing_request_agreements
  for each row execute function public.stop_cancellation_warning_on_activity();

create trigger listing_request_change_orders_stop_warning
  after insert or update on public.listing_request_change_orders
  for each row execute function public.stop_cancellation_warning_on_activity();

create trigger listing_request_payments_stop_warning
  after insert or update on public.listing_request_payments
  for each row execute function public.stop_cancellation_warning_on_activity();

create trigger listing_request_milestone_submissions_stop_warning
  after insert or update on public.listing_request_milestone_submissions
  for each row execute function public.stop_cancellation_warning_on_activity();

create trigger listing_request_final_deliveries_stop_warning
  after insert or update on public.listing_request_final_deliveries
  for each row execute function public.stop_cancellation_warning_on_activity();

create trigger listing_request_progress_updates_stop_warning
  after insert or update on public.listing_request_progress_updates
  for each row execute function public.stop_cancellation_warning_on_activity();

create trigger listing_request_cancellation_proposals_stop_warning
  after insert or update on public.listing_request_cancellation_proposals
  for each row execute function public.stop_cancellation_warning_on_activity();

-- Now that the table exists, attach the chat trigger that refers to it.
create trigger conversation_messages_notify
  after insert on public.conversation_messages
  for each row execute function public.notify_conversation_message();

-- An automatic closure records the warning that caused it. For these rows
-- admin_user_id holds the person who sent the warning, not an admin:
-- cancellation_warning_id being set is what marks the row as automatic.
alter table public.listing_request_closures
  add column cancellation_warning_id uuid
    references public.listing_request_cancellation_warnings (id);

do $$
declare
  old_check text;
begin
  select conname into old_check
    from pg_constraint
   where conrelid = 'public.listing_request_closures'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%final_notice_id IS NOT NULL%';

  if old_check is not null then
    execute format('alter table public.listing_request_closures drop constraint %I', old_check);
  end if;
end;
$$;

alter table public.listing_request_closures
  add constraint listing_request_closures_basis_check check (
    final_notice_id is not null
    or early_review_flag_id is not null
    or cancellation_warning_id is not null
  );

create or replace function public.send_listing_request_cancellation_warning(
  p_request_id uuid,
  p_requested_action text,
  p_response_days integer
)
returns public.listing_request_cancellation_warnings
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_requests%rowtype;
  clean_action text := nullif(btrim(coalesce(p_requested_action, '')), '');
  warning public.listing_request_cancellation_warnings%rowtype;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send a cancellation warning.'
      using errcode = '42501';
  end if;

  if p_response_days is null or p_response_days not in (7, 10, 14) then
    raise exception 'WARN-001: Choose 7, 10 or 14 days for the other person to respond.'
      using errcode = '22023';
  end if;

  if clean_action is null or char_length(clean_action) not between 10 and 1000 then
    raise exception 'WARN-001: Say what you need from the other person, in 10 to 1000 characters.'
      using errcode = '22023';
  end if;

  select * into request_row
    from public.listing_requests
   where id = p_request_id
     and (buyer_user_id = auth.uid() or creator_user_id = auth.uid())
     for update;

  if not found then
    raise exception 'Listing request not found or not accessible.'
      using errcode = 'P0001';
  end if;

  if request_row.status <> 'accepted' then
    raise exception 'WARN-002: A cancellation warning can only be sent on an active commission.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.listing_request_cancellation_warnings
     where listing_request_id = p_request_id and status = 'open'
  ) then
    raise exception 'WARN-002: A cancellation warning is already running on this commission.'
      using errcode = 'P0001';
  end if;

  insert into public.listing_request_cancellation_warnings (
    listing_request_id, sender_user_id, recipient_user_id,
    requested_action, response_days, expires_at
  )
  values (
    p_request_id,
    auth.uid(),
    case when auth.uid() = request_row.buyer_user_id
         then request_row.creator_user_id else request_row.buyer_user_id end,
    clean_action,
    p_response_days,
    now() + make_interval(days => p_response_days)
  )
  returning * into warning;

  select id into conversation_id
    from public.conversations where listing_request_id = p_request_id limit 1;

  if conversation_id is not null then
    insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
    values (
      conversation_id, auth.uid(), 'system',
      format(
        'A cancellation warning was sent: %s. Unless the other person replies here or takes the next step in the project by %s, this commission will be cancelled automatically.',
        clean_action, to_char(warning.expires_at, 'YYYY-MM-DD HH24:MI TZ')
      )
    );
  end if;

  perform public.enqueue_listing_request_notification(
    p_request_id, warning.recipient_user_id, 'cancellation_warning',
    'cancellation_warning:' || warning.id,
    jsonb_build_object(
      'reason', clean_action,
      'response_days', p_response_days,
      'expires_at', warning.expires_at
    )
  );

  return warning;
end;
$$;

revoke execute on function public.send_listing_request_cancellation_warning(uuid, text, integer)
  from public, anon;
grant execute on function public.send_listing_request_cancellation_warning(uuid, text, integer)
  to authenticated;

-- The sender can call it off at any time before it runs out.
create or replace function public.withdraw_listing_request_cancellation_warning(
  p_warning_id uuid
)
returns public.listing_request_cancellation_warnings
language plpgsql
security definer
set search_path = public
as $$
declare
  warning public.listing_request_cancellation_warnings%rowtype;
  conversation_id uuid;
begin
  update public.listing_request_cancellation_warnings
     set status = 'withdrawn', closed_at = now()
   where id = p_warning_id
     and sender_user_id = auth.uid()
     and status = 'open'
  returning * into warning;

  if not found then
    raise exception 'WARN-002: This cancellation warning is not yours to withdraw, or is no longer running.'
      using errcode = 'P0001';
  end if;

  select id into conversation_id
    from public.conversations
   where listing_request_id = warning.listing_request_id limit 1;

  if conversation_id is not null then
    insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
    values (conversation_id, auth.uid(), 'system',
            'The cancellation warning was withdrawn. The commission continues.');
  end if;

  return warning;
end;
$$;

revoke execute on function public.withdraw_listing_request_cancellation_warning(uuid)
  from public, anon;
grant execute on function public.withdraw_listing_request_cancellation_warning(uuid)
  to authenticated;

-- Run hourly by the ops job. Cancels each commission whose warning ran out
-- with no reply and no step taken, and reminds recipients two days before
-- that happens.
--
-- Money, decided 2026-10-07:
--   * The buyer went quiet: the creator keeps everything already paid.
--     Deposits are not refunded. Unpaid payments are cancelled.
--   * The creator went quiet: payments for milestones the buyer approved
--     stay with the creator. Every other paid amount (a deposit, a
--     prepayment) is refunded in proportion to the milestones NOT reached:
--     all of it when no milestone was approved or the agreement has none.
--
-- Returns one row per commission cancelled, so the API can pay out the
-- refunds this flagged.
create or replace function public.close_expired_listing_request_cancellation_warnings()
returns table (
  listing_request_id uuid,
  branch text,
  flagged_refunds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  warning public.listing_request_cancellation_warnings%rowtype;
  request_row public.listing_requests%rowtype;
  close_time timestamptz := now();
  agreement_id_value uuid;
  closure_id_value uuid;
  branch_value text;
  reason_value text;
  total_milestones integer;
  reached_milestones integer;
  payment_row record;
  already_refunded integer;
  unearned integer;
  flagged integer;
  conversation_id_value uuid;
begin
  -- Reminders: two days or less to go.
  for warning in
    select * from public.listing_request_cancellation_warnings as open_warning
     where open_warning.status = 'open'
       and open_warning.expires_at > close_time
       and open_warning.expires_at <= close_time + interval '2 days'
  loop
    perform public.enqueue_listing_request_notification(
      warning.listing_request_id, warning.recipient_user_id,
      'cancellation_warning_reminder',
      'cancellation_warning_reminder:' || warning.id,
      jsonb_build_object('reason', warning.requested_action, 'expires_at', warning.expires_at)
    );
  end loop;

  for warning in
    select * from public.listing_request_cancellation_warnings as due_warning
     where due_warning.status = 'open'
       and due_warning.expires_at <= close_time
     order by due_warning.expires_at
     for update skip locked
  loop
    select * into request_row
      from public.listing_requests as request
     where request.id = warning.listing_request_id
       for update;

    -- Ended some other way while the timer ran: nothing left to cancel.
    if request_row.status <> 'accepted' then
      update public.listing_request_cancellation_warnings
         set status = 'lapsed', closed_at = close_time
       where id = warning.id;
      continue;
    end if;

    -- A reply the chat trigger somehow missed still counts.
    if public.listing_request_has_substantive_reply(
      warning.listing_request_id, warning.recipient_user_id, warning.sent_at
    ) then
      update public.listing_request_cancellation_warnings
         set status = 'answered', answered_at = close_time
       where id = warning.id;
      continue;
    end if;

    branch_value := case
      when warning.recipient_user_id = request_row.buyer_user_id then 'buyer_unresponsive'
      else 'creator_unresponsive'
    end;

    reason_value := format(
      'No reply to a cancellation warning within %s days.', warning.response_days
    );

    select agreement.id into agreement_id_value
      from public.listing_request_agreements as agreement
     where agreement.listing_request_id = request_row.id
       and agreement.status = 'buyer_accepted'
     order by agreement.version_number desc
     limit 1;

    insert into public.listing_request_closures (
      listing_request_id, branch, admin_user_id, requested_by_user_id,
      reason, cancellation_warning_id
    )
    values (
      request_row.id, branch_value, warning.sender_user_id, warning.sender_user_id,
      reason_value, warning.id
    )
    returning id into closure_id_value;

    -- How far the work got, counted before anything is cancelled.
    select count(*),
           count(*) filter (where milestone.status in ('buyer_approved', 'payment_required', 'paid'))
      into total_milestones, reached_milestones
      from public.listing_request_milestones as milestone
     where milestone.listing_request_id = request_row.id;

    -- Cancel unfinished work: the same cascade as an administrative
    -- closure (20260922_133).
    if agreement_id_value is not null then
      update public.listing_request_agreements
         set status = 'cancelled', cancelled_at = close_time
       where id = agreement_id_value;

      update public.listing_request_payment_schedule_items
         set status = 'cancelled', updated_at = close_time
       where agreement_id = agreement_id_value
         and status in ('pending', 'payment_required');

      update public.listing_request_timeline_holds
         set ended_at = close_time
       where agreement_id = agreement_id_value
         and ended_at is null;
    end if;

    update public.listing_request_milestones as milestone
       set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
     where milestone.listing_request_id = request_row.id
       and milestone.status not in ('paid', 'cancelled');

    update public.listing_request_change_orders as change_order
       set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
     where change_order.listing_request_id = request_row.id
       and change_order.status in ('draft', 'sent');

    update public.listing_request_final_deliveries as delivery
       set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
     where delivery.listing_request_id = request_row.id
       and delivery.status in ('draft', 'submitted', 'revision_requested');

    update public.listing_request_payments as payment
       set status = 'cancelled', cancelled_at = close_time, updated_at = close_time
     where payment.listing_request_id = request_row.id
       and payment.status in ('requires_checkout', 'checkout_opened');

    flagged := 0;

    if branch_value = 'creator_unresponsive' then
      for payment_row in
        select payment.id, payment.base_amount_cents
          from public.listing_request_payments as payment
         where payment.listing_request_id = request_row.id
           and payment.status in ('paid', 'partially_refunded')
           -- Paid for a milestone the buyer approved: earned.
           and payment.payment_type <> 'milestone_payment'
      loop
        select coalesce(sum(refund.base_refund_cents), 0) into already_refunded
          from public.listing_request_payment_refunds as refund
         where refund.payment_id = payment_row.id;

        unearned := payment_row.base_amount_cents - already_refunded;

        if total_milestones > 0 then
          unearned := least(
            unearned,
            round(
              payment_row.base_amount_cents::numeric
              * (total_milestones - reached_milestones) / total_milestones
            )::integer
          );
        end if;

        if unearned > 0 then
          insert into public.listing_request_closure_refund_items (
            closure_id, payment_id, unearned_amount_cents
          )
          values (closure_id_value, payment_row.id, unearned);

          flagged := flagged + 1;
        end if;
      end loop;
    end if;

    update public.listing_request_cancellation_warnings
       set status = 'cancelled_request', closed_at = close_time
     where id = warning.id;

    -- cancelled_by is the person who started the timer. The 148 trigger
    -- emails the other person; the sender is told here.
    update public.listing_requests as request
       set status = 'cancelled',
           cancelled_at = close_time,
           cancelled_by_user_id = warning.sender_user_id,
           cancellation_reason = reason_value
     where request.id = request_row.id;

    perform public.enqueue_listing_request_notification(
      request_row.id, warning.sender_user_id, 'request_cancelled',
      'request_cancelled:' || request_row.id || ':' || warning.sender_user_id,
      jsonb_build_object('reason', reason_value)
    );

    select conversation.id into conversation_id_value
      from public.conversations as conversation
     where conversation.listing_request_id = request_row.id
     limit 1;

    if conversation_id_value is not null then
      insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
      values (
        conversation_id_value, warning.sender_user_id, 'system',
        format(
          'This commission was cancelled automatically: %s%s',
          reason_value,
          case
            when flagged > 0 then ' Amounts paid for work not reached are being refunded to the buyer.'
            when branch_value = 'buyer_unresponsive' then ' Amounts already paid stay with the creator.'
            else ''
          end
        )
      );
    end if;

    listing_request_id := request_row.id;
    branch := branch_value;
    flagged_refunds := flagged;
    return next;
  end loop;
end;
$$;

revoke execute on function public.close_expired_listing_request_cancellation_warnings()
  from public, anon, authenticated;
grant execute on function public.close_expired_listing_request_cancellation_warnings()
  to service_role;

notify pgrst, 'reload schema';
