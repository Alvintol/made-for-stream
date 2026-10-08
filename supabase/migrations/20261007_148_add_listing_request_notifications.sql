-- Email notifications for every step of a commission (NOTIF-001..003,
-- docs/support/messaging/commission-notifications.md).
--
-- Until now only receipts, non-response notices and payout emails were sent.
-- A creator was never told a request had arrived, and a buyer was never told
-- it was accepted, that an agreement was waiting, or that a payment was due.
--
-- How it works: triggers on the workflow tables write a row to
-- listing_request_notifications (an outbox) whenever something happens that
-- the other party must act on or know about. The API sends them
-- (POST /api/notifications/drain, and hourly from the ops job, which also
-- adds reminders for things left waiting). The database decides WHAT is
-- sent and to WHOM; the API only turns a row into an email.
--
-- A notification must never block the step it describes: the enqueue
-- function swallows its own errors.

create table public.listing_request_notifications (
  id uuid primary key default gen_random_uuid(),
  listing_request_id uuid not null
    references public.listing_requests (id) on delete cascade,
  recipient_user_id uuid not null
    references auth.users (id) on delete cascade,
  -- Which email. Every kind used below has a template in
  -- api/notificationEmails.js; notificationEmails.test.js fails otherwise.
  kind text not null,
  -- One row per event per recipient, however many times a trigger fires.
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sending', 'sent', 'failed')),
  email_attempts integer not null default 0,
  email_attempted_at timestamptz,
  email_provider_message_id text,
  email_failed_reason text,
  created_at timestamptz not null default now()
);

create index listing_request_notifications_unsent_idx
  on public.listing_request_notifications (created_at)
  where email_status <> 'sent';

create index listing_request_notifications_request_idx
  on public.listing_request_notifications (listing_request_id, created_at);

-- Service role only: no policies, and no table privileges for site users.
alter table public.listing_request_notifications enable row level security;
revoke all on public.listing_request_notifications from public, anon, authenticated;

create or replace function public.enqueue_listing_request_notification(
  p_request_id uuid,
  p_recipient_user_id uuid,
  p_kind text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_request_id is null or p_recipient_user_id is null then
    return;
  end if;

  insert into public.listing_request_notifications (
    listing_request_id, recipient_user_id, kind, dedupe_key, payload
  )
  values (
    p_request_id, p_recipient_user_id, p_kind, p_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (dedupe_key) do nothing;
exception
  when others then
    -- Never fail the workflow step over its notification.
    raise warning 'NOTIF-003: could not enqueue % for request %: %',
      p_kind, p_request_id, sqlerrm;
end;
$$;

revoke execute on function public.enqueue_listing_request_notification(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Requests: received, accepted, declined, withdrawn, cancelled, completed
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  party uuid;
begin
  if tg_op = 'INSERT' then
    if new.status = 'submitted' then
      perform public.enqueue_listing_request_notification(
        new.id, new.creator_user_id, 'request_received',
        'request_received:' || new.id
      );
    end if;

    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'accepted' then
    perform public.enqueue_listing_request_notification(
      new.id, new.buyer_user_id, 'request_accepted',
      'request_accepted:' || new.id
    );
  elsif new.status = 'declined' then
    perform public.enqueue_listing_request_notification(
      new.id, new.buyer_user_id, 'request_declined',
      'request_declined:' || new.id,
      jsonb_build_object('reason', new.creator_status_reason)
    );
  elsif new.status = 'archived' and old.status = 'submitted' then
    -- Tell whoever did not archive it that it is no longer waiting.
    foreach party in array array[new.buyer_user_id, new.creator_user_id] loop
      if party is distinct from new.archived_by_user_id then
        perform public.enqueue_listing_request_notification(
          new.id, party, 'request_withdrawn',
          'request_withdrawn:' || new.id || ':' || party
        );
      end if;
    end loop;
  elsif new.status = 'cancelled' then
    -- Everyone except whoever cancelled. An administrative closure is
    -- cancelled by an admin, so both parties are told.
    foreach party in array array[new.buyer_user_id, new.creator_user_id] loop
      if party is distinct from new.cancelled_by_user_id then
        perform public.enqueue_listing_request_notification(
          new.id, party, 'request_cancelled',
          'request_cancelled:' || new.id || ':' || party,
          jsonb_build_object('reason', new.cancellation_reason)
        );
      end if;
    end loop;
  elsif new.status = 'completed' then
    foreach party in array array[new.buyer_user_id, new.creator_user_id] loop
      perform public.enqueue_listing_request_notification(
        new.id, party, 'request_completed',
        'request_completed:' || new.id || ':' || party
      );
    end loop;
  end if;

  return new;
end;
$$;

create trigger listing_requests_notify
  after insert or update of status on public.listing_requests
  for each row execute function public.notify_listing_request_change();

-- ---------------------------------------------------------------------
-- Agreements: sent to the buyer, answered to the creator
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_agreement_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'sent' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.buyer_user_id, 'agreement_sent',
      'agreement_sent:' || new.id
    );
  elsif new.status = 'buyer_accepted' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'agreement_accepted',
      'agreement_accepted:' || new.id
    );
  elsif new.status = 'buyer_declined' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'agreement_declined',
      'agreement_declined:' || new.id
    );
  end if;

  return new;
end;
$$;

create trigger listing_request_agreements_notify
  after insert or update of status on public.listing_request_agreements
  for each row execute function public.notify_listing_request_agreement_change();

-- ---------------------------------------------------------------------
-- Change orders (scope, price, timeline or extension changes)
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_change_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  details jsonb := jsonb_build_object('title', new.title);
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'sent' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.buyer_user_id, 'change_order_sent',
      'change_order_sent:' || new.id, details
    );
  elsif new.status = 'buyer_accepted' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'change_order_accepted',
      'change_order_accepted:' || new.id, details
    );
  elsif new.status = 'buyer_declined' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'change_order_declined',
      'change_order_declined:' || new.id, details
    );
  end if;

  return new;
end;
$$;

create trigger listing_request_change_orders_notify
  after insert or update of status on public.listing_request_change_orders
  for each row execute function public.notify_listing_request_change_order_change();

-- ---------------------------------------------------------------------
-- Payments: due (buyer), received (creator), refunded (both), disputed
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  details jsonb := jsonb_build_object(
    'title', new.metadata ->> 'payment_title',
    'currency', new.currency
  );
begin
  if tg_op = 'INSERT' then
    if new.status = 'requires_checkout' then
      perform public.enqueue_listing_request_notification(
        new.listing_request_id, new.payer_user_id, 'payment_required',
        'payment_required:' || new.id,
        details || jsonb_build_object('amount_cents', new.total_checkout_cents)
      );
    end if;

    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'paid' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'payment_received',
      'payment_received:' || new.id,
      details || jsonb_build_object('amount_cents', new.base_amount_cents)
    );
  elsif new.status in ('refunded', 'partially_refunded') then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.payer_user_id, 'payment_refunded',
      'payment_refunded:' || new.id || ':' || new.status || ':buyer', details
    );
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'payment_refunded',
      'payment_refunded:' || new.id || ':' || new.status || ':creator', details
    );
  elsif new.status = 'disputed' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'payment_disputed',
      'payment_disputed:' || new.id, details
    );
  end if;

  return new;
end;
$$;

create trigger listing_request_payments_notify
  after insert or update of status on public.listing_request_payments
  for each row execute function public.notify_listing_request_payment_change();

-- ---------------------------------------------------------------------
-- Milestones: submitted (buyer), approved or sent back (creator)
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_milestone_submission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  details jsonb;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select jsonb_build_object('title', milestone.title)
    into details
    from public.listing_request_milestones as milestone
   where milestone.id = new.milestone_id;

  if new.status = 'submitted' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.buyer_user_id, 'milestone_submitted',
      'milestone_submitted:' || new.id, details
    );
  elsif new.status = 'buyer_approved' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'milestone_approved',
      'milestone_approved:' || new.id, details
    );
  elsif new.status = 'revision_requested' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'milestone_revision_requested',
      'milestone_revision_requested:' || new.id,
      coalesce(details, '{}'::jsonb)
        || jsonb_build_object('reason', new.revision_request_reason)
    );
  end if;

  return new;
end;
$$;

create trigger listing_request_milestone_submissions_notify
  after insert or update of status on public.listing_request_milestone_submissions
  for each row execute function public.notify_listing_request_milestone_submission_change();

-- ---------------------------------------------------------------------
-- Final delivery: submitted (buyer), sent back (creator). Approval
-- completes the request, which sends request_completed to both.
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_final_delivery_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'submitted' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.buyer_user_id, 'final_delivery_submitted',
      'final_delivery_submitted:' || new.id
    );
  elsif new.status = 'revision_requested' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'final_delivery_revision_requested',
      'final_delivery_revision_requested:' || new.id || ':' || new.updated_at,
      jsonb_build_object('reason', new.revision_request_reason)
    );
  end if;

  return new;
end;
$$;

create trigger listing_request_final_deliveries_notify
  after insert or update of status on public.listing_request_final_deliveries
  for each row execute function public.notify_listing_request_final_delivery_change();

-- ---------------------------------------------------------------------
-- Cancellation after payment: statement needed, statement ready, disputed.
-- An accepted statement cancels the request, which sends request_cancelled.
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_cancellation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'pending_creator_statement' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'cancellation_statement_needed',
      'cancellation_statement_needed:' || new.id,
      jsonb_build_object('reason', new.reason)
    );
  elsif new.status = 'pending_buyer_response' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.buyer_user_id, 'cancellation_statement_ready',
      'cancellation_statement_ready:' || new.id,
      jsonb_build_object('reason', new.reason)
    );
  elsif new.status = 'disputed' then
    perform public.enqueue_listing_request_notification(
      new.listing_request_id, new.creator_user_id, 'cancellation_disputed',
      'cancellation_disputed:' || new.id
    );
  end if;

  return new;
end;
$$;

create trigger listing_request_cancellation_proposals_notify
  after insert or update of status on public.listing_request_cancellation_proposals
  for each row execute function public.notify_listing_request_cancellation_change();

-- ---------------------------------------------------------------------
-- Progress updates: the buyer is told the creator posted one
-- ---------------------------------------------------------------------
create or replace function public.notify_listing_request_progress_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_listing_request_notification(
    new.listing_request_id,
    (select buyer_user_id from public.listing_requests where id = new.listing_request_id),
    'progress_update_posted',
    'progress_update_posted:' || new.id,
    jsonb_build_object('title', new.title)
  );

  return new;
end;
$$;

create trigger listing_request_progress_updates_notify
  after insert on public.listing_request_progress_updates
  for each row execute function public.notify_listing_request_progress_update();

-- ---------------------------------------------------------------------
-- Reminders, run hourly by the ops job. Each fires once at 3 days and once
-- at 7 days of waiting. The one-day window means that switching this on
-- does not email about everything that was already old.
-- ---------------------------------------------------------------------
create or replace function public.enqueue_listing_request_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  before_count bigint;
  after_count bigint;
begin
  select count(*) into before_count from public.listing_request_notifications;

  -- A send that was claimed but never finished (the API stopped mid-send).
  update public.listing_request_notifications
     set email_status = 'pending'
   where email_status = 'sending'
     and email_attempted_at < now() - interval '15 minutes';

  insert into public.listing_request_notifications (
    listing_request_id, recipient_user_id, kind, dedupe_key, payload
  )
  select due.listing_request_id, due.recipient_user_id, due.kind,
         due.kind || ':' || due.subject_id || ':' || stage.label,
         due.payload || jsonb_build_object('waiting_days', stage.days)
    from (values (3, '3d'), (7, '7d')) as stage (days, label)
   cross join lateral (
      -- A request the creator has not answered.
      select request.id as listing_request_id, request.creator_user_id as recipient_user_id,
             'request_reminder' as kind, request.id::text as subject_id,
             '{}'::jsonb as payload, request.created_at as waiting_since
        from public.listing_requests as request
       where request.status = 'submitted'

      union all
      -- An agreement the buyer has not answered.
      select agreement.listing_request_id, agreement.buyer_user_id,
             'agreement_reminder', agreement.id::text, '{}'::jsonb, agreement.sent_at
        from public.listing_request_agreements as agreement
        join public.listing_requests as request
          on request.id = agreement.listing_request_id and request.status = 'accepted'
       where agreement.status = 'sent'

      union all
      -- A payment the buyer has not made.
      select payment.listing_request_id, payment.payer_user_id,
             'payment_reminder', payment.id::text,
             jsonb_build_object(
               'title', payment.metadata ->> 'payment_title',
               'amount_cents', payment.total_checkout_cents,
               'currency', payment.currency
             ),
             payment.created_at
        from public.listing_request_payments as payment
        join public.listing_requests as request
          on request.id = payment.listing_request_id and request.status = 'accepted'
       where payment.status in ('requires_checkout', 'checkout_opened')

      union all
      -- Milestone work the buyer has not reviewed.
      select milestone.listing_request_id, milestone.buyer_user_id,
             'milestone_review_reminder', milestone.id::text,
             jsonb_build_object('title', milestone.title),
             milestone.latest_submitted_at
        from public.listing_request_milestones as milestone
        join public.listing_requests as request
          on request.id = milestone.listing_request_id and request.status = 'accepted'
       where milestone.status = 'submitted'

      union all
      -- A final delivery the buyer has not reviewed.
      select delivery.listing_request_id, delivery.buyer_user_id,
             'final_delivery_review_reminder', delivery.id::text, '{}'::jsonb,
             delivery.submitted_at
        from public.listing_request_final_deliveries as delivery
        join public.listing_requests as request
          on request.id = delivery.listing_request_id and request.status = 'accepted'
       where delivery.status = 'submitted'

      union all
      -- A progress update the creator owes under the agreement.
      select agreement.listing_request_id, agreement.creator_user_id,
             'progress_update_overdue',
             agreement.id::text || ':' || to_char(agreement.next_progress_update_due_at, 'YYYYMMDD'),
             '{}'::jsonb, agreement.next_progress_update_due_at
        from public.listing_request_agreements as agreement
        join public.listing_requests as request
          on request.id = agreement.listing_request_id and request.status = 'accepted'
       where agreement.status = 'buyer_accepted'
         and agreement.next_progress_update_due_at is not null
    ) as due
   where due.recipient_user_id is not null
     and due.waiting_since <= now() - make_interval(days => stage.days)
     and due.waiting_since > now() - make_interval(days => stage.days + 1)
  on conflict (dedupe_key) do nothing;

  select count(*) into after_count from public.listing_request_notifications;

  return (after_count - before_count)::integer;
end;
$$;

revoke execute on function public.enqueue_listing_request_reminders()
  from public, anon, authenticated;
grant execute on function public.enqueue_listing_request_reminders() to service_role;

-- Hands the API a batch to send, marking each row so that two runs at the
-- same moment cannot send the same email twice. A failed send is retried
-- up to three times, ten minutes apart.
create or replace function public.claim_listing_request_notifications(
  p_limit integer default 25
)
returns setof public.listing_request_notifications
language sql
security definer
set search_path = public
as $$
  update public.listing_request_notifications as notification
     set email_status = 'sending',
         email_attempts = notification.email_attempts + 1,
         email_attempted_at = now()
   where notification.id in (
     select candidate.id
       from public.listing_request_notifications as candidate
      where candidate.email_status = 'pending'
         or (
           candidate.email_status = 'failed'
           and candidate.email_attempts < 3
           and candidate.email_attempted_at < now() - interval '10 minutes'
         )
      order by candidate.created_at
      limit greatest(1, least(coalesce(p_limit, 25), 100))
      for update skip locked
   )
  returning notification.*;
$$;

revoke execute on function public.claim_listing_request_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.claim_listing_request_notifications(integer) to service_role;

notify pgrst, 'reload schema';
