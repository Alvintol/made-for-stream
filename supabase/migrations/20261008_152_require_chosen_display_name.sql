-- =====================================================================
-- 20261008_152: a public display name the person chose is required
--
-- A new profile used to be named after the first half of the person's
-- email address until they changed it (display_name_auto = true). That is
-- not a name anyone chose, and it shows part of a private email address in
-- public. From now on:
--
-- 1. A display name can never be empty: 2 to 50 characters.
-- 2. Nobody can create a listing, send a commission request or send an
--    agreement until they have chosen their own display name
--    (display_name_auto = false), as well as saved their account details.
--    The website asks for it on the same first-time form.
--
-- Playbook: docs/support/profiles/account-details.md (ACC-001, ACC-005).
-- =====================================================================

-- Accounts that never chose a name are showing the first half of their
-- email address. Replace it with the neutral placeholder new accounts get.
update public.profiles
set display_name = 'New member'
where display_name_auto;

alter table public.profiles
  drop constraint if exists profiles_display_name_present;

alter table public.profiles
  add constraint profiles_display_name_present
  check (display_name is not null and char_length(btrim(display_name)) between 2 and 50);

comment on column public.profiles.display_name_auto is
  'True until the person chooses their own display name. While true the name is a placeholder and the account cannot list, request or send agreements.';

-- TG_ARGV[0] names the column holding the user who must be set up.
-- The database owner and the service role (auth.uid() is null) are let
-- through, so seed data and repairs still work.
create or replace function public.enforce_account_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_user_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  if not exists (
    select 1 from public.user_account_details
    where user_account_details.user_id = required_user_id
  ) then
    raise exception 'Add your account details in Settings before you can do this.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles
    where profiles.user_id = required_user_id
      and not profiles.display_name_auto
  ) then
    raise exception 'Choose a public display name in Settings before you can do this.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_account_details() from public, anon, authenticated;
