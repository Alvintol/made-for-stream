-- Reconciles the live database with migrations that were never applied,
-- and fixes Sprint 9's request gate for free listings.
--
-- Found 2026-09-26 by comparing every function body in supabase/migrations
-- (newest definition, whitespace-insensitive md5) with pg_proc, and every
-- table, column and trigger with the catalog. Everything else matched.
-- Not applied live, so re-applied here, verbatim, in filename order:
--
--   003  set_profile_platform_accounts_updated_at trigger (updated_at never bumped)
--   058  update_moderation_report_status: resolution code only on 'resolved',
--        and required there. Supersedes 056 (also unapplied; neither could
--        apply, see below). The admin UI (AdminModerationReportDetails.tsx)
--        already assumes these rules.
--   068  log_listing_request_status_change only. 068's archive-metadata
--        function is NOT re-applied: 074's newer version is live.
--   116  free listings exempt from payout readiness at publish. Live still
--        gated every listing, so free-only creators could not publish.
--
-- create or replace keeps each function's existing grants (20260922_119
-- revoked the trigger functions from client roles; that stays in force).
--
-- Then: 20260924_139's request gate (enforce_listing_request_creator_readiness)
-- refused requests to a creator without a ready payout account, including
-- requests for a free listing, which never takes a payment. Free listings are
-- now exempt there too, matching 116.


-- ---------------------------------------------------------------------------
-- 003: profile_platform_accounts updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists set_profile_platform_accounts_updated_at on public.profile_platform_accounts;

create trigger set_profile_platform_accounts_updated_at before
update
  on public.profile_platform_accounts for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 058: moderation report resolution rules (verbatim)
-- ---------------------------------------------------------------------------

-- Why 056 and 058 never applied: both reorder the parameters and change the
-- return type from moderation_reports to jsonb, which create or replace
-- refuses. Drop the live (042) version first. The admin UI
-- (useUpdateModerationReportStatus) passes named arguments and ignores the
-- return value, so it works with either.
drop function if exists public.update_moderation_report_status(uuid, text, text, text, text);

-- Requires a resolution code when a moderation report is resolved.
-- Also clears resolution_code and resolved_at when a report is moved back out of resolved.

create or replace function public.update_moderation_report_status(
  p_report_id uuid,
  p_status text,
  p_resolution_code text default null,
  p_reporter_status_message text default null,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_user_id uuid := auth.uid();
  v_next_status text := nullif(trim(coalesce(p_status, '')), '');
  v_previous_status text;
  v_previous_resolution_code text;
  v_next_resolution_code text;
  v_reporter_status_message text := nullif(trim(coalesce(p_reporter_status_message, '')), '');
  v_admin_notes text := nullif(trim(coalesce(p_admin_notes, '')), '');
  v_next_resolved_at timestamptz;
  v_next_reporter_status_updated_at timestamptz;
  v_changed boolean := false;
begin
  if v_admin_user_id is null then
    raise exception 'You must be signed in to update a moderation report.'
      using errcode = '42501';
  end if;

  if not public.is_admin_user(v_admin_user_id) then
    raise exception 'Only admins can update moderation reports.'
      using errcode = '42501';
  end if;

  if v_next_status is null then
    raise exception 'A report status is required.'
      using errcode = '23514';
  end if;

  -- Only resolved reports should carry a resolution code.
  v_next_resolution_code :=
    case
      when v_next_status = 'resolved' then nullif(trim(coalesce(p_resolution_code, '')), '')
      else null
    end;

  if v_next_status = 'resolved' and v_next_resolution_code is null then
    raise exception 'A resolution is required when resolving a report.'
      using errcode = '23514';
  end if;

  if v_reporter_status_message is not null and length(v_reporter_status_message) > 1000 then
    raise exception 'Reporter-visible update must be 1000 characters or fewer.'
      using errcode = '23514';
  end if;

  if v_admin_notes is not null and length(v_admin_notes) > 2000 then
    raise exception 'Internal admin note must be 2000 characters or fewer.'
      using errcode = '23514';
  end if;

  select
    mr.status::text,
    mr.resolution_code::text,
    case
      when v_next_status = 'resolved' then coalesce(mr.resolved_at, now())
      else null
    end,
    case
      when v_reporter_status_message is not null then now()
      else mr.reporter_status_updated_at
    end
  into
    v_previous_status,
    v_previous_resolution_code,
    v_next_resolved_at,
    v_next_reporter_status_updated_at
  from public.moderation_reports mr
  where mr.id = p_report_id
  for update;

  if not found then
    raise exception 'Moderation report not found.'
      using errcode = 'P0002';
  end if;

  v_changed :=
    v_previous_status is distinct from v_next_status
    or v_previous_resolution_code is distinct from v_next_resolution_code
    or v_reporter_status_message is not null
    or v_admin_notes is not null;

  if not v_changed then
    return jsonb_build_object(
      'report_id', p_report_id,
      'previous_status', v_previous_status,
      'new_status', v_next_status,
      'previous_resolution_code', v_previous_resolution_code,
      'new_resolution_code', v_next_resolution_code,
      'resolved_at', v_next_resolved_at,
      'changed', false
    );
  end if;

  update public.moderation_reports
  set
    status = v_next_status,
    resolution_code = v_next_resolution_code,
    reporter_status_message = coalesce(v_reporter_status_message, reporter_status_message),
    reporter_status_updated_at = v_next_reporter_status_updated_at,
    reviewed_at = coalesce(reviewed_at, now()),
    reviewed_by_user_id = coalesce(reviewed_by_user_id, v_admin_user_id),
    resolved_at = v_next_resolved_at,
    admin_notes = coalesce(v_admin_notes, admin_notes)
  where id = p_report_id;

  insert into public.moderation_report_updates (
    report_id,
    admin_user_id,
    previous_status,
    new_status,
    previous_resolution_code,
    new_resolution_code,
    reporter_status_message,
    admin_notes
  )
  values (
    p_report_id,
    v_admin_user_id,
    v_previous_status,
    v_next_status,
    v_previous_resolution_code,
    v_next_resolution_code,
    v_reporter_status_message,
    v_admin_notes
  );

  return jsonb_build_object(
    'report_id', p_report_id,
    'previous_status', v_previous_status,
    'new_status', v_next_status,
    'previous_resolution_code', v_previous_resolution_code,
    'new_resolution_code', v_next_resolution_code,
    'resolved_at', v_next_resolved_at,
    'changed', true
  );
end;
$$;

revoke all on function public.update_moderation_report_status(uuid, text, text, text, text)
  from public;

grant execute on function public.update_moderation_report_status(uuid, text, text, text, text)
  to authenticated;

-- Recreating the function picks up Supabase's default grants, which include
-- anon. The function refuses anon anyway (auth.uid() is null); revoke it so
-- the grant matches the intent.
revoke all on function public.update_moderation_report_status(uuid, text, text, text, text)
  from anon;

-- ---------------------------------------------------------------------------
-- 068: request status-change logger (function only, verbatim)
-- ---------------------------------------------------------------------------

create or replace function public.log_listing_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
  actor_id uuid;
  archive_actor_id uuid;
  system_message_body text;
  safe_reason text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select conversations.id
  into conversation_id
  from public.conversations
  where conversations.listing_request_id = new.id
  limit 1;

  if conversation_id is null then
    return new;
  end if;

  archive_actor_id := coalesce(new.archived_by_user_id, auth.uid());
  actor_id := coalesce(auth.uid(), new.archived_by_user_id, new.creator_user_id);
  safe_reason := nullif(btrim(coalesce(new.creator_status_reason, '')), '');

  insert into public.conversation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    conversation_id,
    actor_id,
    'request_status_updated',
    jsonb_strip_nulls(
      jsonb_build_object(
        'listing_request_id', new.id,
        'listing_id', new.listing_id,
        'previous_status', old.status,
        'new_status', new.status,
        'request_title', new.request_title,
        'creator_status_reason', safe_reason,
        'archived_at', new.archived_at,
        'archived_by_user_id', new.archived_by_user_id
      )
    )
  );

  system_message_body := case
    when new.status = 'accepted' then
      'Request accepted by the creator.'

    when new.status = 'archived' and archive_actor_id = new.buyer_user_id then
      'Request cancelled by the buyer.'

    when new.status = 'archived' and archive_actor_id = new.creator_user_id then
      'Request archived by the creator.'

    when new.status = 'archived' then
      'Request archived.'

    when new.status = 'submitted' then
      'Request moved back to under review.'

    else null
  end;

  -- Declined requests already get a clearer close message from the existing
  -- close_conversation_when_listing_request_declined trigger.
  if system_message_body is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      conversation_id,
      actor_id,
      'system',
      system_message_body
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 116: free listings exempt from payout readiness (verbatim)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_payment_account_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
    and new.is_active = true
    and new.is_free = false
    and not public.has_ready_creator_payment_account(new.user_id)
  then
    raise exception 'Creator payout account must be ready before publishing active listings.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- The original trigger did not watch is_free, so flipping a published free
-- listing to paid would have skipped the readiness check entirely.
drop trigger if exists listings_require_payment_account_for_active_publish
  on public.listings;

create trigger listings_require_payment_account_for_active_publish
  before insert or update of user_id, status, is_active, is_free
  on public.listings
  for each row
  execute function public.enforce_listing_payment_account_readiness();

-- ---------------------------------------------------------------------------
-- Sprint 9 gate: a request for a free listing is not paid work
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_request_creator_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'submitted'
    and not exists (
      select 1 from public.listings
      where listings.id = new.listing_id
        and listings.is_free
    )
  then
    perform public.assert_creator_ready_for_paid_work(new.creator_user_id, 'buyer');
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
