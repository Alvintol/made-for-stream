-- Keeps moderation report lifecycle fields consistent.
-- Resolving a report sets resolved_at.
-- Moving a resolved report back to a non-resolved status clears resolved_at.
-- Reporter-visible updates set reporter_status_updated_at.
-- Admin update history remains append-only.

-- Added 2026-11-11 so the chain replays on an empty database: this version
-- reorders the parameters and returns jsonb, which create or replace refuses
-- over 042's. It never applied on dev for that reason (20260926_140 fixed dev).
drop function if exists public.update_moderation_report_status(uuid, text, text, text, text);

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
  v_previous_status text;
  v_previous_resolution_code text;
  v_next_resolution_code text := nullif(trim(coalesce(p_resolution_code, '')), '');
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

  if nullif(trim(coalesce(p_status, '')), '') is null then
    raise exception 'A report status is required.'
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
      when p_status = 'resolved' then coalesce(mr.resolved_at, now())
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
    v_previous_status is distinct from p_status
    or v_previous_resolution_code is distinct from v_next_resolution_code
    or v_reporter_status_message is not null
    or v_admin_notes is not null;

  if not v_changed then
    return jsonb_build_object(
      'report_id', p_report_id,
      'previous_status', v_previous_status,
      'new_status', p_status,
      'previous_resolution_code', v_previous_resolution_code,
      'new_resolution_code', v_next_resolution_code,
      'resolved_at', v_next_resolved_at,
      'changed', false
    );
  end if;

  update public.moderation_reports
  set
    status = p_status,
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
    p_status,
    v_previous_resolution_code,
    v_next_resolution_code,
    v_reporter_status_message,
    v_admin_notes
  );

  return jsonb_build_object(
    'report_id', p_report_id,
    'previous_status', v_previous_status,
    'new_status', p_status,
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