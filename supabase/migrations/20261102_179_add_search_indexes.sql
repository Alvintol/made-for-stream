-- Search that stays fast (2026-11-02). Search used to read every public listing
-- until a page filled, so a word nobody used read all of them. These indexes find
-- matching rows straight away, which matters most for searches a script could
-- repeat. Words of one or two letters are too short for this kind of index and
-- still read the listings; the 3 second limit on anonymous queries covers them.
--
-- Search text is capped at 100 characters. "Open only" on the creators page now
-- checks for a listing without adding up every creator's listings first.
--
-- A creators search now also matches listing titles and descriptions, because it
-- uses the listings index. Before, it matched only tags and categories.
--
-- Both functions now run as security definer, not as the person asking. Row level
-- security stops Postgres using a LIKE index, because LIKE could reveal rows the
-- policies hide, so under it every rare search read every listing. They show the
-- same rows as before: each states the public rules itself (published, active,
-- not hidden, and Twitch details only for a creator with a handle), which is as
-- strict as the read policies on listings, profiles and profile_platform_accounts
-- or stricter. If those policies tighten, tighten these too.
--
-- Playbook: docs/support/site/efficient-reads.md.

create extension if not exists pg_trgm with schema extensions;

-- 1. Text to search, lower case. Immutable so an index can use it. It has no "set
-- search_path" because that would make every call about twice as slow, and it
-- names pg_catalog itself so it cannot pick up anything else.
--
-- Two choices on the indexes, both measured with 50,000 listings:
--   * They cover every row, not just public ones. Postgres keeps no statistics for
--     a partial index, so it could not tell a common word from a rare one, and
--     common words took 400 ms by reading every match instead of the newest few.
--   * fastupdate is off. With it on, new rows wait in an unindexed queue that each
--     search reads. Writes are rare here and reads are not.

create or replace function public.search_text(variadic p_parts text[])
returns text
language sql
immutable
parallel safe
as $$
  select pg_catalog.lower(pg_catalog.array_to_string(p_parts, ' '));
$$;

create index if not exists listings_market_search_idx
  on public.listings
  using gin (
    public.search_text(
      variadic array[title, short, category, offering_type, video_subtype] || deliverables || tags
    ) extensions.gin_trgm_ops
  )
  with (fastupdate = off);

create index if not exists profiles_name_search_idx
  on public.profiles
  using gin (public.search_text(display_name, handle) extensions.gin_trgm_ops)
  with (fastupdate = off);

create index if not exists profiles_bio_search_idx
  on public.profiles
  using gin (public.search_text(bio) extensions.gin_trgm_ops)
  with (fastupdate = off);

create index if not exists profile_platform_accounts_twitch_search_idx
  on public.profile_platform_accounts
  using gin (public.search_text(platform_login, platform_display_name) extensions.gin_trgm_ops)
  with (fastupdate = off)
  where platform = 'twitch';

-- 2. What someone typed, now capped.

create or replace function public.contains_pattern(p_text text)
returns text
language sql
immutable
as $$
  select case
    when btrim(coalesce(p_text, '')) = '' then null
    else '%' || replace(replace(replace(left(lower(btrim(p_text)), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  end;
$$;

-- 3. The same two functions, searching through the indexes. Creators are matched
-- first and their ids handed to the listing search, because one index cannot
-- cover two tables.

create or replace function public.market_listings(
  p_q text default null,
  p_category text default null,
  p_type text default null,
  p_video text default null,
  p_free_only boolean default false,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  short text,
  offering_type text,
  category text,
  video_subtype text,
  price_type text,
  price_min integer,
  price_max integer,
  currency text,
  preview_url text,
  is_free boolean,
  created_at timestamptz,
  creator_handle text,
  creator_name text,
  twitch_login text
)
language plpgsql
stable
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
declare
  v_pattern text := public.contains_pattern(p_q);
  v_creators uuid[];
begin
  if v_pattern is not null then
    v_creators := array(
      select named.user_id
      from public.profiles as named
      where public.search_text(named.display_name, named.handle) like v_pattern
      union
      select linked.profile_user_id
      from public.profile_platform_accounts as linked
      join public.profiles as owner_profile
        on owner_profile.user_id = linked.profile_user_id and owner_profile.handle is not null
      where linked.platform = 'twitch'
        and public.search_text(linked.platform_login, linked.platform_display_name) like v_pattern
    );
  end if;

  return query
  select
    listing.id,
    listing.user_id,
    listing.title,
    listing.short,
    listing.offering_type,
    listing.category,
    listing.video_subtype,
    listing.price_type,
    listing.price_min,
    listing.price_max,
    listing.currency,
    listing.preview_url,
    listing.is_free,
    listing.created_at,
    creator.handle,
    creator.display_name,
    twitch.platform_login
  from public.listings as listing
  left join public.profiles as creator on creator.user_id = listing.user_id
  left join public.profile_platform_accounts as twitch
    on twitch.profile_user_id = listing.user_id
    and twitch.platform = 'twitch'
    and creator.handle is not null
  where listing.status = 'published'
    and listing.is_active
    and listing.admin_hidden_at is null
    and (p_free_only is not true or listing.is_free)
    and (p_category is null or listing.category = p_category)
    and (p_type is null or listing.offering_type = p_type)
    and (p_video is null or (listing.category = 'video-editing' and listing.video_subtype = p_video))
    and (
      p_after_created_at is null
      or (listing.created_at, listing.id) < (p_after_created_at, p_after_id)
    )
    and (
      v_pattern is null
      or public.search_text(
        variadic array[
          listing.title,
          listing.short,
          listing.category,
          listing.offering_type,
          listing.video_subtype
        ] || listing.deliverables || listing.tags
      ) like v_pattern
      or listing.user_id = any (v_creators)
    )
  order by listing.created_at desc, listing.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 48) + 1;
end;
$$;

create or replace function public.creator_directory(
  p_q text default null,
  p_only_open boolean default false,
  p_logins text[] default null,
  p_after_handle text default null,
  p_limit integer default 24
)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  bio text,
  avatar_url text,
  twitch_login text,
  twitch_user_id text,
  twitch_url text,
  youtube_user_id text,
  youtube_login text,
  youtube_url text,
  specialties text[],
  tags text[],
  listing_count integer
)
language plpgsql
stable
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
declare
  v_pattern text := public.contains_pattern(p_q);
  v_listing_creators uuid[];
begin
  if v_pattern is not null then
    -- ponytail: the first 5,000 matching listings, so a very common word stays
    -- cheap. Past that a creator can be missed; page through creators if it matters.
    v_listing_creators := array(
      select distinct capped.user_id
      from (
        select matched.user_id
        from public.listings as matched
        where matched.status = 'published'
          and matched.is_active
          and matched.admin_hidden_at is null
          and public.search_text(
            variadic array[
              matched.title,
              matched.short,
              matched.category,
              matched.offering_type,
              matched.video_subtype
            ] || matched.deliverables || matched.tags
          ) like v_pattern
        limit 5000
      ) as capped
    );
  end if;

  return query
  select
    profile.user_id,
    profile.handle,
    profile.display_name,
    profile.bio,
    profile.avatar_url,
    twitch.platform_login,
    twitch.platform_user_id,
    twitch.profile_url,
    youtube.platform_user_id,
    youtube.platform_login,
    youtube.profile_url,
    coalesce(summary.specialties, '{}'),
    coalesce(summary.tags, '{}'),
    coalesce(summary.listing_count, 0)
  from public.profiles as profile
  left join public.profile_platform_accounts as twitch
    on twitch.profile_user_id = profile.user_id and twitch.platform = 'twitch'
  left join public.profile_platform_accounts as youtube
    on youtube.profile_user_id = profile.user_id and youtube.platform = 'youtube'
  left join lateral (
    select
      count(*)::integer as listing_count,
      array_agg(distinct listing.category) filter (where listing.category is not null) as specialties,
      (
        select array_agg(distinct tag)
        from public.listings as tagged
        cross join lateral unnest(
          coalesce(tagged.tags, '{}') || array[tagged.category, tagged.offering_type]
        ) as tag
        where tagged.user_id = profile.user_id
          and tagged.status = 'published'
          and tagged.is_active
          and tagged.admin_hidden_at is null
          and tag is not null
      ) as tags
    from public.listings as listing
    where listing.user_id = profile.user_id
      and listing.status = 'published'
      and listing.is_active
      and listing.admin_hidden_at is null
  ) as summary on true
  where profile.handle is not null
    and (p_after_handle is null or profile.handle > p_after_handle)
    and (
      p_only_open is not true
      or exists (
        select 1
        from public.listings as open_listing
        where open_listing.user_id = profile.user_id
          and open_listing.status = 'published'
          and open_listing.is_active
          and open_listing.admin_hidden_at is null
      )
    )
    and (p_logins is null or lower(twitch.platform_login) = any (p_logins))
    and (
      v_pattern is null
      or public.search_text(profile.display_name, profile.handle) like v_pattern
      or public.search_text(profile.bio) like v_pattern
      or profile.user_id = any (v_listing_creators)
    )
  order by profile.handle
  limit least(greatest(coalesce(p_limit, 24), 1), 48) + 1;
end;
$$;

revoke all on function public.market_listings(text, text, text, text, boolean, timestamptz, uuid, integer) from public;
revoke all on function public.creator_directory(text, boolean, text[], text, integer) from public;

grant execute on function public.market_listings(text, text, text, text, boolean, timestamptz, uuid, integer) to anon, authenticated;
grant execute on function public.creator_directory(text, boolean, text[], text, integer) to anon, authenticated;
