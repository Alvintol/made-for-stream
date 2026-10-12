-- Found in the launch rehearsal (2026-10-12): the buyer was emailed
-- "<creator> sent you a message" fifteen minutes after a change order was
-- sent, although nobody had written anything. The line in the chat was the
-- automatic one ("The creator sent a project change order ..."), and the
-- change order already had its own email.
--
-- The instant path (notify_conversation_message) has always ignored automatic
-- messages. The safety net below did not: it read conversations.last_message_*,
-- which every message updates, automatic ones included. It now looks at the
-- newest message a person actually wrote. Everything else is unchanged: ten
-- minutes unread, at most two days old, written by the other participant,
-- one email per unread stretch, nothing for a muted conversation.

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
           latest.sender_user_id as sender_user_id
      from public.conversations as conversation
      join public.conversation_participants as participant
        on participant.conversation_id = conversation.id
      join lateral (
        select message.sender_user_id, message.created_at
          from public.conversation_messages as message
         where message.conversation_id = conversation.id
           and message.message_type <> 'system'
         order by message.created_at desc
         limit 1
      ) as latest on true
     where conversation.status = 'open'
       -- Cheap first cut: nothing at all happened here in two days.
       and conversation.last_message_at > now() - interval '2 days'
       and latest.created_at < now() - interval '10 minutes'
       and latest.created_at > now() - interval '2 days'
       and latest.sender_user_id <> participant.user_id
       and participant.user_id in (conversation.buyer_user_id, conversation.creator_user_id)
       and latest.sender_user_id
             in (conversation.buyer_user_id, conversation.creator_user_id)
       and (participant.last_read_at is null
            or participant.last_read_at < latest.created_at)
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
