-- Currency foundations, found missing in the 2026-10 rehearsal:
--
--   * A listing stored a bare number, shown everywhere as "$". An Irish
--     creator's 50 read as "$50".
--   * Every project agreement was created in CAD whoever the creator was:
--     the form defaulted to CAD and nothing passed it the creator's currency.
--
-- 1. listings.currency: always the creator's payout currency, set by the
--    database. A creator with no payout account yet keeps what the listing
--    has (CAD for a new one, which is what "$" has meant so far).
-- 2. A project agreement must be in the creator's payout currency, and each
--    payment in an agreement must be in that agreement's currency (AGR-008).
-- 3. user_display_preferences: a signed-in person's country and the currency
--    they want prices shown in. Private to them: profiles is readable by
--    everyone, so these do not live there.
--
-- Showing a converted price is display only. Nothing here changes what is
-- charged: agreements, payments and refunds stay in the creator's currency.

-- ---------------------------------------------------------------------
-- 1. Listing currency
-- ---------------------------------------------------------------------

alter table public.listings
  add column if not exists currency text not null default 'cad'
    references public.supported_currencies (code);

comment on column public.listings.currency is
  'The currency the listing''s prices are in: the creator''s payout currency (creator_payment_accounts.default_currency). Maintained by triggers; a client cannot choose it.';

create or replace function public.set_listing_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout_currency text;
begin
  select account.default_currency
    into payout_currency
    from public.creator_payment_accounts as account
    join public.supported_currencies as supported
      on supported.code = account.default_currency
   where account.user_id = new.user_id
     and account.provider = 'stripe';

  if payout_currency is not null then
    new.currency := payout_currency;
  elsif tg_op = 'INSERT' then
    new.currency := 'cad';
  else
    new.currency := old.currency;
  end if;

  return new;
end;
$$;

revoke all on function public.set_listing_currency() from public, anon, authenticated;

drop trigger if exists listings_set_currency on public.listings;
create trigger listings_set_currency
  before insert or update on public.listings
  for each row execute function public.set_listing_currency();

-- When a creator's payout account is created (the only time its currency is
-- set), move their listings onto it.
create or replace function public.sync_listing_currency_from_payment_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.supported_currencies where code = new.default_currency
  ) then
    update public.listings
       set currency = new.default_currency
     where user_id = new.user_id
       and currency is distinct from new.default_currency;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_listing_currency_from_payment_account() from public, anon, authenticated;

drop trigger if exists creator_payment_accounts_sync_listing_currency on public.creator_payment_accounts;
create trigger creator_payment_accounts_sync_listing_currency
  after insert or update of default_currency on public.creator_payment_accounts
  for each row execute function public.sync_listing_currency_from_payment_account();

-- Existing listings: creators who already have a payout account move to its
-- currency; everyone else stays on CAD (decided 2026-10-07).
update public.listings as listing
   set currency = account.default_currency
  from public.creator_payment_accounts as account
  join public.supported_currencies as supported
    on supported.code = account.default_currency
 where account.user_id = listing.user_id
   and account.provider = 'stripe'
   and listing.currency is distinct from account.default_currency;

-- ---------------------------------------------------------------------
-- 2. Agreements and their payments follow the creator's currency
-- ---------------------------------------------------------------------

create or replace function public.enforce_listing_request_agreement_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout_currency text;
begin
  select account.default_currency
    into payout_currency
    from public.creator_payment_accounts as account
   where account.user_id = new.creator_user_id
     and account.provider = 'stripe';

  -- No payout account: other gates (CON-007) decide whether paid work can
  -- start at all. This rule only says which currency, once there is one.
  if payout_currency is not null
     and lower(new.currency) <> lower(payout_currency)
  then
    raise exception
      'AGR-008: A project agreement must be priced in the creator''s payout currency (%), not %.',
      upper(payout_currency), upper(new.currency)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_request_agreement_currency() from public, anon, authenticated;

drop trigger if exists listing_request_agreements_enforce_currency on public.listing_request_agreements;
create trigger listing_request_agreements_enforce_currency
  before insert or update of currency, creator_user_id on public.listing_request_agreements
  for each row execute function public.enforce_listing_request_agreement_currency();

create or replace function public.enforce_listing_request_schedule_item_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_currency text;
begin
  select agreement.currency
    into agreement_currency
    from public.listing_request_agreements as agreement
   where agreement.id = new.agreement_id;

  if agreement_currency is not null
     and lower(new.currency) <> lower(agreement_currency)
  then
    raise exception
      'AGR-008: A payment must be in its agreement''s currency (%), not %.',
      upper(agreement_currency), upper(new.currency)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_request_schedule_item_currency() from public, anon, authenticated;

drop trigger if exists listing_request_payment_schedule_items_enforce_currency
  on public.listing_request_payment_schedule_items;
create trigger listing_request_payment_schedule_items_enforce_currency
  before insert or update of currency, agreement_id on public.listing_request_payment_schedule_items
  for each row execute function public.enforce_listing_request_schedule_item_currency();

-- ---------------------------------------------------------------------
-- 3. Private display preferences
-- ---------------------------------------------------------------------

create table if not exists public.user_display_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Asked only to choose a default display currency. Two capital letters.
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  -- Null means "follow my country".
  display_currency text references public.supported_currencies (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_display_preferences is
  'A person''s country and preferred display currency, used only to show approximate converted prices. Readable and writable by that person alone.';

alter table public.user_display_preferences enable row level security;

drop policy if exists "display preferences read own" on public.user_display_preferences;
create policy "display preferences read own" on public.user_display_preferences
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "display preferences insert own" on public.user_display_preferences;
create policy "display preferences insert own" on public.user_display_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "display preferences update own" on public.user_display_preferences;
create policy "display preferences update own" on public.user_display_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_display_preferences from anon;
grant select, insert, update on public.user_display_preferences to authenticated;

drop trigger if exists user_display_preferences_set_updated_at on public.user_display_preferences;
create trigger user_display_preferences_set_updated_at
  before update on public.user_display_preferences
  for each row execute function public.set_updated_at();
