-- What a creator offers (decided 2026-11-12).
--
-- Asked as "What will you offer?" on the creator application, and kept up to
-- date in Settings: one checkbox per listing category (src/domain/catalog.ts)
-- and "Something else", which needs a short description. Stored on the
-- profile, not the application, because an application locks once it is
-- submitted and the answers show on the public profile as tags.
--
-- The application no longer asks for follower or subscriber numbers: the
-- team checks the minimum on the linked channel at review, so the
-- self-reported check from 20261110_193 is removed below. The old numbers
-- stay in seller_applications for applications that gave them.
--
-- At least one is needed to submit an application. Approved creators without
-- any are sent to Settings by the site until they choose
-- (src/components/auth/ProfileSetupRedirect.tsx). Nothing is backfilled.
--
-- Apply this before releasing the website that reads these columns.

alter table public.profiles
  add column if not exists offering_types text[] not null default '{}',
  add column if not exists offering_other text;

-- Only known answers. Mirrors APPLICATION_OFFERINGS in
-- src/domain/creatorApplication/creatorApplication.ts; a test compares them.
alter table public.profiles
  drop constraint if exists profiles_offering_types_check;
alter table public.profiles
  add constraint profiles_offering_types_check
  check (offering_types <@ array[
    'emotes', 'overlays', 'panels', 'screens', 'alerts', 'badges',
    'pngtuber-models', 'vtuber-models', 'vtuber-rigging',
    'video-editing', 'audio-tech-help', 'games', 'other'
  ]::text[]);

-- "Something else" needs its description, and only it has one.
alter table public.profiles
  drop constraint if exists profiles_offering_other_check;
alter table public.profiles
  add constraint profiles_offering_other_check
  check (
    ('other' = any(offering_types))
      = (offering_other is not null and char_length(btrim(offering_other)) > 0)
    and char_length(coalesce(offering_other, '')) <= 80
  );

-- Profiles are readable column by column (20261105_189); these are public.
grant select (offering_types, offering_other) on public.profiles to anon, authenticated;

-- Submitting: the age confirmation from 20261110_193, and at least one
-- offering on the applicant's profile. No audience numbers.
create or replace function public.check_seller_application_submission()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Only the moment of submitting; earlier applications are left alone.
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  if not new.agreed_to_age_and_capacity then
    raise exception 'You must confirm you are at least 18 to apply.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles
    where profiles.user_id = new.profile_user_id
      and cardinality(profiles.offering_types) > 0
  ) then
    raise exception 'Choose at least one thing you''ll offer before you apply.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
