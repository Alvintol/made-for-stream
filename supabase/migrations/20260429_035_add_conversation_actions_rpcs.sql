-- Controlled conversation actions.
-- These are called through supabase.rpc(...) instead of direct table updates.
create
or replace function public.close_conversation(
  p_conversation_id uuid,
  p_reason_code text,
  p_reason_details text default null
) returns public.conversations language plpgsql security definer
set
  search_path = public as $$ declare current_user_id uuid;

conversation_row public.conversations;

details text;

begin current_user_id := auth.uid();

details := nullif(btrim(coalesce(p_reason_details, '')), '');

if current_user_id is null then raise exception 'You must be signed in to close a conversation.';

end if;

select
  * into conversation_row
from
  public.conversations
where
  id = p_conversation_id for
update
;

if not found then raise exception 'Conversation not found.';

end if;

if not public.is_conversation_participant(p_conversation_id, current_user_id) then raise exception 'You do not have access to this conversation.';

end if;

if conversation_row.status <> 'open' then raise exception 'Only open conversations can be closed.';

end if;

if p_reason_code is null
or not (
  p_reason_code = any (
    array [
          'question_answered'::text,
          'not_moving_forward'::text,
          'not_a_fit'::text,
          'duplicate_conversation'::text,
          'unresponsive'::text,
          'unwanted_messages'::text,
          'other'::text
        ]
  )
) then raise exception 'Please choose a valid reason for ending the conversation.';

end if;

if details is not null
and char_length(details) > 1000 then raise exception 'Additional details must be 1000 characters or less.';

end if;

update
  public.conversations
set
  status = 'closed',
  closed_at = now(),
  closed_by_user_id = current_user_id,
  closed_reason_code = p_reason_code,
  closed_reason_details = details,
  updated_at = now()
where
  id = p_conversation_id returning * into conversation_row;

insert into
  public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
values
  (
    p_conversation_id,
    current_user_id,
    'system',
    'Conversation ended.'
  );

insert into
  public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
values
  (
    p_conversation_id,
    current_user_id,
    'conversation_closed',
    jsonb_build_object(
      'reason_code',
      p_reason_code,
      'reason_details',
      details
    )
  );

return conversation_row;

end;

$$;

grant execute on function public.close_conversation(uuid, text, text) to authenticated;

create
or replace function public.request_buyer_image_upload(
  p_conversation_id uuid,
  p_request_note text default null
) returns public.conversations language plpgsql security definer
set
  search_path = public as $$ declare current_user_id uuid;

conversation_row public.conversations;

request_note text;

begin current_user_id := auth.uid();

request_note := nullif(btrim(coalesce(p_request_note, '')), '');

if current_user_id is null then raise exception 'You must be signed in to request image access.';

end if;

select
  * into conversation_row
from
  public.conversations
where
  id = p_conversation_id for
update
;

if not found then raise exception 'Conversation not found.';

end if;

if conversation_row.buyer_user_id <> current_user_id then raise exception 'Only the buyer can request image upload access.';

end if;

if conversation_row.status <> 'open' then raise exception 'Image access can only be requested in open conversations.';

end if;

if conversation_row.buyer_image_upload_status = 'requested' then raise exception 'Image upload access has already been requested.';

end if;

if conversation_row.buyer_image_upload_status = 'approved' then raise exception 'Image upload access is already approved.';

end if;

if request_note is not null
and char_length(request_note) > 1000 then raise exception 'Request note must be 1000 characters or less.';

end if;

update
  public.conversations
set
  buyer_image_upload_status = 'requested',
  buyer_image_upload_requested_at = now(),
  buyer_image_upload_requested_by_user_id = current_user_id,
  buyer_image_upload_request_note = request_note,
  updated_at = now()
where
  id = p_conversation_id returning * into conversation_row;

insert into
  public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
values
  (
    p_conversation_id,
    current_user_id,
    'system',
    'Buyer requested permission to send images.'
  );

insert into
  public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
values
  (
    p_conversation_id,
    current_user_id,
    'buyer_image_upload_requested',
    jsonb_build_object('request_note', request_note)
  );

return conversation_row;

end;

$$;

grant execute on function public.request_buyer_image_upload(uuid, text) to authenticated;

create
or replace function public.approve_buyer_image_upload(p_conversation_id uuid) returns public.conversations language plpgsql security definer
set
  search_path = public as $$ declare current_user_id uuid;

conversation_row public.conversations;

begin current_user_id := auth.uid();

if current_user_id is null then raise exception 'You must be signed in to approve image access.';

end if;

select
  * into conversation_row
from
  public.conversations
where
  id = p_conversation_id for
update
;

if not found then raise exception 'Conversation not found.';

end if;

if conversation_row.creator_user_id <> current_user_id then raise exception 'Only the creator can approve buyer image uploads.';

end if;

if conversation_row.status <> 'open' then raise exception 'Image access can only be approved in open conversations.';

end if;

if conversation_row.buyer_image_upload_status = 'approved' then raise exception 'Image upload access is already approved.';

end if;

update
  public.conversations
set
  buyer_image_upload_status = 'approved',
  buyer_image_upload_approved_at = now(),
  buyer_image_upload_approved_by_user_id = current_user_id,
  updated_at = now()
where
  id = p_conversation_id returning * into conversation_row;

insert into
  public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
values
  (
    p_conversation_id,
    current_user_id,
    'system',
    'Creator allowed buyer image uploads.'
  );

insert into
  public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
values
  (
    p_conversation_id,
    current_user_id,
    'buyer_image_upload_approved',
    '{}' :: jsonb
  );

return conversation_row;

end;

$$;

grant execute on function public.approve_buyer_image_upload(uuid) to authenticated;

create
or replace function public.revoke_buyer_image_upload(p_conversation_id uuid) returns public.conversations language plpgsql security definer
set
  search_path = public as $$ declare current_user_id uuid;

conversation_row public.conversations;

begin current_user_id := auth.uid();

if current_user_id is null then raise exception 'You must be signed in to disable image access.';

end if;

select
  * into conversation_row
from
  public.conversations
where
  id = p_conversation_id for
update
;

if not found then raise exception 'Conversation not found.';

end if;

if conversation_row.creator_user_id <> current_user_id then raise exception 'Only the creator can disable buyer image uploads.';

end if;

if conversation_row.status <> 'open' then raise exception 'Image access can only be changed in open conversations.';

end if;

if conversation_row.buyer_image_upload_status <> 'approved' then raise exception 'Image upload access is not currently approved.';

end if;

update
  public.conversations
set
  buyer_image_upload_status = 'revoked',
  buyer_image_upload_revoked_at = now(),
  buyer_image_upload_revoked_by_user_id = current_user_id,
  updated_at = now()
where
  id = p_conversation_id returning * into conversation_row;

insert into
  public.conversation_messages (
    conversation_id,
    sender_user_id,
    message_type,
    body
  )
values
  (
    p_conversation_id,
    current_user_id,
    'system',
    'Creator disabled buyer image uploads.'
  );

insert into
  public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
values
  (
    p_conversation_id,
    current_user_id,
    'buyer_image_upload_revoked',
    '{}' :: jsonb
  );

return conversation_row;

end;

$$;

grant execute on function public.revoke_buyer_image_upload(uuid) to authenticated;