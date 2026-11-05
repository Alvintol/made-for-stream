-- Security review (2026-11-05): two gaps found while checking the site.
--
-- 1. The three public storage buckets (free-assets, listing-previews,
--    listing-animations) let any signed-in account upload into its own
--    folder, and free-assets had no size limit, so anyone could use it as
--    free public file hosting. Only approved creators make listings, so only
--    they may now upload there, and free-assets is capped at 200MB, the same
--    limit the website already shows (FREE_ASSET_MAX_BYTES). Deleting your
--    own files is unchanged.
-- 2. profiles is readable by everyone, signed in or not, and that included
--    each person's country, timezone and last sign-in method (Google, Twitch
--    or email). The website never shows those, so they are no longer
--    readable through the API at all; the site and the database's own
--    functions still write and use them. Every other column reads as before.
--    A column added to profiles later is NOT readable until it is added to
--    the grant below.

-- 1. Public buckets: approved creators only, and a size limit on free files.

update storage.buckets
set file_size_limit = 209715200 -- 200MB
where id = 'free-assets';

drop policy if exists "free assets creator upload" on storage.objects;
create policy "free assets creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'free-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "free assets creator update own" on storage.objects;
create policy "free assets creator update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'free-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "listing previews creator upload" on storage.objects;
create policy "listing previews creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "listing animations creator upload" on storage.objects;
create policy "listing animations creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-animations'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller(auth.uid())
  );

-- 2. profiles: read every column except country_code, timezone and
-- auth_provider_last_used. A table-wide grant overrides column grants, so it
-- is revoked and the readable columns granted one by one. Insert and update
-- grants are untouched.

revoke select on public.profiles from anon, authenticated;

grant select (
  user_id,
  handle,
  display_name,
  display_name_auto,
  bio,
  avatar_url,
  banner_url,
  website_url,
  profile_visibility,
  messaging_enabled,
  profile_setup_seen,
  profile_setup_completed_at,
  onboarding_version,
  created_at,
  updated_at
) on public.profiles to anon, authenticated;
