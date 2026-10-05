---
feature: payments/connect-onboarding
status: active
surfaces:
  - api/server.js                                    # POST /api/stripe/connect/sync, POST /api/stripe/connect/account-session, POST /api/stripe/account-events, POST /api/internal/ops/connect-resync, getOrCreateStripeAccountForEmbeddedConnect, setStripeConnectDailyPayoutSchedule, upsertCreatorPaymentAccount, resyncCreatorPaymentAccountFromStripe
  - api/supportedCountries.js                        # payout countries and their currencies; mirrored in src/domain/payments/supportedCountries.ts
  - api/connectAccountState.js                       # the one v2 Account -> mirror mapping, event classification, resync selection
  - src/hooks/payments/useStripeConnectAccountSession.ts
  - public.creator_payment_accounts                  # stripe_state_observed_at, readiness_lost_at, requirements_due_count, requirements_past_due_count (20260924_139)
  - public.stripe_webhook_events                     # thin account events are deduplicated here too
  - public.guard_creator_payment_account_state_order()
  - public.assert_creator_ready_for_paid_work()
  - supabase/migrations/20260622_107_require_payment_account_for_active_listings.sql
  - supabase/migrations/20260924_139_add_connect_account_state_and_ops_alerts.sql
unmatched_tier: 2
---

# Stripe Connect Onboarding — Support Playbook

> **2026-09-22: migrated from Stripe Accounts v1 to v2.** `POST
> /api/stripe/connect/start` (Stripe-hosted Account Link onboarding, v1
> `type: "express"` accounts) was removed as dead code — nothing in `src/`
> ever called it. The only live onboarding path was always
> `POST /api/stripe/connect/account-session` (embedded components), which now
> creates **Accounts v2** accounts matching the platform's own Connect
> configuration (`fees_collector`/`losses_collector: "stripe"`, `dashboard:
> "none"`). This is also why the creator, not the platform, now bears
> Stripe's 2.9%+CA$0.30 processing fee — see `launch-scope.md` §3.2. The
> readiness fields this playbook discusses (`charges_enabled`,
> `payouts_enabled`, `details_submitted`) are unchanged in shape; they are
> now derived from v2 capability statuses
> (`deriveCreatorPaymentAccountReadinessFromV2Account`) instead of read
> directly off a v1 Account object, but nothing downstream — the readiness
> trigger, the frontend, this playbook's detection queries — needed to
> change.

Creators must connect a Stripe account before they can publish an active listing
or receive a payment. Made for Stream keeps a mirror of each creator's account state
in `creator_payment_accounts` — `charges_enabled`, `payouts_enabled`,
`details_submitted` — and database triggers use it: publishing needs a ready
account, and so does starting new paid work (see
[`CON-007`](#con-007--new-paid-work-refused-because-the-account-is-not-ready)).

**The mirror is the weak point of this whole feature.** Since Sprint 9
(`20260924_139`) three things keep it current, all through one mapping
(`buildCreatorPaymentAccountPatch` in `api/connectAccountState.js`):

1. **Account events.** `POST /api/stripe/account-events` receives Stripe's
   Accounts v2 **thin events** — `v2.core.account[requirements].updated`,
   `v2.core.account[configuration.merchant].capability_status_updated`,
   `v2.core.account[configuration.recipient].capability_status_updated` and
   `v2.core.account.closed` — from their own event destination. It confirms the
   event with `stripe.v2.core.events.retrieve`, then re-reads the account. It
   never takes state from the event itself.
2. **The hourly resync.** `POST /api/internal/ops/connect-resync`, called by
   Cloud Scheduler, re-reads every row not synced in 6 hours (up to
   `OPS_RESYNC_BATCH_SIZE`, default 100, per run).
3. **The settings page**, as before.

**Ordering.** Every write carries `stripe_state_observed_at`, taken just before
the Stripe read. `guard_creator_payment_account_state_order` keeps the recorded
state when a write is not strictly newer. A replayed, duplicated or late event
only ever causes a fresh read, and a slow read that lands after a newer one is
ignored. A manual `update` that doesn't advance `stripe_state_observed_at`
cannot change readiness either. Use the resync, not SQL.

Before Sprint 9 the mirror drifted in both directions. If events stop, it still can,
and both directions are bad:

- **Stale-stale:** the creator finished onboarding, we still think they have not.
  They cannot publish; buyers are told they cannot accept payments.
- **Stale-fresh:** Stripe restricted the creator, we still think they are fine.
  Their listings stay live and buyers open checkouts that will fail.

Most of this playbook is about that drift.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I finished Stripe but can't publish" | [`CON-001`](#con-001--creator-finished-onboarding-but-is-still-blocked) |
| "It says I need to connect payouts, I already did" | [`CON-001`](#con-001--creator-finished-onboarding-but-is-still-blocked) |
| "Buyers say I can't accept payments" | [`CON-001`](#con-001--creator-finished-onboarding-but-is-still-blocked), [`CON-003`](#con-003--stripe-restricted-an-account-and-we-did-not-notice) |
| "Stripe is asking for more documents" | [`CON-004`](#con-004--stripe-requires-additional-verification) |
| "I can't start Stripe onboarding at all" | [`CON-002`](#con-002--creator-is-not-approved-yet) |
| "It says the creator can't take new paid work" / "It says my payout account needs attention" | [`CON-007`](#con-007--new-paid-work-refused-because-the-account-is-not-ready) |
| (internal) Mirror rows not refreshed in 48 hours | [`CON-006`](#con-006--payment-account-mirror-is-not-being-refreshed) |

---

## `CON-001` — Creator finished onboarding but is still blocked

```yaml
id: CON-001
tier: 1
signals:
  - source: api
    match: "Creator has not connected Stripe payouts."
  - source: api
    match: "Creator Stripe account is not ready for payments."
  - source: db
    match: "Creator payout account must be ready before publishing active listings."
  - source: db
    where: public.creator_payment_accounts
    match: "charges_enabled = false AND last_synced_at < now() - interval '1 hour'"
auto_fix: resync_connect_account
params:
  user_id: "$.creator_user_id"
verify:
  - "creator_payment_accounts.last_synced_at advanced"
  - "charges_enabled reflects the live Stripe account"
retry_limit: 2
escalate_if:
  - "Stripe confirms charges_enabled is genuinely false"   # -> CON-004
  - "no Stripe account exists for this user"               # -> CON-002
```

**Cause.** Our mirror is stale. The creator completed onboarding in Stripe and
the update has not reached us yet. With account events delivered this lasts
seconds, and the hourly resync bounds it at about 7 hours. Longer than that
means events and the resync are both failing: see
[`CON-006`](#con-006--payment-account-mirror-is-not-being-refreshed).

**What the user sees.** They completed everything Stripe asked for, and
Made for Stream still behaves as though they have not. From their side this looks like
the product is broken, and they are right.

**Fix.** Re-sync from Stripe. If they are ready, this unblocks them immediately.

**If Stripe says they are genuinely not ready**, this is not stale data — it is
[`CON-004`](#con-004--stripe-requires-additional-verification), and the creator
has outstanding requirements.

**Money impact.** None directly, but the creator cannot publish or sell. For a
marketplace, a creator blocked at onboarding is a creator who leaves.

---

## `CON-002` — Creator is not approved yet

```yaml
id: CON-002
tier: 2
signals:
  - source: api
    match: "Only approved creators can connect Stripe payouts."
    where: api/server.js  # requireApprovedCreator
auto_fix: none
reason_not_automatable: "approval is a human decision and must stay one"
escalate_with:
  - "the creator's seller_applications status"
  - "how long it has been in that status"
```

**Cause.** Stripe onboarding requires an `approved` row in `seller_applications`.
The creator is applying before approval, or their application is still pending.

**What the user sees.** They cannot start payout setup, usually without
understanding that approval comes first.

**Fix.** None technical. Either the application needs reviewing, or the creator
needs telling where they are in the queue. **The agent must never approve an
application** — that is on the forbidden list.

**Why it is Tier 2 and not just noise.** A backlog of these is a signal that
applications are not being reviewed, which is a business problem worth surfacing
even though each individual case is working as designed.

**Money impact.** None.

---

## `CON-003` — Stripe restricted an account and we did not notice

```yaml
id: CON-003
tier: 2
signals:
  - source: api
    match: "/CON-003: creator payment account acct_\\w+ lost readiness/"
    where: "resyncCreatorPaymentAccountFromStripe (api/server.js), server logs"
  - source: alert
    match: "payment_account_lost_readiness (CON-003)"
    where: "public.list_ops_alerts(), emailed by POST /api/internal/ops/alerts/run"
  - source: db
    where: public.creator_payment_accounts
    match: "readiness_lost_at IS NOT NULL AND NOT (charges_enabled AND payouts_enabled AND details_submitted)"
auto_fix: none
reason_not_automatable: "the resync is safe, but removing a creator's live listings is a business decision"
escalate_with:
  - "the creator's active listing count"
  - "any in-flight requests and their payment states"
  - "the Stripe disabled_reason and outstanding requirements"
  - "money currently held against this creator"
```

**Cause.** Stripe restricted or disabled the account — verification lapsed, a
document expired, or risk review. Since Sprint 9 the account event (or the
hourly resync) records it: the flags go false, `readiness_lost_at` is set, the
API logs the `CON-003` line, and the hourly alert run emails ops while the
creator still has live listings.

Recording it stops **new** paid work at the database
([`CON-007`](#con-007--new-paid-work-refused-because-the-account-is-not-ready)):
no new requests, agreements or price-increasing change orders can be sent or
accepted, and checkout refuses at
[`PAY-003`](checkout.md#pay-003--creator-cannot-accept-payments-yet). What it
does **not** do is unpublish listings or cancel work in flight.

**Query.**

```sql
select a.user_id, a.stripe_account_id, a.readiness_lost_at,
       a.charges_enabled, a.payouts_enabled, a.details_submitted,
       a.requirements_due_count, a.requirements_past_due_count
from public.creator_payment_accounts a
where a.readiness_lost_at is not null
  and not (a.charges_enabled and a.payouts_enabled and a.details_submitted);
```

**What the user sees.** Buyers find they can't request, accept or pay for new work,
and see the `CON-007` message. The creator sees the creator-side `CON-007`
message when they try to send an agreement.

**Fix.** Tell the creator exactly what Stripe needs (`CON-004`), then decide what
to do about the listings. Unpublishing someone's listings is a business decision
with real consequences for them, so this stays an escalation. The agent may run
the resync to confirm the state is current.

**Money impact.** In-flight projects with outstanding payments are stuck. If the
restriction affects payouts rather than charges, money may be captured and
unpayable, which is worse and needs urgent attention.

**Why this was a launch blocker.** Without account events, the only thing
standing between a restricted creator and a broken buyer experience was somebody
noticing. Sprint 9 closed that. It is only as good as event delivery and the
resync (`CON-006`).

---

## `CON-004` — Stripe requires additional verification

```yaml
id: CON-004
tier: 2
signals:
  - source: stripe
    match: "account.requirements.currently_due is non-empty"
  - source: db
    where: public.creator_payment_accounts
    match: "details_submitted = true AND charges_enabled = false"
auto_fix: none
reason_not_automatable: "only the creator can satisfy Stripe requirements"
escalate_with:
  - "the specific currently_due and past_due requirement list"
  - "the Stripe deadline, if one is set"
```

**Cause.** Normal Stripe behaviour. Accounts hit verification thresholds as
volume grows, and Stripe asks for identity documents, a bank account, or
business details.

**What the user sees.** They submitted everything and are still not enabled,
with no clear explanation on the Made for Stream side.

**Fix.** The creator completes the requirements in Stripe. Support's job is to
tell them *specifically* what is outstanding — the requirement list is readable
from the account, and a precise ask resolves far faster than "check Stripe".

**Money impact.** None yet, but there may be a deadline after which Stripe
disables the account, at which point it becomes `CON-003`.

---

## `CON-005` — Invalid country or currency on the account

```yaml
id: CON-005
tier: 2
signals:
  - source: api
    match: "A valid two-letter country code is required."
  - source: api
    match: "A valid three-letter currency code is required."
  - source: api
    match: "/Payouts are not available in [A-Z]{2} yet\\. Choose a country from the list in payout settings\\./"
    where: "POST /api/stripe/connect/account-session (api/supportedCountries.js)"
auto_fix: none
reason_not_automatable: "indicates a data problem in the account record"
escalate_with:
  - "the raw country and default_currency from the Stripe account"
```

**Cause.** The Stripe account returned a country or currency that failed
validation during upsert. In practice this means an unexpected account shape, not
a user error.

**What the user sees.** Onboarding or sync fails with an opaque error.

**Fix.** Manual investigation.

**Money impact.** None yet.

**Unsupported country.** Since 2026-10-05 the payout-settings form offers a
dropdown of the countries in `api/supportedCountries.js`, and the
account-session route refuses any other with the message above. A country is
listed when Stripe supports connected accounts there, a Canadian platform may
onboard them (Brazil, Malaysia and Thailand are domestic-only), and its local
currency is one projects can be priced in (which leaves out Japan, Czechia,
Hungary, Romania, the UAE and Gibraltar for now). Choosing a country sets the
currency to its own. The list follows Stripe's published availability and has
**not been confirmed against this platform's Dashboard**; Stripe still refuses
anything it will not onboard. A creator asking for an unlisted country is a
product request, not a fault.

**Unsupported but valid currency.** Since `20260923_138` the account-session
route also refuses a well-formed currency that is not enabled, with HTTP 400 and
[`AGR-006`](../requests/agreements.md#agr-006--the-projects-currency-is-not-supported)'s
message. The payout-settings form now offers only enabled currencies, so this
needs a stale client or a direct API call.

---

---

## `CON-006` — Payment account mirror is not being refreshed

```yaml
id: CON-006
tier: 2
signals:
  - source: alert
    match: "payment_account_mirror_stale (CON-006)"
    where: "public.list_ops_alerts(): last_synced_at is null or older than 48 hours"
  - source: api
    match: "/CON-006: scheduled resync of creator payment account acct_\\w+ failed: /"
    where: "POST /api/internal/ops/connect-resync, server logs"
  - source: api
    match: "/CON-006: scheduled resync failed: /"
    where: "POST /api/internal/ops/connect-resync, server logs"
  - source: api
    match: "/CON-006: account event evt_\\w+ did not match its notification\\./"
    where: "POST /api/stripe/account-events"
  - source: db
    where: public.stripe_webhook_events
    match: "event_type like 'v2.core.account%' and processing_status = 'failed'"
auto_fix: none
reason_not_automatable: "the cause is infrastructure (scheduler, secret, Stripe key, destination), not a row"
escalate_with:
  - "the Cloud Scheduler job's last run status and HTTP code"
  - "recent CON-006 log lines"
  - "failed v2.core.account% rows in stripe_webhook_events with error_message"
```

**Cause.** One of these:

- The `connect-resync` Cloud Scheduler job is paused, deleted or getting `401`
  (`OPS-002` in [`operations/alerting.md`](../operations/alerting.md)).
- Stripe reads are failing, for example a rotated key or a closed account.
  Each failing account logs its own line and the run carries on.
- Account events are failing. The destination is disabled, the
  `STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_*` doesn't match, or events are rejected.
  Stripe's dashboard shows delivery failures on the destination.

Healthy, the resync touches every row at least every 7 hours, so 48 hours means
something has been failing for about two days.

**What the user sees.** Nothing until a creator's real state changes. Then it's
`CON-001` or `CON-003`.

**Fix.** Check the scheduler job first, then the log lines. Run the job by
hand from Cloud Scheduler ("Force run") and confirm the response's `refreshed`
count. A single account failing on every run with `No such account` or
similar has been closed or removed at Stripe. Escalate with its row.

**Money impact.** Indirect: readiness decisions are made on stale data.

---

## `CON-007` — New paid work refused because the account is not ready

```yaml
id: CON-007
tier: 2
signals:
  - source: db
    match: "Your payout account needs attention before you can send paid work. Open Settings and finish what Stripe is asking for, then try again."
    where: "assert_creator_ready_for_paid_work (20260924_139) -- agreement sent, price-increasing change order sent"
  - source: db
    match: "This creator cannot take new paid work right now because their payout account needs attention. Please try again later."
    where: "assert_creator_ready_for_paid_work (20260924_139) -- request submitted, agreement accepted, price-increasing change order accepted"
auto_fix: none
reason_not_automatable: "working as designed; only the creator can satisfy Stripe"
escalate_with:
  - "the creator's creator_payment_accounts row (flags, requirement counts, readiness_lost_at, last_synced_at)"
  - "whether a resync changes it"
```

**Cause.** The same readiness check that gates publishing
(`has_ready_creator_payment_account`) now also gates the moments new paid work
starts: submitting a request, sending or accepting an agreement with a total
above zero, and sending or accepting a change order that raises the price.
Requests for a **free listing** (`listings.is_free`, exempt since
`20260926_140`, matching the publish check), drafts, cancellations,
price-neutral or price-lowering change orders, and
payments already owed on accepted work are not affected.

**What the user sees.** A buyer or creator gets one of the two messages above
when they try to go ahead.

**Fix.** Run the resync (`resync_connect_account`) in case the mirror is
stale (`CON-001`). If Stripe really does have the account restricted, it's
`CON-004` for the creator: tell them specifically what's outstanding. Tell the
buyer the creator is sorting out their payout account.

**Money impact.** None. This refusal is what keeps money out of an account
that can't take it.

---

## Known gaps

- **The account-events destination is a Dashboard step.** Until it exists in
  each Stripe mode (Workbench → Webhooks → Create event destination,
  **Events from: Your account**, payload style **Thin**), only the hourly resync
  and the settings page refresh the mirror. Registering it is a user action,
  tracked in the launch checklist's Sprint 9 section.
- **Live listings stay live when readiness is lost.** New paid work is refused
  (`CON-007`) and ops is alerted (`CON-003`), but unpublishing is a business
  decision and remains manual.
- **Work already accepted keeps its payment rows.** A milestone or balance
  that falls due after the account is restricted is created as usual, and
  checkout refuses it (`PAY-003`) until the account recovers.
- **The requirement counts are unverified against a live restricted v2
  account.** They read `requirements.entries[].minimum_deadline.status` and
  `awaiting_action_from` as the SDK types describe.
- Non-US, non-USD onboarding is untested end to end.
