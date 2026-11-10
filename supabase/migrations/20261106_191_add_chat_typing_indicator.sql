-- Typing dots in a chat, MSG-009 in docs/support/messaging/conversations.md.
--
-- Live updates (20261105_190) only ever send from the database. Here the
-- website sends: while someone types, their tab sends a short "typing" signal
-- on the conversation's private topic, "conversation:<id>", and the other
-- person's open chat shows "…". The signal holds only the sender's id and
-- whether they are typing, never text. It goes browser to browser through
-- Realtime and is not stored.
--
-- Realtime checks these rules once, when a tab joins the topic: select to
-- listen, insert to send. Only the conversation's participants pass. Admins
-- reading a chat are not participants and see no dots. Sending on a person's
-- own "user:<id>" topic stays impossible: these rules match only
-- "conversation:" topics.

drop policy if exists "chat typing listen as participant" on realtime.messages;
create policy "chat typing listen as participant" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.conversation_participants as participant
      where participant.user_id = (select auth.uid())
        and 'conversation:' || participant.conversation_id::text = (select realtime.topic())
    )
  );

drop policy if exists "chat typing send as participant" on realtime.messages;
create policy "chat typing send as participant" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.conversation_participants as participant
      where participant.user_id = (select auth.uid())
        and 'conversation:' || participant.conversation_id::text = (select realtime.topic())
    )
  );
