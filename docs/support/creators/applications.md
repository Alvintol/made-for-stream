---
feature: creators/applications
status: active
surfaces:
  - public.seller_applications
  - public.seller_application_samples
  - src/hooks/creatorApplication/
  - src/domain/creatorApplication/
  - api/creatorApplicationEmail.js                 # when a decision email is sent
  - api/emailTemplates.js                          # renderCreatorApplicationDecisionEmail
  - api/server.js                                  # POST /api/creator-applications/:id/send-decision-email
  - public.seller_application_decision_emails
  - supabase/migrations/20261005_142_add_seller_application_decision_emails.sql
  - src/domain/links/externalLinks.ts              # how sample links are shown to admins
  - src/pages/admin/AdminCreatorApplications.tsx   # SampleLink
  - supabase/migrations/20261005_141_require_web_links_for_application_samples.sql
  - supabase/migrations/20261110_193_add_pre_launch_payment_lock.sql   # audience minimums, 18+, queue of 100
  - check_seller_application_submission()          # trigger seller_applications_check_submission
unmatched_tier: 2
---

# Creator Applications — Support Playbook

Creators apply, submit portfolio samples, and wait for admin approval. Approval
is the gate for everything else: without it a creator cannot connect Stripe, and
without Stripe they cannot publish. The chain is
**approval → payout onboarding → published listing**, and a stall anywhere in it
looks the same to the creator: nothing is happening.

Nothing here is auto-fixable. Approval is a human judgement and stays one — the
agent is explicitly forbidden from writing `seller_applications`.

## What a creator offers (2026-11-12, `20261112_197`)

The application asks "What will you offer?": one checkbox per listing
category, and "Something else" with a required description (up to 80
characters). At least one is needed to submit; the database refuses a
submission without one ("Choose at least one thing you'll offer before you
apply."). The answers are kept on the profile (`profiles.offering_types`,
`profiles.offering_other`), not the application, so creators change them in
Settings → What you offer, and they show as tags on the public profile.

Approved creators who had none when this shipped are sent to Settings from
every page except sign-in, the policies and Personal details, with a banner
saying why, until they save at least one (`ProfileSetupRedirect`). That is
expected, not a fault. Admin's review cards show the answers as tags.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Applications are closed" | [`APP-001`](#app-001--application-capacity-reached) |
| "I can't submit my application" | [`APP-002`](#app-002--application-not-in-a-submittable-state) |
| "My form won't save" | [`APP-003`](#app-003--field-validation-rejected) |
| "I've heard nothing back" | [`APP-004`](#app-004--application-waiting-too-long) |
| "It says I don't have enough followers" | [`APP-007`](#app-007--below-the-audience-minimum-or-18-not-confirmed) |
| "I'm approved but can't publish" | [`connect-onboarding.md`](../payments/connect-onboarding.md) |

---

## `APP-001` — Application capacity reached

```yaml
id: APP-001
tier: 2
signals:
  - source: db
    match: "Creator applications are full right now. Please check again later."
auto_fix: none
reason_not_automatable: "capacity is a deliberate business setting"
escalate_with:
  - "current application count against the cap"
  - "how many are pending review versus already resolved"
```

**Cause.** A deliberate cap on open applications, working as designed. It was
raised from 10 to 100 on 2026-11-10 for TwitchCon sign-ups
(`submit_seller_application` and `get_creator_application_queue_state`, which
must agree).

**What the user sees.** A closed door, with no indication of when it reopens.

**Fix.** Not a bug. But the escalation matters: if the cap is full of *pending*
applications rather than processed ones, the bottleneck is review throughput, not
capacity — and raising the cap would make that worse rather than better.

**Money impact.** None directly. Every blocked applicant is a creator who may not
come back.

---

## `APP-002` — Application not in a submittable state

```yaml
id: APP-002
tier: 2
signals:
  - source: db
    match: "Application could not be submitted. Only draft or needs-changes applications can be submitted."
auto_fix: none
reason_not_automatable: "state machine working correctly; the UI is what is wrong"
escalate_with:
  - "the application's actual status"
  - "whether the UI was showing a submit action for it"
```

**Cause.** Only `draft` and `needs_changes` applications can be submitted. A
double-click, a stale tab, or an already-submitted application produces this.

**What the user sees.** An error on submit, often on an application they believe
is unsubmitted.

**Fix.** Refresh and check the real status. If the UI offered submit for an
application in another state, that is a front-end bug worth fixing rather than
explaining repeatedly.

**Money impact.** None.

---

## `APP-003` — Field validation rejected

```yaml
id: APP-003
tier: 2
signals:
  - source: db
    match: "Additional details must be 1000 characters or less."
  - source: db
    match: "Please add at least 10 characters of detail when choosing Other."
  - source: db
    match: "Admin notes must be 2000 characters or less."
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "a limit is hit frequently"   # the limit may be wrong, not the users
```

**Cause.** Server-side validation catching input the client should have caught
first.

**What the user sees.** A rejection after submitting, sometimes losing what they
typed — which for a long application is genuinely infuriating.

**Fix.** Shorten the input. But note the pattern: **these firing at all means
client-side validation is missing or inconsistent.** The server check is the
backstop, not the intended user experience.

**Money impact.** None. Costs goodwill at a first impression.

---

## `APP-005` — Sample link refused, or flagged to the reviewer

```yaml
id: APP-005
tier: 2
signals:
  - source: db
    match: "/violates check constraint \"seller_application_samples_url_is_web_link\"/"
    where: "public.seller_application_samples (20261005_141)"
  - source: client
    match: "Enter a valid public link, e.g. youtube.com/watch?v=…"
    where: "getUrlValidationError (src/domain/creatorApplication/creatorApplication.ts)"
auto_fix: none
reason_not_automatable: "the applicant has to supply a different link; a constraint hit that got past the form is someone bypassing it"
escalate_if:
  - "the database signal fires at all"   # the form refuses these first, so this is a direct API write
escalate_with:
  - "the applicant's user id and the value they tried to store"
```

**Cause.** Sample links are whatever the applicant typed, and an administrator
is the one who clicks them. A link is stored only if it is an ordinary
`http`/`https` address with no spaces and no `user@` part in front of the site
name (`https://youtube.com@evil.example` goes to `evil.example`). The form
checks this, and since `20261005_141` the database does too, because an
applicant can write their own sample rows directly.

**What the reviewer sees** (`/admin/creator-applications`). Each sample shows
where the link really goes and one of three labels:

- **Known site**: a site creators commonly use (YouTube, Twitch and so on),
  with nothing odd about the address. Opens directly.
- **Check before opening**: anything else, with the reasons listed: an
  unfamiliar domain, a link shortener or tracker, a raw network address, a
  lookalike domain using special characters, a direct file download, an unusual
  port, or no encryption. Opening it asks for confirmation first.
- **Blocked**: not a web link at all. It is shown as text and cannot be clicked.

**What this does not do.** It cannot tell whether a page is harmful. A link to
a known site can still lead to bad content, and an unfamiliar site can be
perfectly fine. Reviewers should not sign in to anything or download anything
from a sample link, and should use a separate browser profile for reviewing.
If an applicant's samples can only be seen by downloading a file or logging
in somewhere, ask them for a different link (`needs_changes`).

**Fix.** For the applicant: use a direct link to the work on a public page.
For a database signal: treat it as a deliberate attempt and review the
account before approving anything.

**Money impact.** None.

---

## `APP-006` — Applicant was not emailed about a decision

```yaml
id: APP-006
tier: 2
signals:
  - source: api
    match: "/APP-006: decision email \\((approved|needs_changes|rejected)\\) for creator application [0-9a-f-]+ failed: /"
    where: "POST /api/creator-applications/:id/send-decision-email (api/server.js), server logs"
  - source: api
    match: "/APP-006: decision email for creator application [0-9a-f-]+ was (sent|failed) but could not be recorded: /"
    where: "same route"
  - source: db
    where: public.seller_application_decision_emails
    match: "email_status = 'failed' with no later 'sent' row for the same application and status"
  - source: user_report
    match: "I was approved / rejected but never got an email"
auto_fix: none
reason_not_automatable: "the cause is email configuration or the applicant's address; resending is a one-click admin action"
escalate_with:
  - "the application id, its status, and its rows in seller_application_decision_emails"
  - "whether the applicant's address is in email_suppressions"
```

**How it works.** When an administrator sets an application to **approved**,
**needs changes** or **rejected**, the admin page saves the decision and then
asks the API to email the applicant. The API reads the decision and the
applicant's address itself, sends one email per decision, and records every
attempt. Saving the same decision again does not send a second email. A second
"needs changes" after the applicant resubmits does. **Under review** and
**suspended** send nothing: the first is not a decision, and a suspension is a
sanction with its own appeal route.

**Cause of a miss.** The email is a best-effort follow-up, so the decision
stands even when it fails. Usual reasons: SMTP not configured or refused
(`failed_reason` says which; see
[`transactional-email.md`](../messaging/transactional-email.md) `EMAIL-001`),
the address is on `email_suppressions` after a bounce, the API was down when
the admin clicked, or migration `20261005_142` is not applied (the log then
says the table does not exist).

```sql
select application_id, status, email_status, failed_reason, attempted_at
from public.seller_application_decision_emails
where application_id = '<application>'
order by attempted_at desc;
```

**What the user sees.** Nothing arrives. The decision and the reviewer's note
are still on their application page (`/apply/creator`).

**Fix.** Fix the cause, then have an administrator open the application and
save the same decision again: with no successful row recorded, it sends. If a
row says `sent` and the applicant still has nothing, it is a delivery problem
(spam folder, wrong address), not this.

**Money impact.** None directly. An approved creator who never hears about it
does not set up payouts or list anything.

---

## `APP-004` — Application waiting too long

```yaml
id: APP-004
tier: 2
signals:
  - source: db
    where: public.seller_applications
    match: "status = 'submitted' AND updated_at < now() - interval '7 days'"
  - source: user_report
    match: "applicant asking about status"
auto_fix: none
reason_not_automatable: "review is a human decision; the agent may never approve"
escalate_with:
  - "count and age of the pending queue"
  - "the oldest pending application"
```

**Cause.** The review queue is not being worked.

**What the user sees.** Silence. They do not know whether they were rejected,
forgotten, or are still in a queue.

**Fix.** Review the queue. **The agent must never approve or reject an
application** — it is on the forbidden list. It may only surface the backlog.

**Why it is worth alerting on.** This is a business failure that generates no
errors. Nothing is broken, so nothing reports it, and the only signal is
applicants giving up quietly.

**Money impact.** None directly, and significant in aggregate — unapproved
creators are unlisted inventory.

---

## `APP-007` — Below the audience minimum, or 18+ not confirmed

```yaml
id: APP-007
tier: 2
signals:
  - source: db
    match: "To apply you need Twitch Affiliate or Partner with at least 300 followers, or at least 500 YouTube subscribers."
    where: "trigger seller_applications_check_submission (check_seller_application_submission), on submitting"
  - source: db
    match: "You must confirm you are at least 18 to apply."
    where: "trigger seller_applications_check_submission, on submitting"
auto_fix: none
reason_not_automatable: "the minimums are a business rule, and the numbers are the applicant's own"
escalate_with:
  - "the applicant's twitch_status, twitch_follower_count and youtube_subscriber_count"
```

**Cause.** Since 2026-11-10 an application can only be submitted with Twitch
Affiliate or Partner and at least 300 followers, or with at least 500 YouTube
subscribers, and with the 18+ agreement ticked. The applicant types in these
numbers. The database refuses a submission below them, because the update
policy would otherwise let an applicant submit without going through
`submit_seller_application`.

**What the user sees.** On the form, the "Your audience" box and a line in the
checklist ("Twitch Affiliate with 300+ followers, or 500+ YouTube
subscribers"). Submit stays disabled until it's met. The database messages
above only appear if something gets past the form.

**Manual fix.** None; the minimums apply to everyone. **When reviewing, check
the numbers against the linked channel.** They're shown in the review queue,
and nothing verifies them automatically. Typing false numbers breaks Terms
section 3.

**Money impact.** None.

---

## Known gaps

- **Audience numbers aren't verified automatically.** They're checked by hand
  at review, on purpose, so bots can't game them.

- **No queue-age alerting.** `APP-004` has to be run by hand.
- **No applicant-facing status visibility** beyond the raw state, so "how long
  will this take" cannot be answered in-product.
- **Portfolio sample storage failures are undocumented.** Upload errors fall
  through to Tier 2 unmatched.
- **No rejection-reason playbook.** What applicants are told when declined, and
  whether they may reapply, is not defined anywhere.
