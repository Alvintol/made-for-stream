-- Only listed file types can be delivered, until uploaded files are
-- scanned for viruses (decided 2026-10-16).
--
-- Program and script files (.exe, .bat, .js, .msi, Unity packages and the
-- like) are refused. The list is images, artwork source files, video,
-- audio, 3D and Live2D models, fonts, PDF and text, and zip. The website
-- checks what is inside a zip before uploading it; the database can only
-- see the zip's own name.
--
-- 1. public.delivery_file_extensions() is the list; the website holds the
--    same one (src/domain/listings/deliveryFileTypes.ts) and a test keeps
--    them equal.
-- 2. The upload policy refuses any other file name.
-- 3. A final delivery cannot list any other file (a check constraint, in
--    case a file got in some other way).
-- 4. Tidying: the three tables added by 20261016_164 also lose the
--    TRUNCATE privilege Supabase grants by default.

create or replace function public.delivery_file_extensions()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tif', 'tiff', 'bmp',
    'psd', 'psb', 'clip', 'kra', 'procreate', 'xcf', 'ai', 'eps', 'afphoto', 'afdesign',
    'mp4', 'mov', 'webm', 'mkv',
    'mp3', 'wav', 'ogg', 'm4a', 'flac',
    'vrm', 'fbx', 'glb', 'gltf', 'obj', 'blend', 'moc3', 'cmo3', 'can3', 'json',
    'ttf', 'otf', 'woff', 'woff2',
    'pdf', 'txt',
    'zip'
  ]::text[];
$$;

create or replace function public.is_allowed_delivery_file_name(p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    -- The extension of the last part of the path, which must have a name
    -- before the dot (".png" alone is not an image).
    lower(substring(p_name from '(?:^|/)[^/]+\.([A-Za-z0-9]+)$')) = any (public.delivery_file_extensions()),
    false
  );
$$;

create or replace function public.all_delivery_file_names_allowed(p_names text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select not exists (
    select 1
    from unnest(coalesce(p_names, '{}'::text[])) as given(name)
    where not public.is_allowed_delivery_file_name(given.name)
  );
$$;

-- The policy runs as the person uploading.
grant execute on function public.delivery_file_extensions() to authenticated;
grant execute on function public.is_allowed_delivery_file_name(text) to authenticated;
grant execute on function public.all_delivery_file_names_allowed(text[]) to authenticated;

-- 2. As in 20261016_164, plus the file type.
drop policy if exists "delivery files creator upload" on storage.objects;
create policy "delivery files creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-files'
    and public.is_allowed_delivery_file_name(objects.name)
    and exists (
      select 1
      from public.listing_request_agreements
      inner join public.listing_requests
        on listing_requests.id = listing_request_agreements.listing_request_id
      where listing_request_agreements.id::text = (storage.foldername(objects.name))[1]
        and listing_request_agreements.creator_user_id = auth.uid()
        and listing_request_agreements.status = 'buyer_accepted'
        and listing_requests.status = 'accepted'
        and public.commission_delivery_storage_bytes(listing_requests.id)
          < public.commission_storage_limit_bytes(listing_requests.id)
    )
  );

-- 3.
alter table public.listing_request_final_deliveries
  drop constraint if exists listing_request_final_deliveries_file_types_check;

alter table public.listing_request_final_deliveries
  add constraint listing_request_final_deliveries_file_types_check
    check (public.all_delivery_file_names_allowed(delivery_file_paths));

-- 4.
revoke truncate on public.commission_storage_plans from anon, authenticated;
revoke truncate on public.creator_storage_plan_grants from anon, authenticated;
revoke truncate on public.delivery_file_downloads from anon, authenticated;
