-- Live updates over websockets (Supabase Realtime), MSG-007 in
-- docs/support/messaging/conversations.md.
--
-- Until now an open chat asked the database for news every 15 seconds, the
-- inbox every 30 and the unread number on the top bar every minute. Now the
-- database tells each person the moment something of theirs changes, and the
-- website reloads only that. Polling stays as a slow safety net.
--
-- Every signal goes to one private topic per person, "user:<their id>", and
-- says only WHAT changed (ids, and a notification's kind), never message
-- text. The website then reads the change through the usual tables, so the
-- usual row-level security decides what it sees. Two signals:
--
--   message       a message (or automatic line) was added to one of your
--                 conversations: { conversation_id, message_id }
--   notification  a commission notification was queued for you, the same row
--                 that becomes an email (20261007_148):
--                 { listing_request_id, kind }
--
-- A signal must never block what it describes: both functions swallow their
-- own errors. A missed signal only means the safety-net poll picks it up.
--
-- Realtime keeps signals in daily partitions of realtime.messages, which it
-- creates itself while anyone is connected. Before anyone had ever connected
-- there were none, and realtime.send only logged a warning (MSG-007).

-- 1. Who may listen: only to your own topic. Nobody may send from the
-- website (no insert policy); only the database functions below do.

drop policy if exists "live updates read own topic" on realtime.messages;
create policy "live updates read own topic" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

-- 2. A new message tells everyone in the conversation, sender included (their
-- other tabs).

create or replace function public.broadcast_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  participant uuid;
begin
  for participant in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id
  loop
    perform realtime.send(
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id),
      'message',
      'user:' || participant::text,
      true
    );
  end loop;

  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.broadcast_conversation_message() from public, anon, authenticated;

drop trigger if exists conversation_messages_broadcast on public.conversation_messages;
create trigger conversation_messages_broadcast
  after insert on public.conversation_messages
  for each row execute function public.broadcast_conversation_message();

-- 3. A queued commission notification tells its recipient.

create or replace function public.broadcast_listing_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('listing_request_id', new.listing_request_id, 'kind', new.kind),
    'notification',
    'user:' || new.recipient_user_id::text,
    true
  );

  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.broadcast_listing_request_notification() from public, anon, authenticated;

drop trigger if exists listing_request_notifications_broadcast on public.listing_request_notifications;
create trigger listing_request_notifications_broadcast
  after insert on public.listing_request_notifications
  for each row execute function public.broadcast_listing_request_notification();
