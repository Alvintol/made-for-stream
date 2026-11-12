-- Email the team when a creator application is submitted (decided 2026-11-12).
--
-- The website asks the API to send the alert straight after
-- submit_seller_application(); the hourly ops run sends any it missed
-- (api/creatorApplicationAlerts.js). admin_alerted_at says which submission
-- was last alerted: an application is due while it is submitted and either
-- was never alerted or was alerted before its latest submitted_at, so a
-- resubmission after "needs changes" is alerted again. The API claims an
-- alert by setting it before sending, and clears it again if the send fails.
--
-- Applications already in the queue were seen in Admin before this existed,
-- so they are marked as alerted and nobody gets a burst of old emails.
--
-- Playbook: docs/support/creators/applications.md (APP-007).

alter table public.seller_applications
  add column if not exists admin_alerted_at timestamptz;

update public.seller_applications
set admin_alerted_at = coalesce(submitted_at, now())
where admin_alerted_at is null
  and status <> 'draft';

-- The hourly run's lookup.
create index if not exists seller_applications_awaiting_admin_alert
  on public.seller_applications (submitted_at)
  where status = 'submitted';
