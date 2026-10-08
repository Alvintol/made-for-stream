-- =====================================================================
-- 20261008_150: private account details, and email preferences
--
-- 1. user_account_details: the legal details of the person or business
--    behind an account (legal name, date of birth, address, and optional
--    business and tax numbers). Private to the account holder. A row only
--    exists once every required detail is present, so "has a row" means
--    "account details complete".
-- 2. Nobody can create a listing, send a commission request or send an
--    agreement until their own account details exist.
-- 3. The address country becomes the person's country for display
--    currency too (user_display_preferences.country_code), so there is one
--    country per account. The API reads the billing country, region and
--    postal code for tax from user_account_details.
-- 4. user_email_preferences: the opt-in for promotional email, off by
--    default, with the time it last changed.
--
-- Playbook: docs/support/profiles/account-details.md (ACC-001..004).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Private account details
-- ---------------------------------------------------------------------

create table if not exists public.user_account_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null default 'individual'
    check (account_type in ('individual', 'business')),
  legal_first_name text not null check (char_length(legal_first_name) between 1 and 100),
  legal_last_name text not null check (char_length(legal_last_name) between 1 and 100),
  date_of_birth date not null,
  address_line1 text not null check (char_length(address_line1) between 1 and 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text not null check (char_length(city) between 1 and 100),
  -- Two capital letters for Canada and the United States (a province or
  -- state code, which tax depends on); free text or empty elsewhere.
  region text check (char_length(region) <= 100),
  postal_code text check (char_length(postal_code) <= 20),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  -- Optional, except the business name on a business account.
  business_legal_name text check (char_length(business_legal_name) <= 200),
  business_registration_number text check (char_length(business_registration_number) <= 60),
  tax_number text check (char_length(tax_number) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_account_details is
  'Legal details of the person or business behind an account. Never public: readable and writable by that person alone. A row exists only when every required detail is present.';

alter table public.user_account_details enable row level security;

drop policy if exists "account details read own" on public.user_account_details;
create policy "account details read own" on public.user_account_details
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "account details insert own" on public.user_account_details;
create policy "account details insert own" on public.user_account_details
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "account details update own" on public.user_account_details;
create policy "account details update own" on public.user_account_details
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy: the details are kept while the account exists, and go
-- with it (on delete cascade).
revoke all on public.user_account_details from anon;
revoke all on public.user_account_details from authenticated;
grant select, insert, update on public.user_account_details to authenticated;

-- Tidies what was typed and refuses anything incomplete, so a saved row is
-- always a complete one.
create or replace function public.validate_user_account_details()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.legal_first_name := btrim(coalesce(new.legal_first_name, ''));
  new.legal_last_name := btrim(coalesce(new.legal_last_name, ''));
  new.address_line1 := btrim(coalesce(new.address_line1, ''));
  new.address_line2 := nullif(btrim(coalesce(new.address_line2, '')), '');
  new.city := btrim(coalesce(new.city, ''));
  new.region := nullif(btrim(coalesce(new.region, '')), '');
  new.postal_code := nullif(upper(btrim(coalesce(new.postal_code, ''))), '');
  new.country_code := upper(btrim(coalesce(new.country_code, '')));
  new.business_legal_name := nullif(btrim(coalesce(new.business_legal_name, '')), '');
  new.business_registration_number :=
    nullif(btrim(coalesce(new.business_registration_number, '')), '');
  new.tax_number := nullif(btrim(coalesce(new.tax_number, '')), '');

  if new.legal_first_name = '' or new.legal_last_name = ''
    or new.address_line1 = '' or new.city = ''
    or new.country_code = '' or new.date_of_birth is null
  then
    raise exception 'Fill in every required account detail before saving.'
      using errcode = '22023';
  end if;

  if new.date_of_birth < date '1900-01-01' or new.date_of_birth > current_date then
    raise exception 'Enter a valid date of birth.'
      using errcode = '22023';
  end if;

  -- Terms of Service section 3.
  if new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'You must be at least 18 to use Made for Stream.'
      using errcode = '22023';
  end if;

  if new.country_code in ('CA', 'US') then
    new.region := upper(coalesce(new.region, ''));

    if new.region !~ '^[A-Z]{2}$' or new.postal_code is null then
      raise exception
        'An address in Canada or the United States needs a province or state and a postal or ZIP code.'
        using errcode = '22023';
    end if;
  end if;

  if new.account_type = 'business' and new.business_legal_name is null then
    raise exception 'Enter the legal name of the business.'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists user_account_details_validate on public.user_account_details;
create trigger user_account_details_validate
  before insert or update on public.user_account_details
  for each row execute function public.validate_user_account_details();

-- One country per account: the address country is also the country the
-- display currency follows.
create or replace function public.sync_user_account_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_display_preferences (user_id, country_code)
  values (new.user_id, new.country_code)
  on conflict (user_id) do update
  set country_code = excluded.country_code;

  return new;
end;
$$;

revoke all on function public.sync_user_account_country() from public, anon, authenticated;

drop trigger if exists user_account_details_sync_country on public.user_account_details;
create trigger user_account_details_sync_country
  after insert or update of country_code on public.user_account_details
  for each row execute function public.sync_user_account_country();

comment on table public.user_display_preferences is
  'A person''s display currency, and their country as copied from user_account_details. Used only to show approximate converted prices. Readable and writable by that person alone.';

-- ---------------------------------------------------------------------
-- 2. No listing, commission request or agreement without account details
-- ---------------------------------------------------------------------

-- TG_ARGV[0] names the column holding the user who must have details.
-- The database owner and the service role (auth.uid() is null) are let
-- through, so seed data and repairs still work.
create or replace function public.enforce_account_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_user_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if auth.uid() is not null
    and not exists (
      select 1 from public.user_account_details
      where user_account_details.user_id = required_user_id
    )
  then
    raise exception 'Add your account details in Settings before you can do this.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_account_details() from public, anon, authenticated;

drop trigger if exists listings_require_account_details on public.listings;
create trigger listings_require_account_details
  before insert on public.listings
  for each row execute function public.enforce_account_details('user_id');

drop trigger if exists listing_requests_require_account_details on public.listing_requests;
create trigger listing_requests_require_account_details
  before insert on public.listing_requests
  for each row execute function public.enforce_account_details('buyer_user_id');

drop trigger if exists listing_request_agreements_require_account_details
  on public.listing_request_agreements;
create trigger listing_request_agreements_require_account_details
  before insert on public.listing_request_agreements
  for each row execute function public.enforce_account_details('creator_user_id');

-- ---------------------------------------------------------------------
-- 3. Email preferences
-- ---------------------------------------------------------------------

create table if not exists public.user_email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Promotions and news. Off unless the person turns it on themselves.
  marketing_emails boolean not null default false,
  -- When the choice above last changed: the record of consent, or of its
  -- withdrawal.
  marketing_emails_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.user_email_preferences is
  'Whether a person has opted in to promotional email, and when that choice last changed. Service emails are not affected. Readable and writable by that person alone.';

alter table public.user_email_preferences enable row level security;

drop policy if exists "email preferences read own" on public.user_email_preferences;
create policy "email preferences read own" on public.user_email_preferences
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "email preferences insert own" on public.user_email_preferences;
create policy "email preferences insert own" on public.user_email_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "email preferences update own" on public.user_email_preferences;
create policy "email preferences update own" on public.user_email_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_email_preferences from anon;
revoke all on public.user_email_preferences from authenticated;
grant select, insert, update on public.user_email_preferences to authenticated;

-- The time is the database's, never the browser's.
create or replace function public.stamp_user_email_preferences()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.marketing_emails_changed_at := now();
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.marketing_emails_changed_at :=
      case
        when new.marketing_emails is distinct from old.marketing_emails then now()
        else old.marketing_emails_changed_at
      end;
  end if;

  return new;
end;
$$;

drop trigger if exists user_email_preferences_stamp on public.user_email_preferences;
create trigger user_email_preferences_stamp
  before insert or update on public.user_email_preferences
  for each row execute function public.stamp_user_email_preferences();
