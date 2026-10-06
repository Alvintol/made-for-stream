-- Optional animated preview (a GIF) for a listing, shown only on the
-- listing's own page, where it plays once. Cards and the market keep the
-- static preview image from 20261006_143.
--
-- Unlike the static image, the GIF is stored exactly as uploaded: it is not
-- shrunk or watermarked. The page hides the file's address and blocks
-- right-click saving, which deters casual copying only. The upload form
-- says so.
--
-- 1. A public bucket for the GIFs, GIF only, size-capped.
-- 2. Creators may only write inside their own auth.uid() folder.
-- 3. listings.animated_preview_url may only be CHANGED to a file in the
--    owner's folder of that bucket (same rule, same function, as preview_url).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-animations',
  'listing-animations',
  true,
  8388608, -- 8 MB
  array['image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing animations creator upload" on storage.objects;
create policy "listing animations creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-animations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing animations creator delete own" on storage.objects;
create policy "listing animations creator delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-animations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing animations public read" on storage.objects;
create policy "listing animations public read" on storage.objects
  for select
  using (bucket_id = 'listing-animations');

alter table public.listings
  add column if not exists animated_preview_url text;

comment on column public.listings.animated_preview_url is
  'Public address of an optional GIF in the listing-animations bucket, shown on the listing page only. Stored as uploaded: not resized or watermarked.';

-- Replaces 143's function so both media columns follow one rule: a changed
-- value must be a file in the owner's own folder of that column's bucket.
create or replace function public.enforce_listing_preview_is_uploaded()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  storage_prefix constant text :=
    '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/';
  own_file constant text := '/' || new.user_id::text || '/[A-Za-z0-9._-]+$';
begin
  if new.preview_url is not null
     and btrim(new.preview_url) <> ''
     and (tg_op = 'INSERT' or new.preview_url is distinct from old.preview_url)
     and new.preview_url !~ (storage_prefix || 'listing-previews' || own_file)
  then
    raise exception 'Listing preview must be an image uploaded to Made for Stream.'
      using errcode = 'check_violation';
  end if;

  if new.animated_preview_url is not null
     and btrim(new.animated_preview_url) <> ''
     and (tg_op = 'INSERT' or new.animated_preview_url is distinct from old.animated_preview_url)
     and new.animated_preview_url !~ (storage_prefix || 'listing-animations' || own_file)
  then
    raise exception 'Listing animated preview must be a GIF uploaded to Made for Stream.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_preview_is_uploaded() from public, anon, authenticated;

drop trigger if exists listings_enforce_preview_is_uploaded on public.listings;
create trigger listings_enforce_preview_is_uploaded
  before insert or update of preview_url, animated_preview_url, user_id on public.listings
  for each row execute function public.enforce_listing_preview_is_uploaded();
