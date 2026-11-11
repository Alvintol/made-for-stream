-- Added 2026-11-11 so the chain replays on an empty database (prod).
--
-- These tables were made by hand on dev before supabase/migrations existed,
-- so no migration created them, and 20260402_001 onwards assumes they're
-- there. Each is created here in the shape the next migrations expect: the
-- columns and constraints no later migration adds. Later files add the rest.
--
-- On dev every table already exists, so this file changes nothing there
-- ("if not exists" throughout). It is never applied to dev by hand.
-- listing_request_milestone_submissions has its own file,
-- 20260616_098_a_create_listing_request_milestone_submissions_table.sql,
-- because it needs tables that come later.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name_auto boolean not null default true,
  profile_setup_seen boolean not null default false,
  auth_provider_last_used text
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 80),
  short text not null check (char_length(short) >= 10 and char_length(short) <= 280),
  offering_type text not null check (offering_type in ('digital', 'commission', 'service')),
  category text not null,
  video_subtype text check (video_subtype in ('long-form', 'short-form')),
  price_type text not null check (price_type in ('fixed', 'starting_at', 'range')),
  price_min integer not null check (price_min >= 0),
  price_max integer,
  deliverables text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  preview_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_check check (price_max is null or price_max >= price_min)
);

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'needs_changes')),
  reviewer_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_applications_one_per_profile_unique unique (profile_user_id)
);

create table if not exists public.user_favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('creator', 'listing')),
  target_id text not null,
  created_at timestamptz not null default now(),
  constraint user_favourites_user_target_unique unique (user_id, target_type, target_id)
);

-- The next five are unused by the site today; they exist on dev, so prod
-- matches it.
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(user_id) on delete set null,
  slug text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  banner_url text,
  is_open boolean not null default true,
  is_live boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_platform_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  platform text not null check (platform in ('twitch', 'youtube')),
  platform_user_id text not null,
  platform_login text,
  platform_display_name text,
  profile_url text,
  avatar_url text,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_platform_accounts_creator_platform_unique unique (creator_id, platform),
  constraint creator_platform_accounts_platform_identity_unique unique (platform, platform_user_id)
);

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_payout_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  requirements_due jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  subscription_id text unique,
  tier text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
