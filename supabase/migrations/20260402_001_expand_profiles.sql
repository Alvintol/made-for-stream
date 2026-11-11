-- Future-proof the base user profile table
-- Keep this table platform-agnostic and account-focused
alter table
  public.profiles
add
  column if not exists avatar_url text,
add
  column if not exists banner_url text,
add
  column if not exists website_url text,
add
  column if not exists country_code text,
add
  column if not exists timezone text,
add
  column if not exists profile_visibility text not null default 'public',
add
  column if not exists messaging_enabled boolean not null default true,
add
  column if not exists profile_setup_completed_at timestamptz,
add
  column if not exists onboarding_version integer not null default 1,
add
  column if not exists created_at timestamptz not null default now(),
add
  column if not exists updated_at timestamptz not null default now();

do $$ begin if not exists (
  select
    1
  from
    pg_constraint
  where
    conname = 'profiles_profile_visibility_check'
) then
alter table
  public.profiles
add
  constraint profiles_profile_visibility_check check (profile_visibility in ('private', 'public'));

end if;

end $$;