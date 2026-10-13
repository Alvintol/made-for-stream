-- "Show me what's new after an update" (Settings -> Preferences).
--
-- The list of site versions and their changes is part of the website itself
-- (src/domain/site/siteUpdates.ts), shown at /updates and linked from the
-- footer. This table only remembers, per person:
--   - whether they asked to be shown the latest changes in a window the
--     next time they sign in after an update (off unless they turn it on);
--   - the last version they were shown, so each update appears once, on
--     whichever device they use.
-- Nothing here sends email. Site updates are never emailed.

create table if not exists public.user_site_update_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  show_site_updates boolean not null default false,
  last_seen_version text check (last_seen_version is null or char_length(last_seen_version) <= 40),
  updated_at timestamptz not null default now()
);

alter table public.user_site_update_preferences enable row level security;

drop policy if exists "people read their own site update preference"
  on public.user_site_update_preferences;
create policy "people read their own site update preference"
  on public.user_site_update_preferences
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "people set their own site update preference"
  on public.user_site_update_preferences;
create policy "people set their own site update preference"
  on public.user_site_update_preferences
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "people change their own site update preference"
  on public.user_site_update_preferences;
create policy "people change their own site update preference"
  on public.user_site_update_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.user_site_update_preferences from anon;
grant select, insert, update on public.user_site_update_preferences to authenticated;

drop trigger if exists user_site_update_preferences_set_updated_at
  on public.user_site_update_preferences;
create trigger user_site_update_preferences_set_updated_at
  before update on public.user_site_update_preferences
  for each row execute function public.set_updated_at();
