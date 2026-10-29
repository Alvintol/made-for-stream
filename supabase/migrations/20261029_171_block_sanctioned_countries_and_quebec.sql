-- Places Made for Stream does not serve (decided 2026-10-28).
--
-- 1. Sanctions: Belarus, Cuba, Iran, North Korea, Russia and Syria. Canada
--    sanctions the first group and its payment provider, Stripe, is bound by
--    United States sanctions (Cuba). Stripe already refuses creators there;
--    this stops buyers too.
-- 2. Quebec, until the site is in French: Quebec's language law requires a
--    French version of the site and of the contracts a consumer accepts.
--
-- Enforced in four places, all reading blocked_location_message():
--   - saving account details (the address is the person's location);
--   - creating a listing, a commission request or an agreement, for anyone
--     whose saved address was allowed before (enforce_account_details);
--   - opening checkout (listing_request_payments to checkout_opened);
--   - the API's checkout route also refuses an internet address in a
--     sanctioned country (blocked_checkout_message).
--
-- No saved address was in a blocked place when this was written (CA-AB,
-- IE and US-WA only), so nothing is backfilled.
--
-- ponytail: sanctioned regions inside other countries (Crimea and the other
-- occupied parts of Ukraine) are not told apart from the rest of Ukraine:
-- the address region is free text there. Stripe screens payments and
-- payouts against sanctions lists, including those regions.
--
-- Playbook: docs/support/profiles/account-details.md (ACC-006).

-- 1. The list. Null when the place is allowed, otherwise the sentence to
-- show. src/domain/settings/accountDetails.ts mirrors it for the form.

create or replace function public.blocked_location_message(p_country text, p_region text)
returns text
language sql
immutable
as $$
  select case
    when upper(btrim(coalesce(p_country, ''))) in ('BY', 'CU', 'IR', 'KP', 'RU', 'SY') then
      'Made for Stream can''t be used from Belarus, Cuba, Iran, North Korea, Russia or Syria, because of the sanctions that apply to it and its payment provider.'
    when upper(btrim(coalesce(p_country, ''))) = 'CA'
      and upper(btrim(coalesce(p_region, ''))) = 'QC' then
      'Made for Stream isn''t available in Quebec yet. The site has to be in French first, and that''s on the way.'
  end;
$$;

-- 2. Saving account details. Runs before validate_user_account_details
-- (triggers fire in name order), so it reads the raw values itself.

create or replace function public.refuse_blocked_account_location()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  message text := public.blocked_location_message(new.country_code, new.region);
begin
  if message is not null then
    raise exception '%', message using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists user_account_details_location on public.user_account_details;
create trigger user_account_details_location
  before insert or update on public.user_account_details
  for each row execute function public.refuse_blocked_account_location();

-- 3. Listings, requests and agreements: enforce_account_details(), as last
-- defined in 20261008_152, with the saved address checked too.

create or replace function public.enforce_account_details()
returns trigger
language plpgsql
security definer
set search_path = public
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
    raise exception '%', message using errcode = 'P0001';
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

revoke all on function public.enforce_account_details() from public, anon, authenticated;

-- 4. Opening checkout. The API opens it with the service role, so this
-- applies to everyone, whoever makes the change.

create or replace function public.refuse_checkout_from_blocked_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message text;
begin
  select public.blocked_location_message(details.country_code, details.region)
  into message
  from public.user_account_details as details
  where details.user_id = new.payer_user_id;

  if message is not null then
    raise exception '%', message using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.refuse_checkout_from_blocked_location() from public, anon, authenticated;

drop trigger if exists listing_request_payments_refuse_blocked_location
  on public.listing_request_payments;
create trigger listing_request_payments_refuse_blocked_location
  before update of status on public.listing_request_payments
  for each row
  when (new.status = 'checkout_opened' and old.status is distinct from 'checkout_opened')
  execute function public.refuse_checkout_from_blocked_location();

-- 5. The API's checkout check: the payer's saved address, then the country
-- of the internet address the request came from (Cloudflare's header).
-- Quebec is not judged by internet address: it gives only the country.

create or replace function public.blocked_checkout_message(p_user_id uuid, p_ip_country text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.blocked_location_message(details.country_code, details.region)
      from public.user_account_details as details
      where details.user_id = p_user_id
    ),
    public.blocked_location_message(p_ip_country, null)
  );
$$;

revoke all on function public.blocked_checkout_message(uuid, text) from public, anon, authenticated;
grant execute on function public.blocked_checkout_message(uuid, text) to service_role;
