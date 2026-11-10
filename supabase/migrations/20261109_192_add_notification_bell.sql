-- The bell on the top bar (NOTIF-006..008,
-- docs/support/messaging/commission-notifications.md).
--
-- Every commission event already lands in listing_request_notifications
-- (20261007_148) and is emailed by the API. The bell lists the same rows on
-- the site. The API writes each row's line when it renders the email: `title`
-- is the email's subject, in the recipient's language, and `link_path` is the
-- page its button opens. Chat rows get no title (the inbox has its own
-- number), and a row with no title is not shown, so rows from before this
-- migration stay out of the bell.
--
-- Site users get their own rows only, and only the columns the bell needs:
-- delivery details (email status, provider ids, failure reasons) stay
-- service-role only. The one thing they can change is `read_at`.

alter table public.listing_request_notifications
  add column if not exists title text,
  add column if not exists link_path text,
  add column if not exists read_at timestamptz;

create index if not exists listing_request_notifications_bell_idx
  on public.listing_request_notifications (recipient_user_id, created_at desc)
  where title is not null;

grant select (id, kind, title, link_path, created_at, read_at)
  on public.listing_request_notifications to authenticated;
grant update (read_at)
  on public.listing_request_notifications to authenticated;

drop policy if exists "notifications read own" on public.listing_request_notifications;
create policy "notifications read own" on public.listing_request_notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));

drop policy if exists "notifications mark own read" on public.listing_request_notifications;
create policy "notifications mark own read" on public.listing_request_notifications
  for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

-- The live signal on insert (20261105_190) comes before the API has written
-- the line, so the bell would miss it. Signal again once the title lands.
drop trigger if exists listing_request_notifications_broadcast_titled on public.listing_request_notifications;
create trigger listing_request_notifications_broadcast_titled
  after update of title on public.listing_request_notifications
  for each row
  when (old.title is null and new.title is not null)
  execute function public.broadcast_listing_request_notification();
