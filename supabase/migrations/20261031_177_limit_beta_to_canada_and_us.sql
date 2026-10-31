-- The beta is open to Canada and the United States only (owner's decision,
-- 2026-10-31). Quebec stays blocked until French is ready.
--
-- This reaches every place 20261029_171 enforces, because they all read
-- blocked_location_message(): saving account details, creating a listing,
-- request or agreement, and opening checkout. The account address decides.
--
-- The internet address is still checked for sanctions only: a Canadian paying
-- from a hotel abroad is not refused, and neither is someone using a VPN.
--
-- One test account was saved in Ireland when this was written. It keeps its
-- row, but cannot do any of those things until it moves to Canada or the US.
--
-- To open another country: add it to the list below, to OPEN_COUNTRIES in
-- src/domain/payments/supportedCountries.ts and to api/supportedCountries.js.
-- Playbook: docs/support/profiles/account-details.md (ACC-006).

-- 1. Sanctions on their own, because the API's internet address check uses
-- only this part.

create or replace function public.sanctioned_country_message(p_country text)
returns text
language sql
immutable
as $$
  select case
    when upper(btrim(coalesce(p_country, ''))) in ('BY', 'CU', 'IR', 'KP', 'RU', 'SY') then
      'Made for Stream can''t be used from Belarus, Cuba, Iran, North Korea, Russia or Syria, because of the sanctions that apply to it and its payment provider.'
  end;
$$;

-- 2. The list. Null when the place is allowed, otherwise the sentence to show.
-- src/domain/settings/accountDetails.ts mirrors it for the form. An empty
-- country stays allowed here: validate_user_account_details() asks for it.

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
        'Made for Stream isn''t available in Quebec yet. The site has to be in French first, and that''s on the way.'
      when upper(btrim(coalesce(p_country, ''))) not in ('', 'CA', 'US') then
        'During the beta, Made for Stream is only open in Canada and the United States.'
    end
  );
$$;

-- 3. The API's checkout check: the payer's saved address decides everything,
-- and the internet address is checked for sanctions only.

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
    public.sanctioned_country_message(p_ip_country)
  );
$$;

revoke all on function public.blocked_checkout_message(uuid, text) from public, anon, authenticated;
grant execute on function public.blocked_checkout_message(uuid, text) to service_role;
