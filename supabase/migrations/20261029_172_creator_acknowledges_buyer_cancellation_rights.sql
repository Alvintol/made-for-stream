-- A creator confirms they understand an EU, EEA or UK buyer's right to
-- cancel before accepting that buyer's request (decided 2026-10-28).
--
-- Consumers in the EU, the EEA and the UK can usually cancel a purchase of
-- services within 14 days. The buyer already asks for work to start early
-- when accepting the agreement (early_service_request, 20260923_138), which
-- is what the law needs. This adds the creator's side:
--
-- 1. listing_requests.buyer_consumer_rights_region: 'eu' or 'uk', set when
--    the request is sent, from the buyer's account address. Only the label
--    reaches the creator, never the buyer's country. Nobody can change it.
-- 2. listing_requests.creator_consumer_rights_acknowledged_at: when the
--    creator ticked that they understand those rights. Only the creator can
--    set it, the database stamps the time, and it is never cleared.
-- 3. Accepting such a request (submitted to accepted) is refused until it is
--    set.
--
-- No request from an EU, EEA or UK buyer existed when this was written, and
-- none was waiting for the creator's answer, so nothing is backfilled.
--
-- The notice and the box's wording are in
-- src/domain/listings/consumerRights.ts.
-- Playbook: docs/support/requests/request-lifecycle.md (REQ-006).

-- 1. Who has these rights: the 27 EU countries, Iceland, Liechtenstein and
-- Norway ('eu'), and the United Kingdom ('uk').

create or replace function public.consumer_rights_region(p_country text)
returns text
language sql
immutable
as $$
  select case
    when upper(btrim(coalesce(p_country, ''))) in (
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
      'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
      'SI', 'ES', 'SE', 'IS', 'LI', 'NO'
    ) then 'eu'
    when upper(btrim(coalesce(p_country, ''))) = 'GB' then 'uk'
  end;
$$;

-- 2. The columns.

alter table public.listing_requests
  add column if not exists buyer_consumer_rights_region text
    check (buyer_consumer_rights_region in ('eu', 'uk')),
  add column if not exists creator_consumer_rights_acknowledged_at timestamptz;

comment on column public.listing_requests.buyer_consumer_rights_region is
  'eu (EU or EEA) or uk when the buyer''s account address was there when the request was sent: the buyer can usually cancel within 14 days. Set by the database only.';

comment on column public.listing_requests.creator_consumer_rights_acknowledged_at is
  'When the creator confirmed they understand the buyer''s cancellation right, before accepting. Set by the database when the creator sends any value; never cleared.';

-- 3. Sets, protects and enforces both columns.

create or replace function public.apply_listing_request_consumer_rights()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    select public.consumer_rights_region(details.country_code)
    into new.buyer_consumer_rights_region
    from public.user_account_details as details
    where details.user_id = new.buyer_user_id;

    new.creator_consumer_rights_acknowledged_at := null;

    return new;
  end if;

  new.buyer_consumer_rights_region := old.buyer_consumer_rights_region;

  if new.creator_consumer_rights_acknowledged_at is distinct from old.creator_consumer_rights_acknowledged_at then
    if old.creator_consumer_rights_acknowledged_at is not null
      or (auth.uid() is not null and auth.uid() is distinct from old.creator_user_id)
    then
      new.creator_consumer_rights_acknowledged_at := old.creator_consumer_rights_acknowledged_at;
    else
      new.creator_consumer_rights_acknowledged_at := now();
    end if;
  end if;

  if old.status = 'submitted'
    and new.status = 'accepted'
    and new.buyer_consumer_rights_region is not null
    and new.creator_consumer_rights_acknowledged_at is null
  then
    raise exception 'Confirm that you understand this buyer''s right to cancel within 14 days, then accept the request.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.apply_listing_request_consumer_rights() from public, anon, authenticated;

drop trigger if exists listing_requests_consumer_rights on public.listing_requests;
create trigger listing_requests_consumer_rights
  before insert or update on public.listing_requests
  for each row execute function public.apply_listing_request_consumer_rights();
