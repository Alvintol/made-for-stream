-- Quebec: free listings only, until the site is in French (decided 2026-11-12).
--
-- Quebec was refused everywhere (20261029_171) because Quebec's language law
-- wants the site, and the contracts a consumer accepts, in French. For the
-- soft launch, people there can now save a Quebec address and post free
-- listings. Everything that sells or contracts work stays shut there:
--   - a paid listing can't be created by, or switched to paid for, a Quebec
--     account;
--   - nobody can send a Quebec creator a commission request;
--   - a Quebec account can't send a request, a project agreement or pay
--     (blocked_location_message() still answers for Quebec there);
--   - an account can't move its address to Quebec while it has published
--     paid listings.
-- Recorded in the Terms (version 2026-11-12, section 3).
--
-- Lifting Quebec fully, once French is ready, is removing its line from
-- blocked_location_message() and is_free_only_location().
--
-- Playbook: docs/support/profiles/account-details.md (ACC-006).

-- 1. Where only free listings are allowed.

create or replace function public.is_free_only_location(p_country text, p_region text)
returns boolean
language sql
immutable
as $$
  select upper(btrim(coalesce(p_country, ''))) = 'CA'
    and upper(btrim(coalesce(p_region, ''))) = 'QC';
$$;

-- 2. The same list as 20261031_177, with Quebec's sentence saying what's open.
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
        'During the beta, Made for Stream is only open in Canada and the United States.'
    end
  );
$$;

-- 3. Saving account details: Quebec can be saved, unless the account still
-- has published paid listings that would then be on sale from there.

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
    raise exception 'From Quebec, you can only offer free listings for now. Unpublish your paid listings first, then save your address.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 4. Creating a listing, request or agreement: a Quebec account may create
-- a free listing, and nothing else that blocked_location_message() refuses.

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
        raise exception 'From Quebec, you can only post free listings for now. Paid listings, commissions and payments open there once the site is in French.'
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

-- 5. Turning a free listing into a paid one.

create or replace function public.refuse_paid_listing_from_free_only_location()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if exists (
    select 1 from public.user_account_details as details
    where details.user_id = new.user_id
      and public.is_free_only_location(details.country_code, details.region)
  ) then
    raise exception 'From Quebec, you can only post free listings for now. Paid listings, commissions and payments open there once the site is in French.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_free_only_location on public.listings;
create trigger listings_free_only_location
  before update of is_free on public.listings
  for each row
  when (new.is_free = false and old.is_free = true)
  execute function public.refuse_paid_listing_from_free_only_location();

-- 6. Commission requests to a Quebec creator.

create or replace function public.refuse_request_to_free_only_creator()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.user_account_details as details
    where details.user_id = new.creator_user_id
      and public.is_free_only_location(details.country_code, details.region)
  ) then
    raise exception 'This creator can only offer free listings for now, so they can''t take commission requests yet.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_requests_free_only_creator on public.listing_requests;
create trigger listing_requests_free_only_creator
  before insert on public.listing_requests
  for each row
  execute function public.refuse_request_to_free_only_creator();

-- Trigger functions aren't called directly (20260922_119).
revoke execute on function public.refuse_paid_listing_from_free_only_location() from public, anon, authenticated;
revoke execute on function public.refuse_request_to_free_only_creator() from public, anon, authenticated;
