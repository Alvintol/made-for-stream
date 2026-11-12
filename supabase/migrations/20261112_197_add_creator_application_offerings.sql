-- What a creator applicant plans to offer (decided 2026-11-12).
--
-- The application asks "What will you offer?" with one checkbox per listing
-- category (src/domain/catalog.ts) and "Something else". At least one is
-- needed to submit, so reviewers see each applicant's intentions. Applications
-- submitted before this keep an empty list; nothing is backfilled.
--
-- The site must not save this column before it exists: apply this migration
-- before releasing the website that asks the question.

alter table public.seller_applications
  add column if not exists offering_types text[] not null default '{}';

-- Only known answers. Mirrors APPLICATION_OFFERINGS in
-- src/domain/creatorApplication/creatorApplication.ts; a test compares them.
alter table public.seller_applications
  drop constraint if exists seller_applications_offering_types_check;
alter table public.seller_applications
  add constraint seller_applications_offering_types_check
  check (offering_types <@ array[
    'emotes', 'overlays', 'panels', 'screens', 'alerts', 'badges',
    'pngtuber-models', 'vtuber-models', 'vtuber-rigging',
    'video-editing', 'audio-tech-help', 'games', 'other'
  ]::text[]);

-- Submitting: the checks from 20261110_193, plus at least one offering.
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

  if not (
    (new.twitch_status in ('affiliate', 'partner') and coalesce(new.twitch_follower_count, 0) >= 300)
    or coalesce(new.youtube_subscriber_count, 0) >= 500
  ) then
    raise exception 'To apply you need Twitch Affiliate or Partner with at least 300 followers, or at least 500 YouTube subscribers.'
      using errcode = 'P0001';
  end if;

  if coalesce(cardinality(new.offering_types), 0) = 0 then
    raise exception 'Choose at least one thing you''ll offer before you apply.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
