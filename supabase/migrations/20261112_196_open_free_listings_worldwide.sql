-- Free listings everywhere outside Canada and the US (decided 2026-11-12).
--
-- During the beta, only Canada and the US were open (20261031_177). Since no
-- money can move before launch (20261110_193), people anywhere else can now
-- make an account, save their address, apply to be a creator and post free
-- listings, on the same terms Quebec got in 20261112_195:
--   - no paid listing, and no switching a listing to paid;
--   - no commission request to or from them;
--   - no project agreement, and no checkout;
--   - no moving an address there while paid listings are published.
-- Sanctioned countries stay refused everywhere: the sanctions apply whether
-- or not money moves.
--
-- Payout accounts still open only in Canada and the US (OPEN_COUNTRIES in
-- api/supportedCountries.js); nothing here changes that.
-- Recorded in the Terms (version 2026-11-12-2, section 3).
--
-- Playbook: docs/support/profiles/account-details.md (ACC-006).

-- 1. Where only free listings are allowed: Quebec until the site is in
-- French, and every unsanctioned country outside Canada and the US.

create or replace function public.is_free_only_location(p_country text, p_region text)
returns boolean
language sql
immutable
as $$
  select public.sanctioned_country_message(p_country) is null
    and (
      (upper(btrim(coalesce(p_country, ''))) = 'CA' and upper(btrim(coalesce(p_region, ''))) = 'QC')
      or upper(btrim(coalesce(p_country, ''))) not in ('', 'CA', 'US')
    );
$$;

-- 2. What refuses everything but free listings there. The same list as
-- 20261112_195; the beta's sentence now says what is open.
-- src/domain/settings/accountDetails.ts mirrors it for the form.

create or replace function public.blocked_location_message(p_country text, p_region text)
returns text
language sql
immutable
as $$
  select coalesce(
    public.sanctioned_country_message(p_country),
    case
      when upper(btrim(coalesce(p_country, ''))) = 'CA'
        and upper(btrim(coalesce(p_region, ''))) = 'QC' then
        'In Quebec, Made for Stream only offers free listings for now. Commissions and payments open there once the site is in French.'
      when upper(btrim(coalesce(p_country, ''))) not in ('', 'CA', 'US') then
        'Outside Canada and the United States, Made for Stream only offers free listings during the beta. Commissions and payments aren''t open there yet.'
    end
  );
$$;

-- 3. The sentence for refusing a paid listing there, or null where paid
-- listings are allowed.

create or replace function public.free_only_listing_message(p_country text, p_region text)
returns text
language sql
immutable
as $$
  select case
    when not public.is_free_only_location(p_country, p_region) then null
    when upper(btrim(coalesce(p_country, ''))) = 'CA' then
      'From Quebec, you can only post free listings for now. Paid listings, commissions and payments open there once the site is in French.'
    else
      'Outside Canada and the United States, you can only post free listings during the beta. Paid listings, commissions and payments aren''t open there yet.'
  end;
$$;

-- 4. Saving account details: a free-only place can be saved, unless the
-- account still has published paid listings.

create or replace function public.refuse_blocked_account_location()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  message text := public.blocked_location_message(new.country_code, new.region);
begin
  if message is null then
    return new;
  end if;

  if not public.is_free_only_location(new.country_code, new.region) then
    raise exception '%', message using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.listings
    where listings.user_id = new.user_id
      and listings.status = 'published'
      and not listings.is_free
  ) then
    raise exception 'Where you live, you can only offer free listings for now. Unpublish your paid listings first, then save your address.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 5. Creating a listing, request or agreement: in a free-only place, a free
-- listing and nothing else that blocked_location_message() refuses.

create or replace function public.enforce_account_details()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  required_user_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  details public.user_account_details%rowtype;
  message text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into details
  from public.user_account_details
  where user_account_details.user_id = required_user_id;

  if not found then
    raise exception 'Add your account details in Settings before you can do this.'
      using errcode = 'P0001';
  end if;

  message := public.blocked_location_message(details.country_code, details.region);

  if message is not null then
    if tg_table_name = 'listings'
      and public.is_free_only_location(details.country_code, details.region) then
      if coalesce((to_jsonb(new) ->> 'is_free')::boolean, false) is not true then
        raise exception '%', public.free_only_listing_message(details.country_code, details.region)
          using errcode = 'P0001';
      end if;
    else
      raise exception '%', message using errcode = 'P0001';
    end if;
  end if;

  if not exists (
    select 1 from public.profiles
    where profiles.user_id = required_user_id
      and not profiles.display_name_auto
  ) then
    raise exception 'Choose a public display name in Settings before you can do this.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 6. Turning a free listing into a paid one (trigger from 20261112_195).

create or replace function public.refuse_paid_listing_from_free_only_location()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  message text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select public.free_only_listing_message(details.country_code, details.region)
  into message
  from public.user_account_details as details
  where details.user_id = new.user_id;

  if message is not null then
    raise exception '%', message using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Commission requests to a creator in a free-only place: unchanged from
-- 20261112_195 (refuse_request_to_free_only_creator reads
-- is_free_only_location, which now covers them).
