-- Added 2026-11-11 so a database built from these files (prod) matches dev.
--
-- Found by replaying every migration on an empty database and comparing the
-- result with dev object by object. Everything below exists on dev but was
-- made by hand, so no migration created it. All of it is "if not exists" or
-- drop-and-recreate, so it changes nothing on dev; it is never applied there.
--
-- The end of the file removes what earlier migrations create but dev no
-- longer has, removed by hand at some point. Most important: the
-- platform-account write rules from 20260402_004 and 20260405_012, which let a
-- signed-in person insert or edit their own linked Twitch or YouTube account,
-- follower counts included. Linking goes through the API; the site never
-- writes that table directly.
--
-- Not copied, on purpose:
--   - public.rls_auto_enable() and its event trigger ensure_rls: Supabase's
--     dashboard setting that turns on RLS for new tables. Every table here
--     turns RLS on itself.
--   - "users can insert their profile" is to authenticated here (20260402_009)
--     and to public on dev; the same rule either way, since auth.uid() is null
--     for a visitor who isn't signed in.

-- Indexes on the tables made before migrations
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_user_id_idx on public.listings (user_id);
create index if not exists seller_applications_profile_user_id_idx on public.seller_applications (profile_user_id);
create index if not exists seller_applications_status_idx on public.seller_applications (status);
create index if not exists user_favourites_target_lookup_idx on public.user_favourites (target_type, target_id);
create index if not exists user_favourites_user_id_idx on public.user_favourites (user_id);
create index if not exists listing_request_milestone_submissions_milestone_idx
  on public.listing_request_milestone_submissions (milestone_id, version_number desc);
create index if not exists listing_request_milestone_submissions_request_idx
  on public.listing_request_milestone_submissions (listing_request_id, submitted_at desc);
create unique index if not exists listing_request_milestone_submissions_active_idx
  on public.listing_request_milestone_submissions (milestone_id) where status = 'submitted';

-- updated_at triggers
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();
drop trigger if exists listing_request_milestone_submissions_set_updated_at on public.listing_request_milestone_submissions;
create trigger listing_request_milestone_submissions_set_updated_at before update on public.listing_request_milestone_submissions
  for each row execute function public.set_updated_at();

-- Constraints
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversation_message_attachments_message_id_fkey') then
    alter table public.conversation_message_attachments
      add constraint conversation_message_attachments_message_id_fkey
      foreign key (message_id) references public.conversation_messages(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_requests_completion_metadata_check') then
    alter table public.listing_requests
      add constraint listing_requests_completion_metadata_check
      check (status <> 'completed' or (completed_at is not null and completed_by_user_id is not null));
  end if;
end $$;

-- Row level security and read-own rules on the tables made before migrations
alter table public.billing_customers enable row level security;
alter table public.creator_payout_accounts enable row level security;
alter table public.creator_platform_accounts enable row level security;
alter table public.creators enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_favourites enable row level security;

drop policy if exists "billing_customers read own" on public.billing_customers;
create policy "billing_customers read own" on public.billing_customers
  for select using (auth.uid() = user_id);
drop policy if exists "payout_accounts read own" on public.creator_payout_accounts;
create policy "payout_accounts read own" on public.creator_payout_accounts
  for select using (auth.uid() = user_id);
drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own" on public.subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "listings owner read" on public.listings;
create policy "listings owner read" on public.listings
  for select using (auth.uid() = user_id);
drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings
  for select using (is_active = true and status = 'published');
drop policy if exists "Users can read own favourites" on public.user_favourites;
create policy "Users can read own favourites" on public.user_favourites
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own favourites" on public.user_favourites;
create policy "Users can insert own favourites" on public.user_favourites
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own favourites" on public.user_favourites;
create policy "Users can delete own favourites" on public.user_favourites
  for delete using (auth.uid() = user_id);
drop policy if exists "milestone participants can read submissions" on public.listing_request_milestone_submissions;
create policy "milestone participants can read submissions" on public.listing_request_milestone_submissions
  for select to authenticated using (
    creator_user_id = auth.uid()
    or buyer_user_id = auth.uid()
    or exists (select 1 from public.admin_roles where admin_roles.profile_user_id = auth.uid())
  );

-- Removed by hand on dev, so removed here too.
drop policy if exists "platform accounts read own" on public.profile_platform_accounts;
drop policy if exists "platform accounts insert own" on public.profile_platform_accounts;
drop policy if exists "platform accounts update own" on public.profile_platform_accounts;
drop policy if exists "platform accounts delete own" on public.profile_platform_accounts;
drop policy if exists "profile_platform_accounts_update_own" on public.profile_platform_accounts;
drop policy if exists "profile_platform_accounts_delete_own" on public.profile_platform_accounts;
drop policy if exists "profiles admin read" on public.profiles;

-- Two checks from 20260429_032 that dev never had (dev ran an earlier draft
-- of it), so nothing on dev was tested against them. 032's other extras stay:
-- conversation_messages_id_conversation_id_key and the attachments'
-- (message_id, conversation_id) key only repeat what the primary keys
-- already guarantee.
alter table public.conversations
  drop constraint if exists conversations_admin_locked_state_check,
  drop constraint if exists conversations_created_by_participant_check;
