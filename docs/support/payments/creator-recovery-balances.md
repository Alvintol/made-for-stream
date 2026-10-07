---
feature: payments/creator-recovery-balances
status: active
surfaces:
  - public.creator_recovery_balances
  - public.creator_recovery_entries
  - public.creator_recovery_settlement_payments
  - public.apply_creator_recovery_debit()
  - public.apply_creator_recovery_credit()
  - public.admin_write_off_creator_recovery_balance()
  - public.apply_listing_request_payment_recovery_instalment()
  - public.creator_has_outstanding_recovery_balance()
  - "listing requests buyer insert (RLS policy on public.listing_requests)"
  - api/server.js  # POST /api/stripe/refunds (top-up path), POST /api/stripe/recovery/settlement-session, apply_paid_creator_recovery_settlement webhook branch
  - src/components/settings/CreatorRecoveryBalanceSection.tsx
  - src/components/listingRequests/payments/CreatorRecoveryBalanceAdminPanel.tsx
  - src/pages/listings/RequestListing.tsx
unmatched_tier: 2
---

# Creator Recovery Balances — Support Playbook

Sprint 5 (`../../launch-scope.md` section 6.5–6.6). When a buyer refund
cannot be fully covered from a creator's held Stripe balance, Made for Stream
funds the shortfall immediately rather than making the buyer wait, and opens
a **recovery balance**: what that creator now owes the platform. While one is
outstanding, new buyer requests to that creator are blocked at the database
(the RLS policy itself, not just the UI), existing projects continue
normally, and the platform quietly diverts up to 50% of the creator's base on
each subsequent payment until it clears. Money is always involved here by
definition — every issue below has a real balance behind it.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "A buyer says they can't send me a request" / "My listing shows as available but requests fail" | [`REC-001`](#rec-001--creator-blocked-by-a-recovery-balance) |
| "Why did my payment come out lower than expected?" | [`REC-002`](#rec-002--payment-diverted-toward-a-recovery-balance) |
| "I tried to settle my balance by card and it didn't clear" | [`REC-003`](#rec-003--direct-settlement-did-not-clear-the-balance) |
| "This creator will never pay this back" (internal) | [`REC-004`](#rec-004--admin-write-off) |
| "Half my payment went to Made for Stream and I don't owe anything" | [`REC-005`](#rec-005--payment-diverted-with-no-balance-behind-it) |

---

## `REC-001` — Creator blocked by a recovery balance

```yaml
id: REC-001
tier: 2
signals:
  - source: db
    match: "new row violates row-level security policy for table \"listing_requests\""
  - source: client
    match: "Commission requests are paused for this creator"
auto_fix: none
reason_not_automatable: "the balance is real money owed; nothing here is a bug to clear"
escalate_with:
  - "public.creator_recovery_balances row for the creator (outstanding_cents, currency)"
  - "public.creator_recovery_entries for the creator, most recent first"
  - "the refund that opened the debit (creator_recovery_entries.related_refund_id -> listing_request_payment_refunds)"
```

**Cause.** `creator_has_outstanding_recovery_balance(creator_user_id)`
returns true, which the `listing requests buyer insert` RLS policy
(`20260922_128_block_new_requests_with_recovery_balance.sql`) checks
directly — this is the enforcement boundary, not a UI courtesy on top of it.
`RequestListing.tsx` shows the buyer a plain "Requests are paused for this
creator" message via the same boolean, deliberately without their financial
detail (launch-scope.md's own requirement).

**What the user sees.** A buyer sees the paused-requests message and cannot
submit. The creator sees the warning and settlement form in
`/settings` → Payouts (`CreatorRecoveryBalanceSection.tsx`) once their
balance is queried — nothing is hidden from the creator themselves, only from
buyers.

**Fix.** There usually isn't one to "fix" — this is the block working. Point
the creator at their own settings page: pay it off directly, or let it clear
automatically as it's diverted from their next payments (`REC-002`). Escalate
only if the balance looks wrong (e.g. debited twice for the same refund —
check `creator_recovery_entries.related_refund_id` for duplicates, which
would indicate `apply_refunded_listing_request_payment` or
`apply_creator_recovery_debit` was called more than once for the same
Stripe refund; both are idempotent by design, so this would be a real bug,
not an expected retry).

**Money impact.** None from this signal alone — it's a block, not a charge.
The money impact already happened when the debit was opened (see the related
refund).

---

## `REC-002` — Payment diverted toward a recovery balance

```yaml
id: REC-002
tier: 2
signals:
  - source: user_report
    match: "creator says a payment paid out less than the agreed amount"
  - source: db
    match: "listing_request_payments.recovery_instalment_cents > 0"
    where: "public.listing_request_payments"
auto_fix: none
reason_not_automatable: "the diversion is intended behaviour once a balance is outstanding; explaining it is the fix"
escalate_with:
  - "the payment's recovery_instalment_cents and recovery_instalment_applied_at"
  - "the creator's current creator_recovery_balances.outstanding_cents"
```

**Cause.** Section 6.6: recovery is capped at 50% of the base payment,
resolved fresh at both payment-creation time
(`ensure_listing_request_payment_for_schedule_item`) and again right before
Checkout opens (`recompute_listing_request_payment_amounts`), via
`resolve_listing_request_payment_recovery_instalment`. The instalment is
folded into `application_fee_cents`, not into what the buyer pays — the
buyer's total is unaffected; only what reaches the creator is reduced.
Applied to the creator's balance once, when the payment is marked paid
(`apply_listing_request_payment_recovery_instalment`, called from
`api/server.js` right after `applyPaidListingRequestPaymentWorkflow`), guarded
by `recovery_instalment_applied_at` so a webhook retry cannot double-apply it.

**What the user sees.** A creator whose payout is smaller than the agreed
price, with no obvious reason unless they already know about their balance.

**Fix.** Explain the mechanism and point them at `/settings` → Payouts, which
shows the current balance and entry history
(`creator_recovery_entries` — this payment's diversion shows as a `credit`
row with `related_payment_id` set to it). Confirm the arithmetic if asked:
the instalment should never exceed 50% of `base_amount_cents`, nor the
balance's `outstanding_cents` at the time. If it does, that's a real bug in
`resolve_listing_request_payment_recovery_instalment` — escalate to Tier 3.

**Money impact.** None beyond what already happened — the diversion is
correct behaviour, recorded on both sides (the payment row and the recovery
ledger).

---

## `REC-003` — Direct settlement did not clear the balance

```yaml
id: REC-003
tier: 2
signals:
  - source: db
    match: "creator_recovery_settlement_payments.status = 'paid' but creator_recovery_balances.outstanding_cents unchanged"
  - source: user_report
    match: "creator paid to settle their balance but it still shows as blocked"
auto_fix: none
reason_not_automatable: "money was captured; reconciling it is a webhook-health question, not a cleanup script"
escalate_with:
  - "the creator_recovery_settlement_payments row (status, stripe_checkout_session_id, paid_at)"
  - "whether checkout.session.completed for this session ever reached the webhook (check stripe_webhook_events / API logs)"
```

**Cause.** Settlement is a plain, non-Connect Stripe Checkout session on the
platform's own account (`POST /api/stripe/recovery/settlement-session`),
distinguished from an ordinary listing-request payment session by
`metadata.creatorhub_recovery_settlement_id`
(`getRecoverySettlementIdFromStripeObject` in `api/server.js`). If the
webhook never reaches `apply_paid_creator_recovery_settlement`, the
settlement row can be `paid` in Stripe's own record while the recovery
balance never actually credits.

**What the user sees.** The creator successfully completes Stripe Checkout
for the settlement but returns to `/settings?recovery_settlement=1` and the
balance still shows outstanding after a refresh.

**Fix.** Confirm the charge succeeded in Stripe (it is real money — the
settlement row's `stripe_checkout_session_id`). If it did and the balance
didn't move, replay the credit by hand:

```sql
select public.apply_paid_creator_recovery_settlement('<settlement id>');
```

It is idempotent (`status = 'paid'` short-circuits), so safe to re-run.

**Money impact.** Already moved. The creator is owed the credit regardless of
whether the automatic path applied it.

---

## `REC-004` — Admin write-off

```yaml
id: REC-004
tier: 2
signals:
  - source: user_report
    match: "internal request to write off a creator's recovery balance"
auto_fix: none
reason_not_automatable: "writing off real owed money is always a deliberate decision"
escalate_with:
  - "the creator_recovery_entries history for the creator -- has any of it actually been recovered, or is the whole thing stale"
  - "why it's considered unrecoverable (account closed, creator unreachable, etc.)"
```

**Cause.** Not a failure — this is the intended path for a balance that will
genuinely never be recovered (a creator who has left the platform, closed
their Stripe account, etc.).

**Fix.** `/admin/requests/:id` → the request's Payments section → the
creator recovery balance panel (`CreatorRecoveryBalanceAdminPanel.tsx`) if
the creator has an active request to view it from, or call
`admin_write_off_creator_recovery_balance(creator_user_id, reason)` directly.
It writes a `write_off` entry for the full outstanding amount and zeroes the
balance, which lifts the new-request block immediately (the same
"outstanding reaches zero" release path as a normal recovery, with no
separate status to fall out of sync).

**Money impact.** A deliberate loss, recorded permanently in
`creator_recovery_entries` (`entry_type = 'write_off'`, `actor_user_id` set
to the admin). Record the business reason in the write-off's `reason` field
itself — that is now the durable record, not a side channel.

---

## `REC-005` — Payment diverted with no balance behind it

```yaml
id: REC-005
tier: 3
signals:
  - source: db
    match: "listing_request_payments.recovery_instalment_cents > 0 for a creator with no creator_recovery_balances row"
    where: "public.listing_request_payments"
  - source: migration
    match: "REC-005: a creator with no recovery balance must have a zero recovery instalment."
    where: "supabase/migrations/20261007_147_fix_recovery_instalment_without_balance.sql"
auto_fix: none
reason_not_automatable: "money was kept from a creator who owed nothing; a person decides how it is returned"
escalate_with:
  - "the payment ids, their base_amount_cents and recovery_instalment_cents"
  - "whether each payment's status is paid"
```

**Cause.** Found in the launch rehearsal on 2026-10-07, before any payment
was taken. `resolve_listing_request_payment_recovery_instalment` used
`least(cap, outstanding)`; Postgres's `least()` ignores a missing value, so a
creator with **no** balance row got the 50% cap as their instalment. Half of
every payment's base was folded into `application_fee_cents`. Fixed in
`20261007_147`, which also carries a self-check that fails the migration if
the function ever returns non-zero for a creator with no balance.

**How to check.** This must return no rows:

```sql
select p.id, p.status, p.base_amount_cents, p.recovery_instalment_cents
from public.listing_request_payments p
where p.recovery_instalment_cents > 0
  and not exists (
    select 1 from public.creator_recovery_entries e
    where e.related_payment_id = p.id
  )
  and not exists (
    select 1 from public.creator_recovery_balances b
    where b.creator_user_id = p.creator_user_id
      and b.outstanding_cents > 0
  );
```

**Fix.** Confirm `20261007_147` is applied (the function body contains
`coalesce`). Unpaid rows correct themselves the next time checkout opens
(`recompute_listing_request_payment_amounts`). A **paid** row means the
creator was short-paid by `recovery_instalment_cents`: stop, treat it as an
incident, and return the money to the creator by hand.

**Money impact.** Up to 50% of the base of each affected paid payment, owed
to the creator. None occurred: no payment was taken while the defect existed.

---

## Known gaps

- **No admin list of all outstanding recovery balances.** The admin panel
  only surfaces a creator's balance from a request of theirs already open in
  `/admin/requests/:id` — there is no `/admin/recovery-balances` overview
  page. Find one by creator id via direct SQL
  (`select * from creator_recovery_balances where outstanding_cents > 0`)
  until such a page exists.
- **Creator Terms / Fee Schedule disclosure.** The recovery obligation is
  described in this playbook and in code comments, but the actual legal text
  in `src/domain/legal/creatorTerms.ts` / `paymentTerms.ts` has not been
  updated with the specific "recovery balance" mechanism and terminology —
  only the more general "a payout already received does not cancel the
  obligation" language predates this feature. Closing this is a launch
  blocker per the checklist item that named it and should happen before this
  path can actually fund a real refund in production.
- **No alerting on a new debit.** A recovery balance opening is exactly the
  kind of event that should page someone (it means a creator's held balance
  was insufficient, which launch-scope.md section 6.3 already frames as the
  exceptional case, not the routine one) — nothing does yet. Same gap as the
  refund/dispute columns in `refunds-and-disputes.md`, tracked for Sprint 6.
- **Settlement is single-currency per balance.** `creator_recovery_balances`
  stores one `currency`; a creator who somehow accrues balances in two
  currencies (not currently possible with CAD/USD-only launch scope, but
  worth knowing if the currency registry in launch-scope.md section 1.1
  ships later) is not modelled.
