-- Listing thumbnails become uploads instead of pasted links.
--
-- The website shrinks the image, optionally draws a watermark and re-saves
-- it in the browser, then uploads only that copy here. The creator's
-- original never leaves their computer, so nothing a buyer can reach on the
-- page is the original.
--
-- 1. A public bucket for the processed copies, images only, size-capped.
-- 2. Creators may only write inside their own auth.uid() folder.
-- 3. listings.preview_url may only be CHANGED to a file in the owner's
--    folder of that bucket. Existing listings keep their old pasted link
--    until the image is replaced.
-- 4. listings.preview_watermarked records whether the copy carries the
--    watermark. Nothing reads it yet: it exists so a later paid add-on can
--    count watermarked listings, which cannot be worked out from the image
--    afterwards.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-previews',
  'listing-previews',
  true,
  2097152, -- 2 MB; the browser's copy is at most 1200 px and far smaller
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing previews creator upload" on storage.objects;
create policy "listing previews creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing previews creator delete own" on storage.objects;
create policy "listing previews creator delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No update policy: a replaced image is a new file, so a published listing's
-- picture cannot be swapped underneath its revision history.

drop policy if exists "listing previews public read" on storage.objects;
create policy "listing previews public read" on storage.objects
  for select
  using (bucket_id = 'listing-previews');

alter table public.listings
  add column if not exists preview_watermarked boolean not null default false;

comment on column public.listings.preview_watermarked is
  'True when the uploaded preview image carries the Made for Stream watermark. Recorded for a later paid add-on; nothing enforces or reads it yet.';

create or replace function public.enforce_listing_preview_is_uploaded()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.preview_url is null or btrim(new.preview_url) = '' then
    return new;
  end if;

  -- Leave an unchanged value alone, so listings that still carry an old
  -- pasted link can be published, deactivated and edited as before.
  if tg_op = 'UPDATE' and new.preview_url is not distinct from old.preview_url then
    return new;
  end if;

  if new.preview_url !~ (
    '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/listing-previews/'
    || new.user_id::text
    || '/[A-Za-z0-9._-]+$'
  ) then
    raise exception 'Listing preview must be an image uploaded to Made for Stream.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_preview_is_uploaded() from public, anon, authenticated;

drop trigger if exists listings_enforce_preview_is_uploaded on public.listings;
create trigger listings_enforce_preview_is_uploaded
  before insert or update of preview_url, user_id on public.listings
  for each row execute function public.enforce_listing_preview_is_uploaded();
