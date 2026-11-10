---
feature: messaging/transactional-email
status: active
surfaces:
  - api/email.js
  - api/emailTemplates.js
  - api/emailLanguage.js                 # which language an email is in
  - api/emailTextFr.js                   # the emails in French
  - api/emailTextEs.js                   # the emails in Spanish
  - public.user_display_preferences.language
  - public.user_display_preferences.browser_language  # 20261031_176
  - src/components/app/LanguageSync.tsx  # saves browser_language
  - public.listing_request_notices
  - public.email_suppressions
  - POST /api/notices/:noticeId/send-email
  - POST /api/webhooks/email               # EMAIL-006: needs EMAIL_WEBHOOK_SECRET
  - workers/email-events/index.js          # reads the email-events queue, EMAIL-009
  - workers/email-events/wrangler.jsonc    # Worker made-for-stream-email-events
  - Cloudflare Queue email-events          # subscribed to message.bounced, message.complained
unmatched_tier: 2
---

# Transactional email — Support Playbook

Launch-scope.md section 7.1: the first outbound email the product sends beyond
Supabase's own auth mail. Four templates ship at launch — payment receipt, first
notice, final notice, payout released — plus the creator-application decision
emails (approved, needs changes, rejected; `creators/applications.md` `APP-006`), all sent over authenticated SMTP against
Cloudflare Email Service from `api/email.js`. Sending needs no Workers code; the
Express API sends directly.

**Status: SMTP send path verified live, 2026-09-23.** `send.madeforstream.com` is
onboarded, Workers Paid is active, and a real send through `api/email.js` against
Cloudflare's SMTP endpoint was confirmed end to end (accepted with a provider
message id). **Still not verified:** a real bounce travelling the whole bounce
path (`EMAIL-002`). Since 2026-11-09 it reads Cloudflare's documented event
format, but a successful send doesn't exercise that path. Domain warming (Sprint 6
checklist) has also not started in earnest — this was a single test send, not
production volume.

**Connection details are fixed, not account-specific**, confirmed against
Cloudflare's own docs: host `smtp.mx.cloudflare.net`, port `465` (implicit TLS —
Cloudflare does not offer STARTTLS on 587), username always the literal string
`api_token`. The only real secret is `EMAIL_SMTP_PASS`, a Cloudflare API token
scoped to `Account > Email Sending > Edit`
(`dash.cloudflare.com/profile/api-tokens` → Create Custom Token). **A useful
pre-Workers-Paid test path:** a message to any address verified as an Email
Routing destination sends and counts against no quota on any Cloudflare plan —
verify your own inbox there to exercise a real send before paying for Workers
Paid.

**Why this playbook exists before the feature is fully live:** the non-response
notice clock (`REQ-003` in
[`../requests/request-lifecycle.md`](../requests/request-lifecycle.md)) depends
on delivery being trackable — a disputed administrative closure needs to show a
final notice was actually sent, not just written to the database. That dependency
is why email had to ship in the same sprint as closure.


**Supabase Auth mail (sign-in and sign-up) goes through the same Cloudflare SMTP**
since 2026-10-01 (Supabase → Authentication → Emails → SMTP Settings), verified
delivered to an outside Gmail address 2026-10-02. Its templates are kept in
`supabase/templates/` and pasted into Supabase → Authentication → Emails by
hand; Supabase does not read the repo. **Edit `supabase/templates/build.mjs`,
not the `.html` files**, then run `node supabase/templates/build.mjs`. It
refuses to build if a template uses a variable Supabase doesn't fill in for
that template, which would otherwise show up blank in a real email.

| Supabase template | File | Used by the app today |
| --- | --- | --- |
| Confirm signup | `confirmation.html` | yes: first email sign-in |
| Magic link | `magic_link.html` | yes: every email sign-in |
| Invite user | `invite.html` | when an admin invites someone |
| Change email address | `email_change.html` | no (no email-change screen) |
| Reset password | `recovery.html` | no (no passwords) |
| Reauthentication | `reauthentication.html` | no |
| Password changed (security) | `password_changed_notification.html` | no |
| Email address changed (security) | `email_changed_notification.html` | no |
| Phone number changed (security) | `phone_changed_notification.html` | no |
| Sign-in method linked (security) | `identity_linked_notification.html` | if switched on: e.g. first Google sign-in on an account made by email |
| Sign-in method removed (security) | `identity_unlinked_notification.html` | if switched on |
| MFA method added (security) | `mfa_factor_enrolled_notification.html` | no (no MFA) |
| MFA method removed (security) | `mfa_factor_unenrolled_notification.html` | no (no MFA) |

Subjects are in `build.mjs` (printed when it runs). The "security" ones are
only sent if each is switched on in Supabase. The app signs in by link only
(`signInWithOtp` in `src/pages/SignIn.tsx`), so the sign-in templates carry no
code; only Reauthentication shows one. If the dashboard copy and the file
disagree, the file is the intended version.

Look: the site's colours from `src/styles/theme.css` (purple-to-orange header
band, indigo button gradient), each gradient with a solid fallback for Outlook.
A dark version follows the reader's system setting through
`prefers-color-scheme`, which Apple Mail, iOS Mail and Outlook for Mac honour.
Gmail ignores it and darkens the light version itself, so a report of "the
email looks different in Gmail's dark mode" is expected, not a bug.

**Commission step emails** (request received, accepted, agreement, payments,
milestones, reminders, cancelled, completed) are a separate, larger set since
`20261007_148`, with their own queue and playbook:
[`commission-notifications.md`](commission-notifications.md). They use the
same sender (`sendTransactionalEmail`), so `EMAIL-001`, `EMAIL-002` and
`EMAIL-004` below apply to them too.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I never got the notice / receipt email" | [`EMAIL-001`](#email-001--send-failed-or-silently-dropped) |
| A closure is disputed and delivery needs proof | [`EMAIL-003`](#email-003--proving-a-notice-was-delivered) |
| "My emails to this platform bounce" (creator/buyer side) | [`EMAIL-002`](#email-002--hard-bounce-suppresses-the-address) |
| Notices stopped sending for everyone | [`EMAIL-004`](#email-004--sending-domain-not-onboarded-or-quota-exceeded) |
| "My emails are in the wrong language" | [`EMAIL-005`](#email-005--email-in-the-wrong-language) |
| Bounces stop being recorded; the API logs `EMAIL-006` | [`EMAIL-006`](#email-006--email-webhook-refused-not-authorized) |
| The API logs `EMAIL-007` | [`EMAIL-007`](#email-007--email-event-not-recognised) |
| The API logs `EMAIL-008` | [`EMAIL-008`](#email-008--email-event-could-not-be-recorded) |
| The email-events Worker logs `EMAIL-009` | [`EMAIL-009`](#email-009--worker-could-not-pass-an-email-event-to-the-api) |
---

## `EMAIL-001` — Send failed or silently dropped

```yaml
id: EMAIL-001
tier: 2
signals:
  - source: db
    match: "listing_request_notices.email_status = 'failed'"
    where: "public.listing_request_notices"
  - source: api
    match: "Email is not configured (EMAIL_SMTP_HOST/EMAIL_SMTP_USER/EMAIL_SMTP_PASS missing)"
    where: "api/email.js sendTransactionalEmail"
auto_fix: none
reason_not_automatable: "the cause varies (missing config, suppressed address, provider outage) and the right response differs for each"
escalate_with:
  - "the notice id and its email_failed_reason column"
  - "whether EMAIL_SMTP_HOST/USER/PASS are set in the running environment"
  - "whether the recipient address is on email_suppressions"
```

**Cause.** `sendTransactionalEmail` (`api/email.js`) never throws — every failure
is recorded as `email_status = 'failed'` with `email_failed_reason` set. Three
distinct causes produce this:

1. Email is not configured at all (no `EMAIL_SMTP_HOST`/`USER`/`PASS`) — the
   whole feature is off, not one message.
2. The recipient address is suppressed (`EMAIL-002`).
3. A real SMTP error (auth failure, quota, provider outage) — the raw error is in
   `email_failed_reason`.

**What the user sees.** No email arrives. The in-app notice or receipt still
exists — this is a delivery gap, not a data gap.

**Manual fix.** Read `email_failed_reason` on the `listing_request_notices` row
(or check server logs for a receipt/payout email, which are not tied to a row).
If it's a config gap, fix the environment and this becomes systemic
(`EMAIL-004`). If it's a one-off provider error, retrying the specific send is
currently a manual `POST /api/notices/:noticeId/send-email` call (idempotent —
it always re-sends and overwrites the row's email status, since there is no
separate "already attempted, don't retry" guard beyond `email_status === 'sent'`)
until a retry button exists in the admin UI.

**Money impact.** None directly. But see `EMAIL-003` — a failed notice can affect
whether an administrative closure is defensible.

---

## `EMAIL-002` — Hard bounce suppresses the address

```yaml
id: EMAIL-002
tier: 1
signals:
  - source: db
    match: "insert into public.email_suppressions"
    where: "POST /api/webhooks/email, on a bounce/complaint event"
auto_fix: suppress_email_address
params:
  email: "$.email"
  reason: "hard_bounce | complaint"
verify:
  - "email_suppressions row exists for the address"
  - "future sends to that address return status: failed with the suppression reason"
retry_limit: 1
escalate_if:
  - "the same address bounces repeatedly across multiple unrelated users (may indicate a typo pattern in signup, not a dead address)"
```

**Cause.** `POST /api/webhooks/email` inserts into `email_suppressions` on a
bounce or complaint event. Every future send checks this table first
(`isEmailSuppressed` in `api/email.js`) and refuses rather than re-attempting.

**How a bounce gets here.** Cloudflare Email Service doesn't call a URL. It
publishes `message.bounced` and `message.complained` events for
`send.madeforstream.com` to the Cloudflare Queue `email-events`. The Worker
`made-for-stream-email-events` (`workers/email-events/`) reads the queue and
posts each event, unchanged, to the webhook with the shared secret. There,
`parseEmailEvent` (`api/email.js`) suppresses the address on a **hard** bounce
or a complaint. A **soft** bounce (Cloudflare ran out of retries on a temporary
failure) is ignored, because the address may still work. Cloudflare also
suppresses hard bounces and complaints on its own side, so a gap here does not
mean mail keeps going to a dead address.

**Not verified yet:** the parser follows Cloudflare's published example events
(tested in `api/tests/emailEvents.test.js`), but no real bounce has gone
through it. Marking the matching notice `bounced` also needs Cloudflare's
`messageId` to equal the id we stored when sending
(`email_provider_message_id`, nodemailer's `messageId`). That hasn't been
checked. If they differ, the address is still suppressed, but the notice keeps
its old status. To check, send to a dead address and compare the event's
`payload.messageId` (Worker logs) with the stored id.

**What the user sees.** The affected party stops receiving notices/receipts with
no visible error — check `email_suppressions` first whenever "they never got
anything" turns out to be more than one email in a row.

**Manual fix.** To un-suppress a false positive (e.g., a temporary provider
outage misreported as a hard bounce), delete the row from `email_suppressions`
by hand. There is no UI for this yet.

**Money impact.** None directly, but see `EMAIL-003` — a suppressed address
matters for the non-response clock.

---

## `EMAIL-003` — Proving a notice was delivered

```yaml
id: EMAIL-003
tier: 2
signals:
  - source: user_report
    match: "closure disputed, party says they never received the notice"
auto_fix: none
reason_not_automatable: "requires human judgement about what the evidence actually shows"
escalate_with:
  - "the notice row's email_status, email_provider_message_id, email_attempted_at, email_delivered_at, email_failed_reason"
  - "whether the recipient address was in email_suppressions at send time"
```

**Cause.** `admin_close_listing_request_for_non_response`
([`../requests/request-lifecycle.md`](../requests/request-lifecycle.md)'s
`REQ-003`) only requires the 7+7 day clock to have run and no substantive reply
— it does **not** require `email_status = 'sent'`. A notice that failed to send
is still a legally-sent notice in the database sense (the clock still ran), but
it is a much weaker position if the closure is disputed.

**What the user/admin sees.** A party disputing a closure claims they never got
the notice.

**Manual fix.** Pull the disputed notice's row from `listing_request_notices`:
`email_status`, `email_provider_message_id`, `email_attempted_at`,
`email_delivered_at`, `email_failed_reason`. `'sent'` means the SMTP server
accepted it for delivery (the strongest evidence this system currently
produces — there is no delivery-confirmation webhook wired up, only a
best-effort bounce one, see `EMAIL-002`). `'failed'` or `'pending'` means there
is no delivery evidence at all, and the closure decision should weigh that —
this is a judgement call for the admin, not an automated block, per
launch-scope.md section 7's "who closes: an administrator."

**Money impact.** Potentially significant — a disputed closure with weak
delivery evidence is a weaker position in a chargeback.

---

## `EMAIL-004` — Sending domain not onboarded, or quota exceeded

```yaml
id: EMAIL-004
tier: 2
signals:
  - source: api
    match: "/Recipient address is on the suppression list|SMTP.*(auth|quota|rate)/i"
    where: "api/email.js sendTransactionalEmail catch block"
auto_fix: none
reason_not_automatable: "requires a Cloudflare dashboard action (plan upgrade, domain onboarding, or waiting out the quota), not a code fix"
escalate_with:
  - "whether send.madeforstream.com shows as onboarded in the Cloudflare dashboard"
  - "whether Workers Paid is enabled on the account"
  - "the exact SMTP error text in email_failed_reason"
```

**Cause.** Two related but distinct launch gaps, both dashboard configuration
(Sprint 6 checklist), neither of which this codebase can detect or fix on its
own:

- **Domain not onboarded.** Until `send.madeforstream.com` is onboarded as a
  Cloudflare Email Service sending domain, sending is restricted to addresses
  verified on the account — everything else fails.
- **Quota exceeded.** New Cloudflare accounts start on a conservative daily
  sending quota that scales up with sending behaviour ("warming"). A launch-day
  traffic spike before the domain has been warmed can hit this ceiling.

**What the user sees.** Every notice/receipt/payout email fails, not just one —
this is the signal that distinguishes `EMAIL-004` from `EMAIL-001`.

**Manual fix.** Confirm domain onboarding and current quota in the Cloudflare
dashboard. If quota-limited, either wait for it to reset or reduce non-essential
sending (there is no priority queue — every send is equally urgent to this
code). There is nothing to fix in `api/server.js` for either case.

**What a failed notice means for the 7+7 clock.** The clock is a database fact
(`sent_at`/`expires_at` on `listing_request_notices`), set by
`send_listing_request_first_notice`/`send_listing_request_final_notice`
regardless of whether the follow-up email succeeds — **the clock keeps running
even if every email in this section fails.** This is deliberate: the alternative
(blocking the notice RPC on email delivery) would let an email outage freeze the
non-response process entirely. The tradeoff is `EMAIL-003`'s weaker-evidence
problem on a disputed closure, not a blocked clock.

**Money impact.** None directly, but a platform-wide outage here should be
treated as urgent — every notice sent during the outage carries `EMAIL-003`'s
weak-evidence problem.

---

## `EMAIL-005` — Email in the wrong language

```yaml
id: EMAIL-005
tier: 2
signals:
  - source: logs
    match: "/EMAIL-005: could not read the language for .+/"
    where: "API stderr (api/emailLanguage.js, getEmailLanguage)"
auto_fix: none
reason_not_automatable: "the usual cause is a language that is not ready yet, which is intended"
```

**How it works.** `getEmailLanguage` reads the recipient's row in
`user_display_preferences`. Their chosen `language` comes first, then
`browser_language`, then English. The website saves `browser_language`
(`LanguageSync`) for someone who never chose a language, the first time their
browser shows the site in something other than English.

**Expected, not a fault.**

- Everyone gets English until the language is marked ready in **both**
  `src/lib/i18n/languages.ts` and `EMAIL_LANGUAGES` in `api/emailLanguage.js`.
  `EMAIL_OFFER_UNFINISHED_LANGUAGES=true` lifts that on a test deployment. Never
  set it in production.
- The ops alert digest is for the owner and stays English.
- Sign-in and account emails come from Supabase, not this API
  (`supabase/templates`), and are English only. See Known gaps.
- A title, a reason or a note someone typed stays in the language it was typed.

**Diagnose.** Check what is saved:

```sql
select language, browser_language from public.user_display_preferences
where user_id = '<user id>';
```

If the log shows `EMAIL-005`, the row could not be read, so the email went in
English: it is never held back. The likely cause is the API running before
migration 176 (`column user_display_preferences.browser_language does not
exist`). Apply the migration.

**Fix.** Someone who wants a different language changes it in Settings →
Preferences. Nothing else is needed: the next email follows it.

**Money impact.** None. A notice in the wrong language is still a notice sent,
but see `EMAIL-003` if one is disputed.

---

## `EMAIL-006` — Email webhook refused (not authorized)

```yaml
id: EMAIL-006
tier: 2
signals:
  - source: api
    match: "EMAIL-006: email webhook call was not authorized."
    where: "POST /api/webhooks/email (api/server.js), answered 401 Not authorized."
auto_fix: none
reason_not_automatable: "needs the same secret set on the API and on the email-events Worker"
escalate_with:
  - "whether EMAIL_WEBHOOK_SECRET is set on Cloud Run (never its value)"
  - "whether EMAIL_WEBHOOK_SECRET is set on Worker made-for-stream-email-events (never its value)"
```

**Cause.** Since 2026-11-05 the bounce/complaint webhook only accepts calls that
send `Authorization: Bearer <EMAIL_WEBHOOK_SECRET>`. It checks with the same
constant-time helper as the ops jobs (`isAuthorizedOpsRequest`). Before that
it accepted anyone's call, and the repo is public. So anyone could have marked
any address as bounced, which silently stops every notice and receipt to it
(`EMAIL-002`). Cloudflare's own signing scheme still couldn't be confirmed, so
a shared secret stands in for it. The secret must be at least 32 characters.
**Unset or shorter, every call is refused** and bounces aren't recorded, but
sending is unaffected.

**What the user sees.** Nothing. The Worker retries each refused event for
about 50 minutes (`EMAIL-009`), then drops it. Cloudflare still suppresses the
address on its side.

**Fix.** The secret lives in Secret Manager as `EMAIL_WEBHOOK_SECRET`. Both the
API and the Worker read that one value, so it is never typed or shown. See
[Setting up the bounce path](#setting-up-the-bounce-path). If the two values no
longer match, rerun its step 3. If the API still refuses a call that has the
right secret, the stored value probably has a hidden carriage return at the
end: `gcloud secrets versions access latest --secret EMAIL_WEBHOOK_SECRET | wc -c`
prints 65 instead of 64. To fix it, add a clean version with
`tr -d '\r\n'`, disable the old version, then start a new API version so it
reads the new value (this happened on 2026-11-10).

**Money impact.** None.

---

## `EMAIL-007` — Email event not recognised

```yaml
id: EMAIL-007
tier: 2
signals:
  - source: api
    match: "EMAIL-007: unrecognised email event."
    where: "POST /api/webhooks/email (api/server.js), answered 400; the Worker drops the event"
auto_fix: none
reason_not_automatable: "means Cloudflare changed its event format; the parser needs a code change"
escalate_with:
  - "the event type logged after the message"
```

**Cause.** An event arrived with no `type` or no `payload.recipient`. The code
reads Cloudflare's `eventSchemaVersion` 1 format. A new version, or an event the
queue was never meant to receive, ends up here.

**What the user sees.** Nothing. That one bounce isn't recorded here, though
Cloudflare still suppresses the address on its side.

**Fix.** Compare the event with Cloudflare's current
[event reference](https://developers.cloudflare.com/email-service/reference/event-subscriptions/)
and update `parseEmailEvent` and the check in front of it.

**Money impact.** None.

---

## `EMAIL-008` — Email event could not be recorded

```yaml
id: EMAIL-008
tier: 2
signals:
  - source: api
    match: "EMAIL-008: could not record an email event."
    where: "POST /api/webhooks/email (api/server.js), answered 500; the Worker retries"
auto_fix: none
reason_not_automatable: "a database write failed; the cause is in the error after the message"
escalate_with:
  - "the error text logged after the message"
```

**Cause.** Writing to `email_suppressions` failed, for example because the
database was unreachable. The Worker retries the event (`EMAIL-009`), so a short
outage fixes itself.

**What the user sees.** Nothing.

**Fix.** Fix whatever the logged error names. An event that runs out of
retries is gone, but Cloudflare still suppresses that address on its side.

**Money impact.** None.

---

## `EMAIL-009` — Worker could not pass an email event to the API

```yaml
id: EMAIL-009
tier: 2
signals:
  - source: worker
    match: "EMAIL-009: email event not passed to the API"
    where: "Worker made-for-stream-email-events (workers/email-events/index.js) logs; the status follows in brackets"
auto_fix: none
reason_not_automatable: "the cause is on the API side; the status in brackets says which"
escalate_with:
  - "the status in brackets"
  - "whether the API is up"
```

**Cause.** The API didn't accept the event. `401` means `EMAIL-006` (the secret
is missing or different). `500` means `EMAIL-008`. `network error` means the
API couldn't be reached. Each event is retried every 5 minutes, up to 10 times
(`workers/email-events/wrangler.jsonc`), then dropped.

**What the user sees.** Nothing.

**Fix.** Follow the issue the status points to.

**Money impact.** None.

---

## Setting up the bounce path

Alvin's steps, once per environment, in this order. Deploy the API first: the
API from before 2026-11-09 reads a different format and would drop these
events.

1. Deploy the API: `gcloud run deploy made-for-stream-api --source api --region us-central1`.
2. Create the secret straight into Secret Manager, where it's never shown, and
   attach it to the API. Use the same commands as `OPS_CRON_SECRET` in
   [`../operations/alerting.md`](../operations/alerting.md), with the name
   `EMAIL_WEBHOOK_SECRET`.
3. From the repository root, deploy the Worker with
   `npx wrangler deploy --config workers/email-events/wrangler.jsonc`. Then pipe
   the same secret into it:
   `gcloud secrets versions access latest --secret EMAIL_WEBHOOK_SECRET | npx wrangler secret put EMAIL_WEBHOOK_SECRET --config workers/email-events/wrangler.jsonc`.
4. In the Cloudflare dashboard, go to **Queues**. Create `email-events` if step 3
   didn't already create it. Open it, then **Subscriptions → Subscribe to
   events**. Choose source **Email Sending**, domain `send.madeforstream.com`,
   and the events `message.bounced` and `message.complained`.

**Prod.** The subscription is per sending domain, and the Worker points at one
API (`API_BASE` in `wrangler.jsonc`). If prod sends from the same domain, its
bounces reach whichever API this Worker points at. Before prod opens, give prod
its own sending subdomain, queue and Worker.

---

## Known gaps

- **Sign-in and account emails are English only.** They are Supabase's, and
  someone signing in for the first time has no saved language yet.
- **No retry UI.** A failed send can only be retried by calling
  `POST /api/notices/:noticeId/send-email` again by hand (or writing a one-off
  script) — there is no admin button yet.
- **No true delivery confirmation**, only "accepted by SMTP" (`email_status =
  'sent'`) and bounce/complaint events (`EMAIL-002`). If Cloudflare Email Service later
  offers a positive delivery-confirmation event, wire it in to distinguish
  "sent" from "confirmed delivered" — see the comment on
  `listing_request_notices.email_delivered_at` in
  `supabase/migrations/20260922_131_add_listing_request_notices.sql`.
- **The bounce path hasn't seen a real bounce yet** (`EMAIL-002`). It does
  nothing until [Setting up the bounce path](#setting-up-the-bounce-path) is
  done.
- **Payment receipt and payout-released emails have no row to check delivery
  status against** the way notices do — they are fire-and-forget, logged to
  stderr on failure only. If receipt delivery ever needs the same auditability
  as notices, it needs its own tracking table.
- **`payout.paid` webhook handling assumes the Stripe webhook endpoint receives
  Connect (connected-account) events, not just platform-account ones** — this
  needs confirming in the Stripe Dashboard webhook configuration; if it is not
  enabled, payout-released emails will simply never fire, silently.
