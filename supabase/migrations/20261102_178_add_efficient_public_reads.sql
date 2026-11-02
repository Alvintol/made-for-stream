-- Reads that scale (2026-11-02). The market, the home page, the creators page
-- and the top bar each loaded whole tables into every visitor's browser and
-- filtered them there. These return one small page instead, in one request,
-- with only the fields a card shows.
--
-- Pages use a cursor, not an offset: the next page starts straight after the
-- last row seen, using the index, so page 500 costs the same as page 1. Each
-- function returns one row more than asked for, which is how the site knows
-- there is another page without counting the whole table.
--
-- ponytail: search is a plain "contains" over each row, stopping once a page is
-- full. Fine well past 100,000 listings; add pg_trgm if search ever gets slow.
--
-- The two page functions are plpgsql planned per call: a plain SQL function with
-- "set search_path" is planned without knowing its arguments, so "p_category is
-- null or category = p_category" could never use an index and the cursor would
-- walk from page 1 each time.
--
-- All three run as the person asking, so row level security still applies.
-- Playbook: docs/support/site/efficient-reads.md.

-- 1. Indexes in the order the market reads: newest first, public listings only.

create index if not exists listings_market_idx
  on public.listings (created_at desc, id desc)
  where status = 'published' and is_active and admin_hidden_at is null;

create index if not exists listings_market_category_idx
  on public.listings (category, created_at desc, id desc)
  where status = 'published' and is_active and admin_hidden_at is null;

create index if not exists listings_market_free_idx
  on public.listings (created_at desc, id desc)
  where status = 'published' and is_active and admin_hidden_at is null and is_free;

-- The creators who are live right now, found by their Twitch login.

create index if not exists profile_platform_accounts_twitch_login_idx
  on public.profile_platform_accounts (lower(platform_login))
  where platform = 'twitch';

-- 2. What someone typed, as a "contains" pattern. Null when they typed nothing.

create or replace function public.contains_pattern(p_text text)
returns text
language sql
immutable
as $$
  select case
    when btrim(coalesce(p_text, '')) = '' then null
    else '%' || replace(replace(replace(lower(btrim(p_text)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  end;
$$;

-- 3. One page of the market, with each listing's creator.

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
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
begin
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
    on twitch.profile_user_id = listing.user_id and twitch.platform = 'twitch'
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
      public.contains_pattern(p_q) is null
      or lower(concat_ws(
        ' ',
        listing.title,
        listing.short,
        listing.category,
        listing.offering_type,
        listing.video_subtype,
        array_to_string(listing.deliverables, ' '),
        array_to_string(listing.tags, ' '),
        creator.display_name,
        creator.handle,
        twitch.platform_login,
        twitch.platform_display_name
      )) like public.contains_pattern(p_q)
    )
  order by listing.created_at desc, listing.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 48) + 1;
end;
$$;

-- 4. One page of creators, each with a short summary of their listings rather
-- than the listings themselves. p_logins limits it to those Twitch logins, for
-- the people who are live right now.

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
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
begin
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
    and (p_only_open is not true or coalesce(summary.listing_count, 0) > 0)
    and (p_logins is null or lower(twitch.platform_login) = any (p_logins))
    and (
      public.contains_pattern(p_q) is null
      or lower(concat_ws(
        ' ',
        profile.display_name,
        profile.handle,
        profile.bio,
        array_to_string(summary.tags, ' ')
      )) like public.contains_pattern(p_q)
    )
  order by profile.handle
  limit least(greatest(coalesce(p_limit, 24), 1), 48) + 1;
end;
$$;

-- 5. The number on the top bar, without reading the inbox. Only conversations
-- with something newer than the person's last read are looked at.

create or replace function public.my_unread_message_count()
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from public.conversations as conversation
  left join public.conversation_participants as participant
    on participant.conversation_id = conversation.id
    and participant.user_id = auth.uid()
  join public.conversation_messages as message
    on message.conversation_id = conversation.id
    and message.sender_user_id <> auth.uid()
    and (participant.last_read_at is null or message.created_at > participant.last_read_at)
  where (conversation.buyer_user_id = auth.uid() or conversation.creator_user_id = auth.uid())
    and conversation.conversation_type in ('creator_inquiry', 'listing_inquiry', 'listing_request')
    and conversation.last_message_at is not null
    and (participant.last_read_at is null or conversation.last_message_at > participant.last_read_at);
$$;

revoke all on function public.market_listings(text, text, text, text, boolean, timestamptz, uuid, integer) from public;
revoke all on function public.creator_directory(text, boolean, text[], text, integer) from public;
revoke all on function public.my_unread_message_count() from public, anon;

grant execute on function public.market_listings(text, text, text, text, boolean, timestamptz, uuid, integer) to anon, authenticated;
grant execute on function public.creator_directory(text, boolean, text[], text, integer) to anon, authenticated;
grant execute on function public.my_unread_message_count() to authenticated;
