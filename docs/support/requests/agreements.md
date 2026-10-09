---
feature: requests/agreements
status: active
surfaces:
  - public.listing_request_agreements
  - public.listing_request_agreement_items
  - public.listing_request_payment_schedule_items
  - supabase/migrations/20260921_117_per_user_fee_rates_and_no_minimums.sql
  - public.resolve_listing_request_fee_rates
  - supabase/migrations/20260923_138_add_supported_currencies_instalment_floor_and_early_start_consent.sql
  - public.supported_currencies
  - public.assert_listing_request_instalment_allowed
  - public.respond_listing_request_agreement
  - public.policy_acceptances
  - src/components/listingRequests/agreements/ListingRequestAgreementBuyerActions.tsx
  - src/components/listingRequests/agreements/ListingRequestAgreementBuilder.tsx
  - src/domain/payments/supportedCurrencies.ts
  - api/supportedCurrencies.js
  - public.enforce_listing_request_agreement_currency()
  - public.enforce_listing_request_schedule_item_currency()
  - supabase/migrations/20261007_146_add_listing_currency_and_display_preferences.sql
unmatched_tier: 2
---

# Project Agreements — Support Playbook

The agreement is the record of what was agreed: scope, timeline, revision policy,
required buyer confirmations, and the payment schedule. Buyer acceptance of the
agreement is what turns a conversation into a commitment, and it is what a
dispute is later argued from.

Payment timing is chosen here — full prepayment, deposit plus balance, or
milestones — and the schedule items created here become the actual Stripe
payments later. **Errors in this playbook are therefore money errors in waiting.**

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't send the agreement" | [`AGR-001`](#agr-001--agreement-totals-do-not-reconcile), [`AGR-002`](#agr-002--agreement-not-in-a-sendable-state) |
| "The buyer can't accept it" | [`AGR-003`](#agr-003--required-confirmations-not-acknowledged) |
| "Milestone amounts are rejected" | [`AGR-001`](#agr-001--agreement-totals-do-not-reconcile) |
| "It says each payment must be at least 10.00" | [`AGR-005`](#agr-005--a-payment-is-below-the-instalment-floor) |
| "It says the currency is not supported" | [`AGR-006`](#agr-006--the-projects-currency-is-not-supported) |
| "The buyer can't accept: it asks to confirm an early start" | [`AGR-007`](#agr-007--acceptance-refused-without-the-early-start-request) |
| "It says the amount is too small" at checkout | [`PAY-004`](../payments/checkout.md#pay-004--payment-amount-or-fee-setup-is-invalid) |

---

## `AGR-001` — Agreement totals do not reconcile

```yaml
id: AGR-001
tier: 2
signals:
  - source: db
    match: "Milestone item amounts must equal the agreement total."
  - source: db
    match: "Milestone payment amounts must equal the agreement total."
  - source: db
    match: "Every milestone must have an amount greater than zero."
  - source: db
    match: "Every milestone must have a matching payment schedule item."
  - source: db
    match: "Every milestone payment must reference its milestone agreement item."
  - source: db
    match: "Milestone payment agreements require at least two milestones."
  - source: db
    match: "Milestone item correlation keys must be unique."
auto_fix: none
reason_not_automatable: "the agent may never adjust money figures"
escalate_with:
  - "the agreement total and the sum of milestone amounts"
  - "the payment schedule items and their correlation keys"
```

**Cause.** The milestone breakdown does not add up to the agreement total, a
milestone has no matching schedule item, or correlation keys collide. These
checks exist so the sum of what the buyer will be charged always equals what was
agreed.

**What the user sees.** The agreement refuses to save, usually with a message
about amounts not matching — often after a long form, which makes it costly.

**Fix.** Correct the figures so the milestones sum to the total. **The agent must
never adjust an amount to make a total reconcile.** A silently balanced
agreement is a false record of what two people agreed.

Rounding is a common cause: three milestones on an odd total cannot split evenly,
and the remainder has to land somewhere explicitly.

**Money impact.** None yet — this is the check preventing a mismatch. Which is
exactly why it must not be worked around.

---

## `AGR-002` — Agreement not in a sendable state

```yaml
id: AGR-002
tier: 2
signals:
  - source: db
    match: "Agreement status must be draft or sent."
  - source: db
    match: "Agreement response must be buyer_accepted or buyer_declined."
  - source: db
    match: "Agreement items must be provided as an array."
  - source: db
    match: "Payment schedule items must be provided as an array."
  - source: db
    match: "Unsupported payment timing: %."
auto_fix: none
reason_not_automatable: "state machine or malformed payload"
escalate_if:
  - "an array or payment-timing error occurs"   # client bug, not user error
```

**Cause.** Two different things share this entry. Status errors are ordinary
out-of-order actions, usually a stale page. The array and payment-timing errors
are **client bugs** — the UI sent something malformed, and no user action
produces them.

**Fix.** For status errors, refresh. For malformed payloads, it is a front-end
defect and should be treated as one rather than explained to the user.

**Money impact.** None directly.

---

## `AGR-003` — Required confirmations not acknowledged

```yaml
id: AGR-003
tier: 2
signals:
  - source: db
    match: "You must acknowledge every required agreement item before accepting."
auto_fix: none
reason_not_automatable: "acknowledgement is the buyer's act and the point of the feature"
```

**Cause.** The buyer tried to accept without every required confirmation.

**How the buyer confirms (2026-10-08).** A sent agreement is shown with an
"I understand the … above." box under each of its sections: Terms, Scope,
Scope checklist (when there is one), Payment schedule and Policies. One box
stands for every confirmation the database requires about that section
(`getAgreementAcknowledgementSection` in
`src/domain/listings/listingRequestAgreements.ts`); the website still sends
every key, and `respond_listing_request_agreement` still checks and records
each one with its own wording, so "Buyer confirmations" on an accepted
agreement lists them item by item. The rules a box stands for are written in
its section: buyer-side holds under Terms, held final files under Payment
schedule, change orders under Policies.

**What the user sees.** The Accept button stays disabled, and the panel under
the agreement says how many sections are confirmed ("3 of 5 confirmed"). The
database message itself normally means a direct call.

**Fix.** The buyer ticks the box under each remaining section. **Nobody may acknowledge on
a buyer's behalf**, including support and including the agent. These
confirmations are the evidence that the buyer agreed to specific terms, and an
acknowledgement they did not make is worthless in a dispute — worse than
worthless, because it looks like evidence.

**Money impact.** None yet. High value later: these confirmations are the core
evidence in [`REF-003`](../payments/refunds-and-disputes.md#ref-003--dispute-opened-against-a-creator).

---

## `AGR-004` — Payment schedule item missing at payment time

```yaml
id: AGR-004
tier: 2
signals:
  - source: db
    match: "Payment schedule item % was not found."
  - source: db
    match: "No starting payment item is available to confirm."
  - source: db
    match: "This starting-payment schedule item is not awaiting payment."
auto_fix: none
reason_not_automatable: "data inconsistency between agreement and payment records"
escalate_with:
  - "the agreement's schedule items and their states"
  - "existing listing_request_payments rows for the request"
```

**Cause.** The bridge from agreement schedule to Stripe payment could not find
the expected item, or it is not in the expected state. Either it was already
consumed or the agreement changed underneath it.

**What the user sees.** A payment that cannot be started, on a project that
appears ready to pay.

**Fix.** Manual reconciliation of schedule items against payment rows. Do not
create a schedule item to satisfy the error.

**Money impact.** Blocked payment. If it recurs, it is a data-integrity issue and
belongs at Tier 3.

---

## `AGR-005` — A payment is below the instalment floor

```yaml
id: AGR-005
tier: 1
signals:
  - source: db
    match: "Each payment in a project must be at least % %, and this one is % %. Combine it with another payment or raise its amount."
auto_fix: none
reason_not_automatable: "explanation, not a fault; the amounts are the parties' to change"
```

**Cause.** Since `20260923_138` every payment in a project must be at least
**10.00** in the project's currency
(`public.supported_currencies.minimum_instalment_minor_units`, 1000 for every
currency today). `public.assert_listing_request_instalment_allowed` raises this
when:

- a schedule item is created or its amount changes (trigger
  `listing_request_schedule_items_enforce_instalment`), so creating an agreement
  directly as `sent` is refused here;
- a draft agreement is sent (trigger
  `listing_request_agreements_enforce_instalments` re-checks every schedule
  item);
- a change order carrying a price increase is sent
  (`listing_request_change_orders_enforce_instalment`); see
  [`change-orders.md`](change-orders.md).

The agreement builder shows the same message before submitting, prefixed
"Deposit:", "Remaining balance:" or the milestone's title, so a creator normally
sees it without the database ever refusing.

**What the user sees.** The message itself. It names the floor and the offending
amount, and says what to do.

**Fix.** Explain it: the creator combines the small payment with another one
(fewer milestones, a larger deposit) or raises it. The floor protects the
creator from Stripe's flat per-payment charge, which the creator bears under
Model A. Do not lower the floor for one project: it is a single row per currency,
so changing it changes it for everyone.

**Not affected.** Schedules accepted before `20260923_138` keep working. The
trigger ignores status-only updates, and the payment bridge's own backstop still
uses the old 5.00 (`PAY-004`). Waived and cancelled items are never checked.

**Money impact.** None. Nothing has been charged.

---

## `AGR-006` — The project's currency is not supported

```yaml
id: AGR-006
tier: 1
signals:
  - source: db
    match: "Payments in % are not supported yet. Price the project in a currency listed in the Fee Schedule."
  - source: api
    match: "are not supported yet. Price the project in a currency listed in the Fee Schedule."
auto_fix: none
reason_not_automatable: "explanation; enabling a currency is a product decision and a migration"
```

**Cause.** The agreement, a schedule item, a payment at checkout, or a creator's
default currency at onboarding is not an enabled row in
`public.supported_currencies`. Enabled today: CAD, USD, EUR, GBP, AUD, NZD, CHF,
SGD, SEK, NOK, DKK, PLN, MXN, BRL, HKD, the two-decimal majors. Zero- and
three-decimal currencies (JPY, KRW, KWD, ...) are refused by a check constraint,
because the payment bridge still converts with `* 100` (`launch-scope.md` §1.1).

The same list lives in `api/supportedCurrencies.js` (the checkout backstop, and
`POST /api/stripe/connect/account-session`) and
`src/domain/payments/supportedCurrencies.ts` (forms, and the payout-settings
currency picker). `supportedCurrenciesSync.test.ts` keeps all three aligned.

**Fix.** The creator prices the project in a supported currency. Since
`20261007_146` that currency is always the creator's payout currency
([`AGR-008`](#agr-008--agreement-or-payment-not-in-the-creators-currency)),
and onboarding refuses an unsupported payout currency, so the two rules agree. Adding a currency means a migration row plus both code copies, and, for
any currency beyond CAD/USD, clearing the tax gate first
([`../payments/tax.md`](../payments/tax.md)).

**Money impact.** None.

---

## `AGR-008` — Agreement or payment not in the creator's currency

```yaml
id: AGR-008
tier: 2
signals:
  - source: db
    match: "/AGR-008: A project agreement must be priced in the creator's payout currency \\([A-Z]{3}\\), not [A-Z]{3}\\./"
    where: "public.enforce_listing_request_agreement_currency() (20261007_146), errcode check_violation"
  - source: db
    match: "/AGR-008: A payment must be in its agreement's currency \\([A-Z]{3}\\), not [A-Z]{3}\\./"
    where: "public.enforce_listing_request_schedule_item_currency() (20261007_146), errcode check_violation"
auto_fix: none
reason_not_automatable: "the page passes the right currency; seeing this means a stale page or a defect"
escalate_with:
  - "the creator's creator_payment_accounts.default_currency"
  - "the currency the agreement or payment was sent with"
  - "which screen produced it"
```

**Cause.** A project agreement must be in the creator's payout currency, and
every payment in an agreement must be in that agreement's currency. The
agreement form takes the currency from the creator's payout account, so a
creator should never see this. Until 2026-10-07 the form sent CAD for every
creator and nothing checked it: a US or Irish creator's agreement would have
been written in Canadian dollars. A creator on a page loaded before that fix
will hit this message; reloading clears it. Anything else producing it is a
defect in whatever built the agreement, change order or schedule item.

A creator with no payout account is not checked by this rule (other gates,
`CON-007`, decide whether paid work can start).

**Fix.** Reload and send again. If it persists, escalate with the values above.

**Money impact.** None: the write is refused, so nothing is created in the
wrong currency. Before the fix, the risk was a charge in a currency the
creator's account does not settle in.

---

## `AGR-007` — Acceptance refused without the early-start request

```yaml
id: AGR-007
tier: 2
signals:
  - source: db
    match: "Confirm that you want the creator to start work before any cancellation period ends, then accept the agreement."
auto_fix: none
reason_not_automatable: "the request is the buyer's own act; nobody may give it for them"
escalate_with:
  - "the agreement id and listing_request_id"
  - "policy_acceptances rows for the buyer with policy_type = 'early_service_request' and that listing_request_id"
```

**Cause.** Since `20260923_138`, accepting an agreement requires the buyer's
express request that work start before any EU/UK 14-day cancellation period ends
(Refund Policy §1, `launch-scope.md` §1.5). The buyer ticks a separate box below
the acknowledgements. `respond_listing_request_agreement` receives the Refund
Policy version as `p_early_service_request_version`, writes the
`early_service_request` row to `policy_acceptances` in the same transaction, and
refuses acceptance without it. The old three-argument signature was dropped, and
trigger `listing_request_agreements_require_early_start_request` refuses any
other route to `buyer_accepted` without that row.

**What the user sees.** The accept button stays disabled until the box is
ticked. The message itself appears only if something calls the RPC without the
version. After the deploy, the likely cause is an old cached web build.

**Fix.** The buyer ticks the box and accepts. **Never insert the row for them.**
As with `AGR-003`, a consent the buyer did not give is worse than none, because
it looks like evidence. If a buyer does not want work to start early, the honest
answer is that the project cannot start until the 14 days have passed, and the
product does not support that yet: escalate rather than work around it.

**Checkout.** The same request stays in checkout's gate, at the current Refund
Policy version. If the Refund Policy changes after acceptance, checkout asks for
it again; otherwise the box does not reappear there.

**Money impact.** None at acceptance. Later it decides whether the earned-value
refund rules can be relied on for an EU/UK consumer.

---

## Fee estimates are maximums

The agreement summary shows the estimated Made for Stream fees for the schedule
(`getMaximumAgreementFeeAmount`: 5% of each item rounded up to the cent, then
summed, with waived and cancelled items excluded). It is labelled a **maximum**
because the rate is locked at acceptance as a ceiling (below). If a user says the
estimate was wrong, check whether they were charged *more* than it: that would be
a defect. Being charged less is a waiver working as intended.

---

## Fee rates are locked when the buyer accepts

`20260921_117` stamps the fee rates in force onto the agreement at the moment the
buyer accepts it, in `buyer_service_fee_bps`, `creator_platform_fee_bps`, their
`_reason` columns and `fee_rates_locked_at`.

**Those rates are a ceiling, not a fixed price.** Every payment created from the
agreement's schedule is charged the *lower* of the locked rate and the rate in
force when the payment is created. So:

- A waiver that has **lapsed** since acceptance does not raise what the buyer
  pays. Repricing an accepted schedule is what Fee Schedule §8 forbids.
- A waiver granted **after** acceptance does lower later instalments.

**When diagnosing a fee a user disputes**, read the rate from the *payment*, not
the agreement — the payment records what was actually charged and why. The
agreement records only the ceiling.

**Agreements accepted before `20260921_117`** have null rate columns. The bridge
falls back to the current resolved rate for those, which is the standard 5%.

---

## `cancelled` is now a reachable agreement status

`20260922_122` and `20260922_124` are the first migrations that actually
write `listing_request_agreements.status = 'cancelled'` — the value existed
in the check constraint since `20260524_069` but nothing set it before
Sprint 4. See [`cancellation.md`](cancellation.md) for both paths. The
domain layer (`src/domain/listings/requestWorkspace.ts`) already treated a
cancelled agreement as "no active agreement" before this sprint (the
`create-agreement` next step falls through to it); that fallback is now
reachable in practice rather than dead code, and it is correct — a cancelled
request has no next agreement to create.

## Two schema gaps closed in Sprint 4

**`usage_rights_type` / `usage_rights_qualifier`** (`20260922_123`,
launch-scope.md §5.3): what the buyer keeps a licence to when a payment's
earned value is retained. The columns exist and are nullable on every
agreement, **but no RPC or UI writes them yet** — `create_listing_request_agreement`
was not extended in this pass. Every agreement's usage rights are therefore
`null` today, not just ones from before this migration. A support question
about usage rights has no stored answer on any agreement until the
agreement builder is extended to set them; fall back to `scope_summary` /
`additional_cost_policy`'s free text and the conversation history.

**`included_revision_count` is now nullable** (`20260922_123`,
launch-scope.md §5.4): `null` means "not stated," and the product applies
Refund Policy §5's two-round fallback. **A stored `0` was never touched by
this migration** — it stays exactly what it was, which means a `0` on an
agreement from before this migration is still ambiguous between "explicitly
zero revisions" and "the old default that meant nothing." Do not assume
either reading without checking the agreement's `created_at` against
`20260922_123`'s date.

---

## Known gaps

- **Change orders modify agreed terms** but the interaction between an amended
  agreement and already-created schedule items is not documented here. See
  [`change-orders.md`](change-orders.md).
- **No agreement versioning documented** for support purposes — if terms change,
  which version a dispute is argued from is not written down anywhere.
- **Amounts are converted with a hardcoded `* 100`**, which is correct for CAD and
  USD and wrong for any currency with a different minor-unit convention. Such an
  agreement passes these checks and produces a wrong or rejected charge later —
  see [`PAY-004`](../payments/checkout.md#pay-004--payment-amount-or-fee-setup-is-invalid).
  The fee *minimums* that used to compound this were removed in `20260921_117`.


