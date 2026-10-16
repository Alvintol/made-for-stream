-- A creator can record that work was also sent outside Made for Stream.
--
-- Some creators send milestone images or finished work by email, Discord,
-- text message or some other way. The site cannot watermark that work, holds
-- no copy of it and cannot tell whether it arrived. What it can do is keep
-- the creator's own statement of where the work went, tied to the commission.
--
-- 1. Both the milestone submission and the final delivery get two columns:
--    the ways the work was sent (a fixed list) and, for "other", a short
--    description in the creator's words.
-- 2. Two functions take that statement together with the submission, in one
--    transaction: either both are saved or neither. They call the existing
--    functions, which keep every check they have today. The website only
--    calls the new ones when the creator ticked "Provided off site", so a
--    submission without it does not depend on this migration.
-- 3. When a submission that carries the statement reaches the buyer, a line
--    is added to the commission's chat. It is an automatic line: it is not
--    counted as an unread message and sends no email (20261012_156).
--
-- This is the creator's statement, not proof. Nothing here confirms that
-- the buyer received anything.

alter table public.listing_request_milestone_submissions
  add column if not exists off_site_delivery_methods text[] not null default '{}'::text[],
  add column if not exists off_site_delivery_other text;

alter table public.listing_request_final_deliveries
  add column if not exists off_site_delivery_methods text[] not null default '{}'::text[],
  add column if not exists off_site_delivery_other text;

alter table public.listing_request_milestone_submissions
  drop constraint if exists listing_request_milestone_submissions_off_site_methods_check,
  drop constraint if exists listing_request_milestone_submissions_off_site_other_check;

alter table public.listing_request_milestone_submissions
  add constraint listing_request_milestone_submissions_off_site_methods_check
    check (
      off_site_delivery_methods
        <@ array['email', 'discord', 'text_message', 'other']::text[]
    ),
  add constraint listing_request_milestone_submissions_off_site_other_check
    check (
      case
        when 'other' = any (off_site_delivery_methods) then
          off_site_delivery_other is not null
          and char_length(btrim(off_site_delivery_other)) between 2 and 80
        else off_site_delivery_other is null
      end
    );

alter table public.listing_request_final_deliveries
  drop constraint if exists listing_request_final_deliveries_off_site_methods_check,
  drop constraint if exists listing_request_final_deliveries_off_site_other_check;

alter table public.listing_request_final_deliveries
  add constraint listing_request_final_deliveries_off_site_methods_check
    check (
      off_site_delivery_methods
        <@ array['email', 'discord', 'text_message', 'other']::text[]
    ),
  add constraint listing_request_final_deliveries_off_site_other_check
    check (
      case
        when 'other' = any (off_site_delivery_methods) then
          off_site_delivery_other is not null
          and char_length(btrim(off_site_delivery_other)) between 2 and 80
        else off_site_delivery_other is null
      end
    );

-- Checks the statement and returns the ways in a fixed order, each once.
create or replace function public.clean_off_site_delivery_methods(
  p_methods text[],
  p_other text
)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  allowed constant text[] :=
    array['email', 'discord', 'text_message', 'other'];
  cleaned text[];
begin
  if exists (
    select 1
    from unnest(coalesce(p_methods, '{}'::text[])) as given(method)
    where given.method is null
      or not (given.method = any (allowed))
  ) then
    raise exception
      'Choose how the work was sent off site from the list.'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(listed.method order by listed.position), '{}'::text[])
  into cleaned
  from unnest(allowed) with ordinality as listed(method, position)
  where listed.method = any (coalesce(p_methods, '{}'::text[]));

  if cardinality(cleaned) = 0 then
    raise exception
      'Choose at least one way the work was sent off site.'
      using errcode = '22023';
  end if;

  if 'other' = any (cleaned)
    and char_length(btrim(coalesce(p_other, ''))) not between 2 and 80 then
    raise exception
      'Say how the work was sent off site, in 2 to 80 characters.'
      using errcode = '22023';
  end if;

  return cleaned;
end;
$$;

revoke all on function public.clean_off_site_delivery_methods(text[], text)
  from public, anon, authenticated;

-- Submits a milestone and records where else the work was sent.
create or replace function public.submit_listing_request_milestone_off_site(
  p_milestone_id uuid,
  p_summary text,
  p_delivery_links text[],
  p_preview_image_paths text[],
  p_off_site_methods text[],
  p_off_site_other text default null
)
returns table (
  submission_id uuid,
  milestone_id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  version_number integer,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_methods text[] :=
    public.clean_off_site_delivery_methods(
      p_off_site_methods,
      p_off_site_other
    );
  submitted record;
begin
  -- Every existing check (who is calling, the milestone's state, the
  -- images) is made here.
  select *
  into submitted
  from public.submit_listing_request_milestone(
    p_milestone_id,
    p_summary,
    p_delivery_links,
    p_preview_image_paths
  ) as existing_result;

  update public.listing_request_milestone_submissions
  set
    off_site_delivery_methods = clean_methods,
    off_site_delivery_other =
      case
        when 'other' = any (clean_methods) then btrim(p_off_site_other)
      end
  where listing_request_milestone_submissions.id =
    submitted.submission_id;

  return query
  select
    submitted.submission_id,
    submitted.milestone_id,
    submitted.listing_request_id,
    submitted.agreement_id,
    submitted.status,
    submitted.version_number,
    submitted.submitted_at;
end;
$$;

revoke all on function public.submit_listing_request_milestone_off_site(
  uuid, text, text[], text[], text[], text
) from public, anon;
grant execute on function public.submit_listing_request_milestone_off_site(
  uuid, text, text[], text[], text[], text
) to authenticated;

-- Creates a final delivery (a draft, or submitted straight away) and
-- records where else the work was sent.
create or replace function public.create_listing_request_final_delivery_off_site(
  p_agreement_id uuid,
  p_status text,
  p_title text,
  p_summary text,
  p_delivery_links text[],
  p_off_site_methods text[],
  p_off_site_other text default null
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  version_number integer,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_methods text[] :=
    public.clean_off_site_delivery_methods(
      p_off_site_methods,
      p_off_site_other
    );
  created record;
begin
  select *
  into created
  from public.create_listing_request_final_delivery(
    p_agreement_id,
    p_status,
    p_title,
    p_summary,
    p_delivery_links
  ) as existing_result;

  update public.listing_request_final_deliveries
  set
    off_site_delivery_methods = clean_methods,
    off_site_delivery_other =
      case
        when 'other' = any (clean_methods) then btrim(p_off_site_other)
      end
  where listing_request_final_deliveries.id = created.id;

  return query
  select
    created.id,
    created.listing_request_id,
    created.agreement_id,
    created.status,
    created.version_number,
    created.submitted_at;
end;
$$;

revoke all on function public.create_listing_request_final_delivery_off_site(
  uuid, text, text, text, text[], text[], text
) from public, anon;
grant execute on function public.create_listing_request_final_delivery_off_site(
  uuid, text, text, text, text[], text[], text
) to authenticated;

-- Adds the chat line the first time a submission that carries the statement
-- is in front of the buyer: at once for a milestone or a final delivery
-- submitted straight away, and when a saved draft is sent.
create or replace function public.log_off_site_delivery_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb := to_jsonb(new);
  subject text;
  methods_text text;
  target_conversation_id uuid;
begin
  if new.status <> 'submitted'
    or cardinality(new.off_site_delivery_methods) = 0 then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'submitted'
    and cardinality(old.off_site_delivery_methods) > 0 then
    return new;
  end if;

  if tg_table_name = 'listing_request_milestone_submissions' then
    select format(
      'milestone %s (%s)',
      milestone.sort_order + 1,
      milestone.title
    )
    into subject
    from public.listing_request_milestones as milestone
    where milestone.id = (row_data ->> 'milestone_id')::uuid;
  else
    subject := format('the final delivery (%s)', row_data ->> 'title');
  end if;

  select string_agg(
    case sent.method
      when 'email' then 'email'
      when 'discord' then 'Discord'
      when 'text_message' then 'text message'
      else format('another way (%s)', new.off_site_delivery_other)
    end,
    ', '
    order by sent.position
  )
  into methods_text
  from unnest(new.off_site_delivery_methods)
    with ordinality as sent(method, position);

  select conversations.id
  into target_conversation_id
  from public.conversations
  where conversations.listing_request_id = new.listing_request_id
  limit 1;

  if target_conversation_id is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      target_conversation_id,
      new.creator_user_id,
      'system',
      format(
        'The creator reports that the work for %s was also sent outside Made for Stream, by: %s. Made for Stream has no copy of what was sent and cannot confirm that it arrived.',
        coalesce(subject, 'this commission'),
        methods_text
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.log_off_site_delivery_message()
  from public, anon, authenticated;

drop trigger if exists listing_request_milestone_submissions_off_site_message
  on public.listing_request_milestone_submissions;

create trigger listing_request_milestone_submissions_off_site_message
  after insert or update of status, off_site_delivery_methods
  on public.listing_request_milestone_submissions
  for each row
  execute function public.log_off_site_delivery_message();

drop trigger if exists listing_request_final_deliveries_off_site_message
  on public.listing_request_final_deliveries;

create trigger listing_request_final_deliveries_off_site_message
  after insert or update of status, off_site_delivery_methods
  on public.listing_request_final_deliveries
  for each row
  execute function public.log_off_site_delivery_message();
