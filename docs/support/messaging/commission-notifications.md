---
feature: messaging/commission-notifications
status: active
surfaces:
  - public.listing_request_notifications
  - public.enqueue_listing_request_notification()
  - public.enqueue_listing_request_reminders()
  - public.claim_listing_request_notifications()
  - public.notify_listing_request_change()                      # and the six other notify_listing_request_* trigger functions
  - supabase/migrations/20261007_148_add_listing_request_notifications.sql
  - supabase/migrations/20261007_149_add_presence_message_emails_and_cancellation_warnings.sql
  - public.user_presence
  - public.touch_user_presence()
  - public.is_user_online()
  - public.notify_conversation_message()
  - public.enqueue_unread_message_notifications()
  - src/lib/presence/presence.ts
  - api/notificationEmails.js                                   # NOTIFICATION_EMAILS, renderNotificationEmail, getListingRequestUrl
  - api/emailTemplates.js                                       # renderActionEmail
  - api/server.js                                               # drainListingRequestNotifications, POST /api/notifications/drain, POST /api/internal/ops/alerts/run
  - src/lib/notifications/nudgeNotificationEmails.ts
  - src/providers/AppProvider.tsx
unmatched_tier: 2
---

# Commission Notification Emails — Support Playbook

Every step of a commission emails the person who has to act next, or who needs
to know. Before `20261007_148` only receipts, non-response notices and payout
emails were sent.

## How it works

1. **The database decides.** Triggers on the workflow tables write one row to
   `listing_request_notifications` per event and recipient. `dedupe_key` is
   unique, so a trigger firing twice cannot produce two emails.
2. **The API sends.** `drainListingRequestNotifications` (`api/server.js`)
   claims waiting rows, renders each from `api/notificationEmails.js`, sends
   it through `sendTransactionalEmail`, and records `email_status`.
3. **Three things start a send:**
   - the website, about 1.5 seconds after any action
     (`nudgeNotificationEmails` → `POST /api/notifications/drain`);
   - the Stripe webhook, when a payment turns paid;
   - the hourly ops job (`mfs-ops-alerts`), which also queues reminders. This
     is the safety net: an email is at most about an hour late.

A failed send is retried up to three times, at least ten minutes apart.
Queuing never blocks the step it describes: `enqueue_listing_request_notification`
swallows its own errors and raises a warning (`NOTIF-003`).

## What is sent

| When | Email (`kind`) | To |
| --- | --- | --- |
| Buyer sends a commission request | `request_received` | creator |
| Creator accepts / declines | `request_accepted` / `request_declined` | buyer |
| A request is archived before it was answered | `request_withdrawn` | the other person |
| Creator sends the agreement | `agreement_sent` | buyer |
| Buyer accepts / declines the agreement | `agreement_accepted` / `agreement_declined` | creator |
| Creator sends a change order (scope, price, timeline, extension) | `change_order_sent` | buyer |
| Buyer accepts / declines it | `change_order_accepted` / `change_order_declined` | creator |
| A payment becomes due | `payment_required` | buyer |
| A payment is paid | `payment_received` (the buyer gets the receipt) | creator |
| A payment is refunded / disputed | `payment_refunded` / `payment_disputed` | both / creator |
| Creator submits a milestone | `milestone_submitted` | buyer |
| Buyer approves it / asks for revisions | `milestone_approved` / `milestone_revision_requested` | creator |
| Creator submits the final delivery | `final_delivery_submitted` | buyer |
| Buyer asks for revisions to it | `final_delivery_revision_requested` | creator |
| Creator posts a progress update | `progress_update_posted` | buyer |
| Buyer asks to cancel after paying | `cancellation_statement_needed` | creator |
| A cancellation statement is ready | `cancellation_statement_ready` | buyer |
| Buyer disputes the statement | `cancellation_disputed` | creator |
| The commission is cancelled (either path, or closed by an admin) | `request_cancelled` | everyone except whoever cancelled |
| The commission is completed | `request_completed` | both |

**Reminders**, queued hourly by `enqueue_listing_request_reminders()`, once
after 3 days of waiting and once after 7:

| Left waiting | Email (`kind`) | To |
| --- | --- | --- |
| A commission request not answered | `request_reminder` | creator |
| An agreement not answered | `agreement_reminder` | buyer |
| A payment not made | `payment_reminder` | buyer |
| A milestone not reviewed | `milestone_review_reminder` | buyer |
| A final delivery not reviewed | `final_delivery_review_reminder` | buyer |
| A promised progress update overdue | `progress_update_overdue` | creator |

Each reminder is only queued during the day it falls due. Switching the
feature on therefore does not email about things that were already old.

**Chat messages and presence** (`20261007_149`):

| When | Email (`kind`) | To |
| --- | --- | --- |
| The first message of a new inquiry conversation | `conversation_started`, always | the other person |
| Any later message, **only if the recipient is not online** | `message_received` | the other person |
| A cancellation warning is sent / two days before it runs out | `cancellation_warning` / `cancellation_warning_reminder` ([`cancellation-warnings.md`](../requests/cancellation-warnings.md)) | the recipient |
| The recipient answers a warning, by a reply or a project step | `cancellation_warning_answered` | the sender |

- **Online** means seen in the last five minutes (`is_user_online`). The
  website reports activity (a click, a key, a scroll, returning to the tab) at
  most once a minute through `touch_user_presence()`; a background tab reports
  nothing.
- **One email per unread stretch.** However many messages arrive, the
  recipient gets one `message_received` email until they open the
  conversation and read it.
- **Safety net.** Someone who looked online but had left gets the email from
  the hourly run, once a message has sat unread for ten minutes.
- A person who muted a conversation gets no message emails for it.
- **For live chat later (websockets):** the chat's Supabase Realtime channel
  calls the same `reportPresence()` / `touch_user_presence()`. The email rule
  does not change.

**Not sent from here:** non-response first and final notices, receipts and
payout emails ([`transactional-email.md`](transactional-email.md)).

## Quick triage

| Symptom | Likely issue |
| --- | --- |
| "I never got an email about my commission" | [`NOTIF-003`](#notif-003--one-notification-was-not-sent) |
| Nobody is getting commission emails | [`NOTIF-001`](#notif-001--notifications-are-not-being-sent-at-all) |
| Emails arrive up to an hour late | [`NOTIF-001`](#notif-001--notifications-are-not-being-sent-at-all), the website nudge is failing |
| A row is `failed` with "no email template" | [`NOTIF-002`](#notif-002--a-kind-has-no-template) |
| "The link in the email goes to a page that does not exist" | [`NOTIF-004`](#notif-004--email-link-opens-a-missing-page) |
| "I was on the site and still got a message email" / "I was away and got none" | [`NOTIF-005`](#notif-005--message-email-sent-or-not-sent-against-expectation) |

---

## `NOTIF-001` — Notifications are not being sent at all

```yaml
id: NOTIF-001
tier: 2
signals:
  - source: api
    match: "/NOTIF-001: (notification run failed|reminders could not be queued|could not record a send): /"
    where: "api/server.js drainListingRequestNotifications, POST /api/internal/ops/alerts/run"
  - source: db
    match: "listing_request_notifications rows with email_status = 'pending' older than 2 hours"
    where: "public.listing_request_notifications"
auto_fix: none
reason_not_automatable: "the cause is a missing migration, a stopped scheduler job or an email outage, each fixed differently"
escalate_with:
  - "the NOTIF-001 log line"
  - "the last run status of the mfs-ops-alerts Cloud Scheduler job"
  - "select email_status, count(*) from listing_request_notifications group by 1"
```

**Cause.** One of: migration `20261007_148` is not applied (the log says the
function or table does not exist); the API was not redeployed after the
migration; the hourly job is not running (`operations/alerting.md` `OPS-001`,
`OPS-002`); or email itself is down (`transactional-email.md` `EMAIL-004`).

**What the user sees.** No "your turn" emails. The site itself still works,
and the commission page still shows what is waiting.

**Fix.** Find the cause from the log line. Once it is fixed nothing needs
resending by hand: waiting rows go out on the next run. To send at once,
force-run `mfs-ops-alerts` from the Cloud Scheduler console; its response
includes `"notifications":{"sent":n,"failed":n}`.

**Money impact.** None directly. A buyer who is never told a payment is due
pays late.

---

## `NOTIF-002` — A kind has no template

```yaml
id: NOTIF-002
tier: 2
signals:
  - source: db
    match: "/NOTIF-002: no email template for kind \".+\"\\./"
    where: "public.listing_request_notifications.email_failed_reason"
auto_fix: none
reason_not_automatable: "needs a code change and an API deploy"
```

**Cause.** The database queued a `kind` the running API does not know: a
migration added one and the API was not deployed, or the template was never
written. `api/tests/notificationEmails.test.js` fails in that second case, so
it should not reach a deploy.

**Fix.** Deploy the API that has the template. Then reset the rows so they
are retried: `update listing_request_notifications set email_status =
'pending', email_attempts = 0 where email_failed_reason like 'NOTIF-002%'`.

**Money impact.** None.

---

## `NOTIF-003` — One notification was not sent

```yaml
id: NOTIF-003
tier: 2
signals:
  - source: api
    match: "/NOTIF-003: \\w+ for commission .+ was not sent: /"
    where: "api/server.js drainListingRequestNotifications"
  - source: db
    match: "/NOTIF-003: could not enqueue \\w+ for request /"
    where: "public.enqueue_listing_request_notification (a Postgres warning)"
  - source: db
    match: "listing_request_notifications.email_status = 'failed'"
    where: "public.listing_request_notifications"
auto_fix: none
reason_not_automatable: "the reason varies: a suppressed address, a provider error, an account with no email"
escalate_with:
  - "the row: kind, recipient_user_id, email_attempts, email_failed_reason"
  - "whether the recipient's address is in email_suppressions"
```

**Cause.** Read `email_failed_reason`. The same three causes as
[`EMAIL-001`](transactional-email.md#email-001--send-failed-or-silently-dropped):
email not configured, the address is suppressed after a bounce, or a provider
error. The "could not enqueue" form means the row was never written; the
workflow step itself still went through.

**How to check what a person was sent:**

```sql
select kind, email_status, email_attempts, email_attempted_at, email_failed_reason
from public.listing_request_notifications
where listing_request_id = '<request>'
order by created_at;
```

**Fix.** After three attempts a row stays `failed`. Once the cause is fixed,
set that row back to `pending` with `email_attempts = 0`; the next run sends
it. Do not resend an email about a step that has since moved on (a payment
reminder for a payment now paid): tell the person directly instead.

**Money impact.** None directly.

---

## `NOTIF-004` — Email link opens a missing page

```yaml
id: NOTIF-004
tier: 2
signals:
  - source: user_report
    match: "the button in the email opens a page not found"
auto_fix: none
reason_not_automatable: "a configuration or code fault"
```

**Cause.** Either `APP_ORIGIN` on the API points at the wrong site, or the
link shape is wrong. Until 2026-10-07 every buyer link in receipt and notice
emails was built as `/buyer/requests/<id>`, a page that does not exist; the
buyer's page is `/requests/<id>`. `getListingRequestUrl`
(`api/notificationEmails.js`) now builds both, with a test.

**Fix.** Check `APP_ORIGIN` on the Cloud Run service. Send the person the
right address: `/requests/<id>` for a buyer, `/creator/requests/<id>` for a
creator.

**Money impact.** None.

---

## `NOTIF-005` — Message email sent, or not sent, against expectation

```yaml
id: NOTIF-005
tier: 2
signals:
  - source: user_report
    match: "got a message email while on the site, or no email while away"
  - source: db
    match: "/NOTIF-005: message notification failed for conversation /"
    where: "public.notify_conversation_message (a Postgres warning)"
auto_fix: none
reason_not_automatable: "usually expected behaviour that needs explaining"
escalate_with:
  - "select last_seen_at from public.user_presence where user_id = '<recipient>'"
  - "the message_received rows for the conversation, with created_at and email_status"
  - "the recipient's conversation_participants row: last_read_at, muted_at"
```

**Cause.** Almost always one of these, all working as designed:

- *Got one while on the site:* they had the tab open but had not clicked,
  typed or scrolled for five minutes, so they counted as away.
- *Got none while away:* they were seen within five minutes of the message
  (the hourly run sends it later if it stays unread); or they already had an
  email for this unread stretch; or they muted the conversation; or it was
  the other person's very first message on a commission, which is covered by
  the "new commission request" email instead.

The Postgres warning is different: the trigger itself failed. The chat
message was still delivered in the app; only its email is missing.

**Fix.** Explain. For the warning, read the error text in the database log
and treat it as a defect.

**Money impact.** None.

---

## Known gaps

- **Presence is activity, not a live connection.** Someone reading a long
  page without touching it for five minutes counts as away. A websocket
  presence channel will make this exact.
- **Signing out does not mark someone offline** until five minutes pass.
- **No per-person email preferences.** Every email here is about a
  commission the person is part of, so there is no unsubscribe.
- **Reminders stop after 7 days.** After that the non-response notice
  process is the next step ([`REQ-003`](../requests/request-lifecycle.md#req-003--unresponsive-participant)).
- **Anyone signed in can trigger a send run** (`POST /api/notifications/drain`).
  It only sends what the database already queued, to the recipients the
  database chose.
- **More email volume.** A full commission now sends about fifteen emails.
  Watch the Cloudflare sending quota (`EMAIL-004`) while the domain is new.
