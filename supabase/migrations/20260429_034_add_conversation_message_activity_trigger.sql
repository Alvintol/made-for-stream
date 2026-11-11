-- Maintains conversation last-message activity whenever a message is inserted.
create
or replace function public.handle_conversation_message_insert() returns trigger language plpgsql security definer
set
  search_path = public as $$ declare preview text;

begin preview := case
  when new.message_type = any (array ['attachment'::text, 'mixed'::text])
  and coalesce(btrim(new.body), '') = '' then '[Attachment]'
  else left(btrim(coalesce(new.body, '')), 180)
end;

update
  public.conversations
set
  last_message_at = new.created_at,
  last_message_sender_user_id = new.sender_user_id,
  last_message_preview = preview,
  updated_at = now()
where
  id = new.conversation_id;

insert into
  public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
values
  (
    new.conversation_id,
    new.sender_user_id,
    'message_sent',
    jsonb_build_object(
      'message_id',
      new.id,
      'message_type',
      new.message_type
    )
  );

return new;

end;

$$;

drop trigger if exists conversation_messages_after_insert on public.conversation_messages;

create trigger conversation_messages_after_insert
after
insert
  on public.conversation_messages for each row execute function public.handle_conversation_message_insert();