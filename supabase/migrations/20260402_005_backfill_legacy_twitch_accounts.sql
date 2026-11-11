-- Move any legacy Twitch data from profiles into profile_platform_accounts
-- Safe to keep around in repo even after old columns are gone
do $$ begin if exists (
  select
    1
  from
    information_schema.columns
  where
    table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'twitch_user_id'
) then execute $sql$
insert into
  public.profile_platform_accounts (
    profile_user_id,
    platform,
    platform_user_id,
    platform_login,
    platform_display_name,
    profile_url,
    account_created_at,
    connected_at,
    metadata
  )
select
  p.user_id,
  'twitch',
  p.twitch_user_id,
  p.twitch_login,
  p.twitch_login,
  case
    when p.twitch_login is not null then 'https://twitch.tv/' || p.twitch_login
    else null
  end,
  p.twitch_created_at,
  coalesce(p.twitch_connected_at, now()),
  jsonb_build_object(
    'legacy_twitch_age_ok',
    p.twitch_age_ok
  )
from
  public.profiles p
where
  p.twitch_user_id is not null on conflict (platform, platform_user_id) do
update
set
  platform_login = excluded.platform_login,
  platform_display_name = excluded.platform_display_name,
  profile_url = excluded.profile_url,
  account_created_at = excluded.account_created_at,
  connected_at = excluded.connected_at,
  metadata = excluded.metadata,
  updated_at = now() $sql$;

end if;

end $$;