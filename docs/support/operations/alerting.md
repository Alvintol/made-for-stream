---
feature: operations/alerting
status: active
surfaces:
  - api/server.js                 # POST /api/internal/ops/alerts/run, POST /api/internal/ops/connect-resync, rejectUnauthorizedOpsRequest
  - api/opsAlerts.js              # OPS_ALERTS registry, planOpsAlertDigest, renderOpsAlertDigest, isAuthorizedOpsRequest
  - api/connectAccountState.js    # selectAccountsForResync
  - api/email.js                  # sendTransactionalEmail
  - public.list_ops_alerts()
  - public.ops_alert_notifications
  - supabase/migrations/20260924_139_add_connect_account_state_and_ops_alerts.sql
unmatched_tier: 2
---

# Operational Alerting and Scheduled Jobs — Support Playbook

Sprint 9. Two Cloud Scheduler jobs call the API every hour. The first
re-reads creators' Stripe accounts as a backstop for missed account events
(`connect-onboarding.md` `CON-006`). The second runs `list_ops_alerts()` and
emails a digest to `OPS_ALERT_EMAIL` (`ops@madeforstream.com`). Each alert names
the playbook issue that tells you what to do. When this breaks, nothing is
visibly wrong. The alerts just stop arriving, so a quiet inbox is not proof that
all is well. Check the jobs' last run status.

## What is alerted

| Alert id | Playbook issue | Fires when |
| --- | --- | --- |
| `stuck_payment` | [`PAY-005`](../payments/checkout.md#pay-005--payment-stuck-in-checkout_opened-or-processing) | `checkout_opened` for 25 h, or `processing` for 7 days |
| `change_order_payment_missing` | [`CHG-003`](../requests/change-orders.md#chg-003--accepted-change-order-did-not-create-its-payment) | accepted price-increasing change order with no schedule item or payment after 15 min |
| `stale_request` | [`REQ-003`](../requests/request-lifecycle.md#req-003--unresponsive-participant) | `admin_list_stale_listing_requests(14)` returns the request |
| `tax_evidence_insufficient` | [`TAX-002`](../payments/tax.md#tax-002--location-evidence-insufficient-or-contradictory) | a taxed paid payment's evidence is not `sufficient` |
| `tax_transaction_missing` | [`TAX-003`](../payments/tax.md#tax-003--taxed-payment-missing-its-stripe-tax-transaction) | a taxed payment paid over 1 h ago has no Stripe Tax transaction |
| `tax_reversal_missing` | [`TAX-004`](../payments/tax.md#tax-004--refund-tax-not-reversed-or-ledger-mismatch) | a refund that returned tax over 1 h ago has no reversal |
| `paid_wave2_currency` | [`TAX-007`](../payments/tax.md#tax-007--paid-sale-in-a-currency-whose-tax-advice-is-open) | any paid payment not in CAD or USD (**sent once, never repeated**) |
| `payment_account_lost_readiness` | [`CON-003`](../payments/connect-onboarding.md#con-003--stripe-restricted-an-account-and-we-did-not-notice) | a creator lost readiness and still has live listings |
| `payment_account_mirror_stale` | [`CON-006`](../payments/connect-onboarding.md#con-006--payment-account-mirror-is-not-being-refreshed) | a mirror row not refreshed in 48 h |
| `app_failure_summary` | [`OPS-006`](#ops-006--yesterdays-failures-on-the-site) | every distinct failure the website reported yesterday (UTC), with its count (**sent once, the day after**) |
| `app_failure_burst` | [`OPS-007`](#ops-007--one-account-is-failing-over-and-over) | one account with 25 or more failures within an hour (**sent once per burst**) |
| `storage_usage_high` | [`OPS-008`](#ops-008--storage-or-downloads-passed-a-mark) | stored files pass 80 GB, 500 GB or 2 TB, or this month's delivery downloads pass 200 GB or 1 TB (**sent once per mark**) |

**Frequency.** An alert is emailed the first time a subject (a payment, a
request, a creator) appears, then again every 24 hours while it stays open.
When it clears, it's forgotten, so if it comes back it's emailed as new.
`ops_alert_notifications` holds this state. Deleting its rows makes every open
alert send again on the next run, which is safe.

**Adding an alert** needs a branch in `list_ops_alerts()`, an entry in
`OPS_ALERTS` (`api/opsAlerts.js`) and a playbook issue. `opsAlerts.test.js`
fails until all three agree.

## The jobs

| Job | Route | Schedule | Healthy response |
| --- | --- | --- | --- |
| `mfs-connect-resync` | `POST /api/internal/ops/connect-resync` | `15 * * * *` | `200 {"selected":n,"refreshed":n,"lostReadiness":n,"failed":0}` |
| `mfs-ops-alerts` | `POST /api/internal/ops/alerts/run` | `45 * * * *` | `200 {"open":n,"emailed":n,"resolved":n,"emailStatus":"sent"\|"not_needed","notifications":{"sent":n,"failed":n},"autoCancelled":n}` |

Since `20261007_148` the alerts job also queues commission reminders and
sends any commission email not yet sent
([`commission-notifications.md`](../messaging/commission-notifications.md),
`NOTIF-001`). Since `20261007_149` it also cancels commissions whose
cancellation warning ran out unanswered and pays any refund that produces
([`cancellation-warnings.md`](../requests/cancellation-warnings.md),
`WARN-003`, `WARN-004`). Neither part changes the job's status code.

Both send `Authorization: Bearer $OPS_CRON_SECRET`. Both are safe to run twice
or to force-run by hand from the Cloud Scheduler console.

## Quick triage

| Symptom | Likely issue |
| --- | --- |
| No alert email for a day, and something should have fired | [`OPS-001`](#ops-001--alert-digest-not-delivered), [`OPS-002`](#ops-002--scheduled-job-not-authorized) |
| A Cloud Scheduler job shows `401` | [`OPS-002`](#ops-002--scheduled-job-not-authorized) |
| A Cloud Scheduler job shows `502` | [`OPS-001`](#ops-001--alert-digest-not-delivered) (alerts) or [`CON-006`](../payments/connect-onboarding.md#con-006--payment-account-mirror-is-not-being-refreshed) (resync) |
| Every API route returns `500`, or a Cloud Scheduler job shows `500` / code `13` | [`OPS-004`](#ops-004--cloud-run-keeps-restarting-the-api-liveness-probe) |
| Nobody can sign in, pages load forever, or Supabase emails about "Disk IO Budget" | [`OPS-005`](#ops-005--the-database-stops-answering-disk-io-budget-used-up) |
| An alert email heading says "Unregistered alert" | [`OPS-003`](#ops-003--list_ops_alerts-returned-an-unregistered-alert) |

---

## `OPS-001` — Alert digest not delivered

```yaml
id: OPS-001
tier: 2
signals:
  - source: api
    match: "/OPS-001: alert digest to .+ failed: /"
    where: "POST /api/internal/ops/alerts/run, server logs"
  - source: api
    match: "/OPS-001: alert run failed: /"
    where: "POST /api/internal/ops/alerts/run, server logs"
  - source: scheduler
    match: "mfs-ops-alerts last attempt returned 502 or 500"
auto_fix: none
reason_not_automatable: "the cause is email or database configuration"
escalate_with:
  - "the OPS-001 log line"
  - "whether EMAIL_SMTP_PASS is set on the Cloud Run service (not its value)"
  - "whether ops@madeforstream.com is on email_suppressions"
```

**Cause.** A `502` means the digest was built but `sendTransactionalEmail`
refused or failed. The `failedReason` in the log says why: SMTP isn't configured,
the address is on `email_suppressions` after a bounce, or Cloudflare rejected
the send (see [`transactional-email.md`](../messaging/transactional-email.md)).
Nothing is lost: an alert that failed to send is recorded as seen but not
notified, so the next hourly run sends it again. A `500` means
`list_ops_alerts()` or `ops_alert_notifications` failed. Usually that's
`20260924_139` not being applied, which shows as a "function ... does not
exist" or "relation ... does not exist" message.

**Fix.** Fix the cause, then force-run `mfs-ops-alerts`. If the address was
suppressed by a bounce, first confirm the Cloudflare Email Routing rule for
`ops@` exists, then delete its `email_suppressions` row.

**Money impact.** None directly. Alerts about money go unread.

---

## `OPS-002` — Scheduled job not authorized

```yaml
id: OPS-002
tier: 2
signals:
  - source: api
    match: "/OPS-002: ops request to .+ was not authorized\\./"
    where: "rejectUnauthorizedOpsRequest (api/server.js), server logs"
  - source: scheduler
    match: "job last attempt returned 401"
auto_fix: none
reason_not_automatable: "secrets are configuration; the agent may not read or set them"
escalate_with:
  - "which job, and when it last succeeded"
  - "whether OPS_CRON_SECRET is set on the Cloud Run service (not its value)"
```

**Cause.** The job's `Authorization` header doesn't match `OPS_CRON_SECRET` on
the service, or the secret is unset or shorter than 32 characters. Then every
call is refused, deliberately. Usually the secret was rotated in Secret Manager
without updating the job header, or without the forced redeploy described in
[`webhooks.md`](../payments/webhooks.md) `WHK-003`. A stray `OPS-002` line with no
failing job is someone probing the URL, which is harmless.

**Fix.** Set the job's header to the current secret
(`gcloud scheduler jobs update http <job> --location us-central1 --update-headers "Authorization=Bearer <secret>"`),
force-run it, and check for a `200`.

**Money impact.** None directly. The resync and alerts stop.

---

## `OPS-003` — `list_ops_alerts()` returned an unregistered alert

```yaml
id: OPS-003
tier: 2
signals:
  - source: api
    match: "/OPS-003: list_ops_alerts returned unregistered alert ids: /"
    where: "POST /api/internal/ops/alerts/run, server logs"
auto_fix: none
reason_not_automatable: "a code/migration mismatch"
escalate_with:
  - "the alert ids named"
  - "the deployed API revision and the latest applied migration"
```

**Cause.** The database has an alert branch the deployed API doesn't know, which
usually means a migration was applied ahead of its API deploy. The alert is still
emailed, headed "Unregistered alert", and linked to this page.

**Fix.** Deploy the API that matches the migration. The test suite keeps the two in
step, so this shouldn't survive a deploy of the same commit.

**Money impact.** Depends on the alert; read it.

---

## `OPS-004` — Cloud Run keeps restarting the API (liveness probe)

```yaml
id: OPS-004
tier: 2
signals:
  - source: cloud_run
    match: "/LIVENESS HTTP probe failed \\d+ times consecutively for container .+ on port 8787 path /"
    where: "Cloud Run system log (run.googleapis.com/varlog/system), severity ERROR"
  - source: cloud_run
    match: "The request failed because the instance could not start successfully."
    where: "Cloud Run request log, on requests answered 500"
  - source: scheduler
    match: "job last attempt returned 500 (status code 13)"
auto_fix: none
reason_not_automatable: "service configuration; the agent may not change Cloud Run settings"
escalate_with:
  - "the path quoted in the LIVENESS log line"
  - "the serving revision and when it was created"
  - "whether the API's own log shows '[api] listening' shortly before each shutdown"
```

**Cause.** Cloud Run's liveness probe is failing, so it shuts each instance
down ("The instance has been shut down."). Read the path in the log line. If
it is anything but `/api/health`, the probe is misconfigured: on 2026-10-05
it was `/api/health httpGet.port=8787 periodSeconds=30 ...`, because the
shell had turned the option list's commas into spaces, and the API answered
that path with `404`. If the path is right, the API itself is failing or
hanging on `/api/health`; read its own log lines before the shutdown.

In the misconfigured case the API starts normally (`[api] listening on ...`)
and is killed about 30 seconds later. Requests that land in the gap succeed,
so this can look like an API that is merely flaky. It ran that way from
2026-09-22 to 2026-10-05 before failing outright.

**Fix.** Set the probe and check the result, as in
[`environments.md`](../../environments.md#the-apis-health-probe). Then
confirm `GET /api/health` is `200` and force-run both scheduler jobs.

**Money impact.** No money moves wrongly, but Stripe webhooks that arrive
while the API is down are refused. Stripe retries them for a limited time.
After an outage, check for payments stuck in `checkout_opened`
([`PAY-005`](../payments/checkout.md#pay-005--payment-stuck-in-checkout_opened-or-processing))
and force-run `mfs-connect-resync`.

---

## `OPS-005` — The database stops answering (Disk IO budget used up)

```yaml
id: OPS-005
tier: 2
signals:
  - source: email
    match: "Your project is depleting its Disk IO Budget"
    where: "Supabase's email to the project owner"
  - source: postgres
    match: "canceling statement due to statement timeout"
    where: "Supabase Postgres logs, many per minute; PostgREST returns code 57014"
  - source: postgrest
    match: "Warp server error: Thread killed by timeout manager"
  - source: edge
    match: "/rest/v1/* and /auth/v1/token answering 504"
auto_fix: none
reason_not_automatable: "needs the Supabase dashboard (restart, compute size) and a look at what is loading the database"
escalate_with:
  - "Supabase Reports > Database: the Disk IO and memory charts for the day"
  - "requests per hour by path from the API gateway logs (which path is steady all day?)"
  - "the project's plan and compute size"
```

**Cause.** A small Supabase instance may only use its disk heavily for a
limited time each day. When that allowance is gone, every query crawls,
sign-in (`/auth/v1/token`) times out and the site looks dead, although the
website and the API are both up. The usual causes are a steady stream of
requests that never stops, or the instance running short of memory and
swapping to disk.

First seen 2026-10-06 on the free plan's smallest instance. The only steady
load that day was the payout page re-reading `creator_payment_accounts`
every 10 seconds from a browser tab left open overnight (about 4,800
requests in 23 hours). That poll had no end and ran in hidden tabs. It is
the likely trigger; it could not be proved, because the database could not
be queried while it was down. The poll now stops after 30 tries and pauses
in hidden tabs.

**Fix.** Close every open tab of the site. In Supabase: Settings → General →
Restart project. If it does not recover within the hour, or it happens on
prod, raise the compute size (Settings → Compute and Disk). Then find the
steady request in the gateway logs and stop it at the source.

**Money impact.** No money moves wrongly. While it lasts nobody can sign in
or pay, and Stripe webhooks fail (Stripe retries them). Afterwards, check
`PAY-005` and force-run both scheduler jobs.

---

## `OPS-006` — Yesterday's failures on the site

```yaml
id: OPS-006
tier: 2
signals:
  - source: db
    where: public.app_failure_events
    match: "rows with occurred_at in the previous UTC day, grouped by source, route, code and signature"
  - source: email
    match: "ops digest section \"Yesterday's failures on the site\""
auto_fix: none
reason_not_automatable: "a list to read, not a fault; a person decides which line is a defect"
escalate_if:
  - "a line nobody recognises, or one whose count or number of accounts keeps growing day to day"
escalate_with:
  - "select * from public.app_failure_events where signature = '<the line with numbers as #>' order by occurred_at desc limit 50"
```

**What it is.** Since `20261012_157` the website reports every action that
did not go through and every page that could not load something, to
`public.log_app_failure()`. Once a day, in the first hourly run after
midnight UTC, the digest lists each distinct failure of the day before with
how many times it happened and for how many accounts. Numbers and ids are
ignored when deciding what counts as "the same" failure, so "at least 10.00
CAD, and this one is 5.00" and "... 7.50" are one line. At most the 40 most
frequent are listed.

**Reading it.** Most lines are ordinary and need nothing: a form refused
something, with the reason the person was shown; or someone acted on a page
that was out of date. Look for a message that reads like a fault rather than
a refusal (a missing column, "row-level security", "could not be found"), a
high count on one page, or the same line from many accounts. Those are the
failures the rehearsal did not walk into; file each against its playbook.

**What it does not see.** Only what the website reports. A person calling
the database or the API directly, without the website, is in Supabase's and
Cloud Run's own request logs, not here. One account can log at most 120
failures an hour (500 for everyone signed out, together); rows are kept 90
days. Nothing is listed on a day with no failures.

**Money impact.** None by itself.

---

## `OPS-007` — One account is failing over and over

```yaml
id: OPS-007
tier: 2
signals:
  - source: db
    where: public.app_failure_events
    match: "25 or more rows for one user_id (or for user_id null) with occurred_at in the last hour"
  - source: email
    match: "ops digest section \"One account is failing over and over\""
auto_fix: none
reason_not_automatable: "telling a broken screen from someone probing needs a person"
escalate_if:
  - "many different failures in a row from one account, on pages it has no business on"   # -> tier 3
escalate_with:
  - "select occurred_at, source, route, code, message from public.app_failure_events where user_id = '<id>' order by occurred_at desc limit 200"
```

**Cause.** Two very different things look the same here.

- *A broken screen.* The same failure, over and over, on one page: the
  person keeps pressing a button that cannot work. Fix the screen; nobody is
  doing anything wrong.
- *Someone testing the site.* Many different failures in a short time,
  across pages: refusals from steps that are not theirs to take, amounts the
  rules do not allow, pages they cannot open. The refusals mean the rules
  held. Treat it as Tier 3 if any of them is an authorization refusal on
  someone else's commission, and check the account's other activity.

"Signed-out visitors" is everyone without a session taken together, so a
burst there is usually sign-in trouble, not one person.

**Fix.** None automated. The alert is sent once per burst and clears by
itself an hour after the failures stop.

**Money impact.** None by itself.

---

## `OPS-008` — Storage or downloads passed a mark

```yaml
id: OPS-008
tier: 2
signals:
  - source: db
    where: storage.objects, public.delivery_file_downloads
    match: "total stored bytes >= 80 GB, 500 GB or 2 TB; or this month's (UTC) delivery download bytes >= 200 GB or 1 TB"
  - source: email
    match: "ops digest section \"Storage or downloads passed a mark\""
auto_fix: none
reason_not_automatable: "what to do about growth is a cost and product decision"
escalate_with:
  - "the admin Storage page (/admin/storage)"
  - "Supabase dashboard: Organization -> Usage, and Billing -> spend cap"
```

**What it watches (migration `20261016_164`).** The included amounts are
the Supabase Pro plan's: 100 GB of stored files and 250 GB of downloads a
month (written into `list_ops_alerts()` and `admin_get_storage_overview()`;
change both if the plan changes). The marks are 80% of those, then larger
steps. Stored bytes are every file in every bucket. Downloads are only the
delivery files the site records (`record_delivery_file_download`), counted
at the file's size when the link was requested, so the real egress, which
also includes images and the API, is higher: Supabase's usage page has it.

**Cause.** Growth, or one commission storing far more than the rest (the
Storage page lists the largest).

**Fix.** None automated. Check the Supabase spend cap (if it is on, usage
may be blocked at the included amount instead of billed). Then decide:
keep going and pay the overage, lower the limits
(`commission_storage_plans`, the bucket, `create_listing_request_final_delivery_v2`),
or move delivery files to cheaper storage such as Cloudflare R2 (a paid
resource: ask first). Each mark is sent once; the download marks reset
each month.

**Money impact.** Supabase bills about $0.021 per GB a month stored and
$0.09 per GB downloaded past the included amounts (third-party figures,
2026; check Supabase's pricing page).

---

## Setup (user actions, once per environment)

These create paid or external resources and are **not** done by any agent.

1. **Cloudflare Email Routing:** a rule for `ops@madeforstream.com` forwarding
   to the shared inbox, alongside Sprint 8's purpose addresses.
2. **Secret and env on Cloud Run** (`made-for-stream-api`, `us-central1`):

   ```bash
   openssl rand -base64 48 | tr -d '\n' | gcloud secrets create OPS_CRON_SECRET --data-file=-
   ```

   ```bash
   gcloud run services update made-for-stream-api --region us-central1 --update-secrets=OPS_CRON_SECRET=OPS_CRON_SECRET:latest --update-env-vars=OPS_ALERT_EMAIL=ops@madeforstream.com
   ```

   Grant the service's runtime service account `roles/secretmanager.secretAccessor`
   on the new secret if it doesn't already have project-wide access.
3. **Cloud Scheduler jobs** (enable `cloudscheduler.googleapis.com` first;
   the first three jobs per billing account are free, then $0.10/job/month):

   ```bash
   gcloud scheduler jobs create http mfs-connect-resync --location us-central1 --schedule "15 * * * *" --time-zone "Etc/UTC" --http-method POST --uri "https://made-for-stream-api-422533033771.us-central1.run.app/api/internal/ops/connect-resync" --headers "Authorization=Bearer $(gcloud secrets versions access latest --secret OPS_CRON_SECRET)" --attempt-deadline 540s
   ```

   ```bash
   gcloud scheduler jobs create http mfs-ops-alerts --location us-central1 --schedule "45 * * * *" --time-zone "Etc/UTC" --http-method POST --uri "https://made-for-stream-api-422533033771.us-central1.run.app/api/internal/ops/alerts/run" --headers "Authorization=Bearer $(gcloud secrets versions access latest --secret OPS_CRON_SECRET)" --attempt-deadline 180s
   ```

   The header value is stored in the job's configuration, so anyone who can view
   Cloud Scheduler jobs in the project can read it. That's acceptable for a
   secret that only triggers idempotent jobs. Rotate it if project access changes.
4. **Health probe:** set and check it as in
   [`environments.md`](../../environments.md#the-apis-health-probe) (`OPS-004`).
5. **Verify:** force-run both jobs and check for `200`. With nothing open,
   `mfs-ops-alerts` answers `"emailStatus":"not_needed"` and sends nothing.

## Known gaps

- **Timers in the website must end.** Every `refetchInterval` or
  `setInterval` that reads the database needs a stop condition and must not
  run in a hidden tab (TanStack Query's `refetchInterval` already pauses
  when hidden; a raw `setInterval` does not). See `OPS-005`.

- **Nothing alerts when the API itself is down.** The alert job runs on the
  API, so `OPS-004` is silent. The scheduler jobs' failed status is the only
  sign. A Cloud Monitoring uptime check on `/api/health` would close this
  (a cloud resource; not set up).

- **No "alive" email.** A quiet inbox looks the same as a broken job. Cloud
  Scheduler's job status is the check. A Cloud Monitoring alert on job failure
  would close this, but it's another paid resource and hasn't been set up.
- **The resync batch is fixed per run** (`OPS_RESYNC_BATCH_SIZE`, default 100,
  max 500). At 24 runs a day that covers 2,400 stale rows a day. Past a few
  thousand creators, raise it or the frequency.
- **PAY-005's email threshold is deliberately late** (25 h). A buyer who paid
  and whose webhook was lost waits up to a day unless the agent's 30-minute
  signal or `WHK-003` catches it first.
