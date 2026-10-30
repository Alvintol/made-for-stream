-- Automatic chat lines in the reader's language (2026-10-30).
--
-- Automatic lines are saved as English sentences by 43 functions, several of
-- them on the payment path. The sentences stay exactly as saved: the chat is
-- the evidence record in a dispute. Each one now also carries a code and the
-- parts that vary, worked out here from the saved text, so the site can show
-- the line in French. None of those functions change.
--
-- The site shows the English text as saved when a line has no code, so a new
-- line that is missing from this list reads in English until it is added.
-- Every key below needs an entry in src/lib/i18n/messages/en.ts and fr.ts
-- (src/domain/tests/systemLines.test.ts checks them).
-- Playbook: docs/support/messaging/conversations.md (MSG-006).

create or replace function public.system_line_for(
  p_message_type text,
  p_body text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  line record;
  captured text[];
  line_values jsonb := '{}'::jsonb;
  part integer;
begin
  if p_message_type is distinct from 'system' or p_body is null then
    return null;
  end if;

  for line in
    select * from (values
      ('chat.line.requestAccepted', '^Request accepted by the creator\.$', '{}'),
      ('chat.line.requestCancelledByBuyer', '^Request cancelled by the buyer\.$', '{}'),
      ('chat.line.requestArchivedByCreator', '^Request archived by the creator\.$', '{}'),
      ('chat.line.requestArchived', '^Request archived\.$', '{}'),
      ('chat.line.requestBackToReview', '^Request moved back to under review\.$', '{}'),
      ('chat.line.requestCancelled', '^This request has been cancelled\. The conversation is now read-only\.$', '{}'),
      ('chat.line.requestDeclined', '^Conversation ended because the request was declined\.$', '{}'),
      ('chat.line.conversationEnded', '^Conversation ended\.$', '{}'),
      ('chat.line.cancelledBeforePayment', '^This request was cancelled before any payment was collected: (.*)$', '{reason}'),
      ('chat.line.agreementSentForReview', '^Project agreement sent for buyer review\.$', '{}'),
      ('chat.line.agreementAccepted', '^Project agreement accepted by the buyer\.$', '{}'),
      ('chat.line.agreementDeclined', '^Project agreement declined by the buyer\.$', '{}'),
      ('chat.line.agreementSent', '^The creator sent a project agreement for buyer review\.$', '{}'),
      ('chat.line.changeOrderSent', '^The creator sent a project change order for buyer review: (.*)$', '{title}'),
      ('chat.line.changeOrderWithdrawn', '^The creator withdrew the project change order before it was answered: (.*)$', '{title}'),
      ('chat.line.changeOrderAccepted', '^The buyer accepted the project change order: (.*)$', '{title}'),
      ('chat.line.changeOrderDeclined', '^The buyer declined the project change order: (.*)$', '{title}'),
      ('chat.line.finalSubmitted', '^The creator submitted the final project delivery for buyer review: (.*)$', '{title}'),
      ('chat.line.finalApproved', '^The buyer approved the final project delivery: (.*)$', '{title}'),
      ('chat.line.finalRevisions', '^The buyer requested revisions to the final project delivery: (.*)$', '{title}'),
      ('chat.line.finalComplete', '^The buyer approved the final delivery\. The project is complete and this conversation is now read-only\.$', '{}'),
      ('chat.line.milestoneSubmitted', '^The creator submitted milestone (\d+) for buyer review: (.*)$', '{number,title}'),
      ('chat.line.milestoneRevisions', '^The buyer requested revisions for milestone (\d+): (.*)$', '{number,title}'),
      ('chat.line.milestoneApproved', '^The buyer approved milestone (\d+): (.*)\. The milestone payment is now required\.$', '{number,title}'),
      ('chat.line.progressPosted', '^The creator posted a project progress update: (.*)$', '{title}'),
      ('chat.line.startPaid', '^Stripe confirmed the required starting payment\. Work may now begin\.$', '{}'),
      ('chat.line.milestonePaid', '^Stripe confirmed payment for milestone (\d+): (.*)\. The creator can continue with the next milestone\.$', '{number,title}'),
      ('chat.line.changeOrderPaid', '^Stripe confirmed the required change-order payment: (.*)\.$', '{title}'),
      ('chat.line.finalPaid', '^Stripe confirmed the required final-balance payment: (.*)\.$', '{title}'),
      ('chat.line.adminStartPaid', '^An administrator manually confirmed the required starting payment, bypassing Stripe verification\. Work may now begin\.$', '{}'),
      ('chat.line.adminMilestonePaid', '^An administrator manually confirmed payment for milestone (\d+): (.*), bypassing Stripe verification\. The creator can continue with the next milestone\.$', '{number,title}'),
      ('chat.line.adminChangeOrderPaid', '^An administrator manually confirmed the required change-order payment: (.*), bypassing Stripe verification\.$', '{title}'),
      ('chat.line.adminFinalPaid', '^An administrator manually confirmed the required final-balance payment: (.*), bypassing Stripe verification\.$', '{title}'),
      ('chat.line.imagesAllowed', '^Creator allowed buyer image uploads\.$', '{}'),
      ('chat.line.imagesDisabled', '^Creator disabled buyer image uploads\.$', '{}'),
      ('chat.line.imagesRequested', '^Buyer requested permission to send images\.$', '{}'),
      ('chat.line.earlyReview', '^An early review was requested for this project\. Made for Stream will review and decide\.$', '{}'),
      ('chat.line.proposedWithStatement', '^A cancellation was proposed: (.*)\. An itemised earned-value statement is attached; the buyer can now accept or dispute it\.$', '{reason}'),
      ('chat.line.proposedAwaitingStatement', '^A cancellation was proposed: (.*)\. The creator has until (.*) to provide an itemised earned-value statement\.$', '{reason,date}'),
      ('chat.line.statementSubmitted', '^The creator submitted an itemised earned-value statement\. The buyer can now accept or dispute it\.$', '{}'),
      ('chat.line.statementAccepted', '^The buyer accepted the cancellation statement\. Unpaid items are cancelled and any unearned prepaid amounts are flagged for refund\.$', '{}'),
      ('chat.line.statementDisputed', '^The buyer disputed the cancellation statement: (.*)\. Made for Stream will review and decide\.$', '{reason}'),
      ('chat.line.warningSent', '^A cancellation warning was sent: (.*)\. Unless the other person replies here or takes the next step in the project by (.*), this commission will be cancelled automatically\.$', '{reason,date}'),
      ('chat.line.warningAnswered', '^The cancellation warning was answered, so its timer has stopped\. The commission continues\.$', '{}'),
      ('chat.line.warningWithdrawn', '^The cancellation warning was withdrawn\. The commission continues\.$', '{}'),
      ('chat.line.autoCancelledRefund', '^This commission was cancelled automatically: No reply to a cancellation warning within (\d+) days\. Amounts paid for work not reached are being refunded to the buyer\.$', '{days}'),
      ('chat.line.autoCancelledKept', '^This commission was cancelled automatically: No reply to a cancellation warning within (\d+) days\. Amounts already paid stay with the creator\.$', '{days}'),
      ('chat.line.autoCancelled', '^This commission was cancelled automatically: No reply to a cancellation warning within (\d+) days\.$', '{days}'),
      ('chat.line.firstNotice', '^A first notice was sent: (.*)\. A reply is needed by (.*) or a final notice may follow\.$', '{reason,date}'),
      ('chat.line.finalNotice', '^A final notice was sent, granting 7 further days \(until (.*)\)\. Administrative closure may be requested after that if there is still no substantive reply\.$', '{date}'),
      ('chat.line.adminClosedRefund', '^This request was administratively closed \(([a-z_]+)\): (.*)\. This is not a finding that the work delivered so far was satisfactory\. Unearned prepaid amounts have been flagged for refund\.$', '{branch,reason}'),
      ('chat.line.adminClosedKept', '^This request was administratively closed \(([a-z_]+)\): (.*)\. This is not a finding that the work delivered so far was satisfactory\. Unearned prepaid amounts remain available to refund on request\.$', '{branch,reason}'),
      ('chat.line.adminClosed', '^This request was administratively closed \(([a-z_]+)\): (.*)\. This is not a finding that the work delivered so far was satisfactory\.$', '{branch,reason}'),
      ('chat.line.offSiteSent', '^The creator reports that the work for (.*) was also sent outside Made for Stream, by: (.*)\. Made for Stream has no copy of what was sent and cannot confirm that it arrived\.$', '{subject,methods}'),
      ('chat.line.offSiteConfirmed', '^The buyer confirmed receiving the work for (.*) that was sent outside Made for Stream\.$', '{subject}'),
      ('chat.line.offSiteMissing', '^The buyer says the work for (.*), sent outside Made for Stream, has not arrived\.$', '{subject}'),
      ('chat.line.offSiteMilestoneApproved', '^The buyer approved (.*), which confirms that the work sent outside Made for Stream arrived\.$', '{subject}'),
      ('chat.line.offSiteRecorded', '^Made for Stream recorded the work for (.*) as received\. Note: (.*)$', '{subject,note}')
    ) as lines(key, pattern, names)
  loop
    captured := pg_catalog.regexp_match(p_body, line.pattern);

    if captured is not null then
      for part in 1 .. coalesce(pg_catalog.array_length(line.names::text[], 1), 0) loop
        line_values := line_values
          || pg_catalog.jsonb_build_object((line.names::text[])[part], captured[part]);
      end loop;

      return pg_catalog.jsonb_build_object('key', line.key, 'values', line_values);
    end if;
  end loop;

  return null;
exception
  when others then
    -- A payment or a status change writes these lines. Working out the code
    -- must never stop one: the line just reads in English.
    return null;
end;
$$;

-- Generated, so existing lines get their code now and nobody can set one.
alter table public.conversation_messages
  add column if not exists system_line jsonb
  generated always as (public.system_line_for(message_type, body)) stored;

comment on column public.conversation_messages.system_line is
  'For an automatic line: its translation key and the parts that vary. The body stays the saved English text.';

alter table public.conversations
  add column if not exists last_message_system_line jsonb;

comment on column public.conversations.last_message_system_line is
  'system_line of the latest message, for the inbox preview. Null for a message someone wrote.';

create or replace function public.handle_conversation_message_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  preview text;
begin
  preview :=
    case
      when new.message_type = any (array['attachment'::text, 'mixed'::text])
        and coalesce(btrim(new.body), '') = ''
        then '[Attachment]'
      else left(btrim(coalesce(new.body, '')), 180)
    end;

  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_sender_user_id = new.sender_user_id,
    last_message_preview = preview,
    last_message_system_line = new.system_line,
    updated_at = now()
  where id = new.conversation_id;

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    new.conversation_id,
    new.sender_user_id,
    'message_sent',
    jsonb_build_object(
      'message_id', new.id,
      'message_type', new.message_type
    )
  );

  return new;
end;
$$;

-- The inbox sorts on updated_at, so filling this in must not move anything.
alter table public.conversations disable trigger conversations_set_updated_at;

update public.conversations as conversation
   set last_message_system_line = message.system_line
  from public.conversation_messages as message
 where message.conversation_id = conversation.id
   and message.message_type = 'system'
   and message.created_at = conversation.last_message_at
   and left(btrim(message.body), 180) = conversation.last_message_preview;

alter table public.conversations enable trigger conversations_set_updated_at;
