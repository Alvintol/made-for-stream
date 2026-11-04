---
feature: payments/refunds-and-disputes
status: active
surfaces:
  - public.listing_request_payments                          # stripe_charge_id, stripe_application_fee_id, stripe_refund_id, stripe_dispute_id, refunded_at, disputed_at, status (now derived)
  - public.listing_request_payment_refunds                    # the refund ledger
  - public.apply_refunded_listing_request_payment()
  - public.derive_listing_request_payment_refund_status()
  - api/server.js                                             # POST /api/stripe/refunds, markListingRequestPaymentPaidFromCheckoutSession, recordChargeRefundedFromWebhook, refundStrayPaymentOnCancelledRequest
  - api/refundArithmetic.js
  - src/pages/admin/AdminPaymentIssues.tsx                    # /admin/payment-issues
  - src/hooks/admin/useAdminPaymentIssues.ts
  - src/components/listingRequests/payments/ListingRequestPaymentAdminRefundPanel.tsx  # on AdminRequestDetails.tsx
  - src/hooks/admin/useAdminIssueListingRequestPaymentRefund.ts
unmatched_tier: 2
---

# Refunds and Disputes — Support Playbook

Sprint 5 (`../../launch-scope.md` section 6) built the refund engine this
playbook used to say did not exist. `status` is now **derived** from an
immutable ledger (`listing_request_payment_refunds`) rather than written
directly, so `refunded` / `partially_refunded` cannot drift from what Stripe
actually did — read `status` on its own again; the "read the new columns
instead of status" advice below is historical, describing the Sprint 3 gap
this sprint closed.

**Where to issue a refund.** `/admin/requests/:id`'s Payments section, once
the payment is `paid` or `partially_refunded` — not `/admin/payment-issues`,
which only lists payments Stripe has *already* recorded a refund or dispute
against. The refund route (`POST /api/stripe/refunds`) computes the
cumulative proportional buyer-fee refund and creator-fee reversal itself
(section 6.2), refunds the buyer's share from the charge, and separately
reverses the fee share via the Stripe Application Fee Refunds API — not
`refund_application_fee: true`'s automatic ratio, which is computed against
the whole charge amount (including any tip or contribution) rather than
against the base amount the way section 6.2's cumulative arithmetic is. See
the comment above the route in `api/server.js` for the full reasoning.

**A refund issued by hand in Stripe still reconciles.** `charge.refunded`
now calls the same `apply_refunded_listing_request_payment` RPC
(`initiated_via = 'webhook_external'`), attributing the entire Stripe refund
amount to the base (there is no stored intent to split it against, unlike an
admin-route refund whose split is already known and written synchronously
before the webhook ever arrives). Spot-check an externally-issued refund's
ledger row against Stripe directly before trusting its fee split.

**Refunds also return tax (Sprint 7).** Tax on the refunded lines goes back
with the refund and is reversed on the platform's Stripe Tax transaction. An
externally issued refund gets no Stripe Tax reversal, so handle it as
[`TAX-004`](tax.md#tax-004--refund-tax-not-reversed-or-ledger-mismatch).

## What exists and what does not

**The database is ready.** `listing_request_payments` already has
`refunded`, `partially_refunded` and `disputed` statuses in its check
constraint, plus `stripe_refund_id`, `stripe_dispute_id`, `refunded_at` and
`disputed_at` columns.

**The charge handle is now populated.** `stripe_charge_id` and
`stripe_application_fee_id` are set on the paid path
(`markListingRequestPaymentPaidFromCheckoutSession`), fetched live from the
PaymentIntent's expanded `latest_charge` rather than trusted from the webhook
payload (Stripe does not put either id on the Checkout Session or PaymentIntent
object directly). A payment that reached `paid` before this shipped, and never
got backfilled, is still missing both — see Known gaps.

**`charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` are
now recorded, not ignored.** Each writes the relevant Stripe id and timestamp
onto the payment row it belongs to (matched by `stripe_charge_id`, falling back
to the `creatorhub_payment_id` metadata Stripe copies from the PaymentIntent to
the Charge — the fallback exists because a refund event can arrive before
`checkout.session.completed` has had a chance to record `stripe_charge_id` at
all; Stripe does not guarantee event order). None of the three writes `status`.
That is deliberate, not an oversight: `refunded` / `partially_refunded` are
meant to be *derived* from a real refund ledger (launch-scope.md §6.2), and
writing status directly now from a single nullable `stripe_refund_id` would
build the exact "cannot represent a partial refund" trap that section warns
against. The ledger, the RPCs that write it, and the status derivation are
still Sprint 5 work.

## What this means operationally, today

A refund issued by hand in the Stripe dashboard **is now visible in
Made for Stream**, in `stripe_refund_id` and `refunded_at` on the payment row —
but the payment's `status` still reads `paid`. The request still behaves as
though the money is fully there, because nothing downstream of `status` knows
otherwise yet.

That divergence — a payment provably refunded per its own columns, while
`status = 'paid'` and the workflow keeps treating it that way — is now the
actual risk, replacing the older "no trace at all" one. It is smaller (there is
a real, queryable trace) but not gone.

**The same is true for disputes**, now via `stripe_dispute_id` and
`disputed_at`. A dispute opened against the creator's connected account is
recorded on the payment; the project workflow still runs as though nothing
happened, because closing collection or freezing work on a disputed payment is
also Sprint 5 scope (launch-scope.md §13, "Dispute opened").

## Rules

- **The agent may never call `POST /api/stripe/refunds` or issue a refund in
  the Stripe dashboard.** Money movement is always human. The route exists so
  an admin can act quickly through the app, not so it can be automated.
- **The agent may never hand-write `status`, `stripe_refund_id` or
  `refunded_at` on `listing_request_payments`, nor insert directly into
  `listing_request_payment_refunds`.** The only sanctioned write path is
  `apply_refunded_listing_request_payment`, called by the admin route or by
  the `charge.refunded` webhook. It is on the forbidden list in
  [`agent-contract.md`](../agent-contract.md).
- Every refund and dispute is **Tier 2 minimum**, and Tier 3 if more than one
  buyer is involved.

---

## `REF-001` — Refund requested by a buyer

```yaml
id: REF-001
tier: 2
signals:
  - source: user_report
    match: "buyer requests a refund"
auto_fix: none
reason_not_automatable: "money movement is always human, even with a working refund route"
escalate_with:
  - "payment id, amount, currency, payment_type"
  - "the request's current workflow stage and what was delivered"
  - "the creator's connected account id"
  - "whether the work is partially complete"
```

**Cause.** Cancellation, dissatisfaction, non-delivery, or mutual agreement.

**Fix.** An admin opens `/admin/requests/:id`, finds the payment in the
Payments section, and issues the refund there. The route
(`POST /api/stripe/refunds`, `useAdminIssueListingRequestPaymentRefund`)
applies Refund Policy §8 automatically — the admin only chooses the base
amount to refund and states a reason:

- **Buyer service fee** — refunded in the same proportion as the base,
  computed cumulatively against everything already refunded on this payment.
- **Creator platform fee** — reversed in the same proportion, via the Stripe
  Application Fee Refunds API. Made for Stream absorbs this.
- **Partial delivery** — earned value per Refund Policy §4 is the admin's own
  judgement call, same as always; the route does not decide *how much* base
  to refund, only what happens to the fees once that figure is chosen.
- Minimums are **not** recalculated on the remaining balance, and there is no
  refund administration fee.
- **Tips and contributions** are separate fields on the same form, never
  auto-prorated on a partial refund (Refund Policy §8) — see
  `docs/support/payments/creator-recovery-balances.md`'s sibling notes on the
  14-day window, or just leave them at 0 for an ordinary partial refund.

**If the connected account's balance cannot cover the refund**, the route
tops it up from the platform's own Stripe balance and opens a **creator
recovery balance** instead of failing — see
[`creator-recovery-balances.md`](creator-recovery-balances.md). This is
automatic; no separate step is needed.

**Money impact.** Direct, and now recorded exactly — `listing_request_payment_refunds`
is the permanent record; nothing needs to be written down elsewhere.

---

## `REF-002` — Refund issued in Stripe, not reflected in Made for Stream

```yaml
id: REF-002
tier: 2
signals:
  - source: db
    where: public.listing_request_payments
    match: "stripe_refund_id is not null AND status = 'paid'"
auto_fix: none
reason_not_automatable: "the fee/tip/contribution split for an externally-issued refund is a best-effort attribution, not a known figure -- worth a human glance"
escalate_with:
  - "the refund amount and whether it was full or partial (read from Stripe using stripe_charge_id)"
  - "the ledger row apply_refunded_listing_request_payment wrote (public.listing_request_payment_refunds where payment_id = ...), specifically initiated_via and the base/fee split"
  - "the request's current stage"
```

**Cause.** Someone refunded in Stripe directly rather than through
`/admin/requests/:id`. The `charge.refunded` webhook now reconciles this
automatically — `status` derives correctly and a ledger row is written with
`initiated_via = 'webhook_external'`. This signal firing at all (`status`
still `paid` with a `stripe_refund_id` set) means the webhook's own call to
`apply_refunded_listing_request_payment` failed; check the API logs for the
`charge.refunded: apply_refunded_listing_request_payment failed` line.

**What still needs a human glance even when it worked.** An externally-issued
refund has no stored intent to split against, so the webhook attributes the
**entire** Stripe refund amount to `base_refund_cents` — it cannot know that
some of it was actually a tip, a contribution, or fee. Spot-check the ledger
row's split against what was actually refunded in Stripe before trusting it
for reporting.

**Detection.** Check `/admin/payment-issues` (filter: Refunded) first — it's
the same query below as a page. Direct SQL, for anything the UI doesn't show:

```sql
select id, listing_request_id, payment_type, status,
       stripe_charge_id, stripe_refund_id, refunded_at
from public.listing_request_payments
where stripe_refund_id is not null
  and status = 'paid'
order by refunded_at desc;
```

A payment that reached `paid` **before** the charge-id work shipped and was
refunded before that has no `stripe_charge_id` to match against, so it will
not show up here — see Known gaps.

**Fix.** First check the API logs for why the webhook's own call to
`apply_refunded_listing_request_payment` failed (the query above should
essentially never return rows if the webhook is healthy). Once the cause is
fixed, replay it by hand:

```sql
select public.apply_refunded_listing_request_payment(
  p_payment_id := '<payment id>',
  p_base_refund_cents := <the Stripe refund's amount, in cents>,
  p_stripe_refund_id := '<the Stripe refund id>',
  p_reason := 'Manually reconciled after webhook failure.',
  p_initiated_via := 'webhook_external'
);
```

It is idempotent on `stripe_refund_id`, so re-running it is safe. **Never**
hand-write `status`, `stripe_refund_id` or `refunded_at` directly — that
bypasses the ledger and is exactly the drift this feature exists to prevent.

**Money impact.** Already moved. The exposure is the wrong record, which affects
what the request lets both parties do next.

---

## `REF-003` — Dispute opened against a creator

```yaml
id: REF-003
tier: 3
signals:
  - source: db
    where: public.listing_request_payments
    match: "stripe_dispute_id is not null AND disputed_at > now() - interval '1 hour'"
  - source: stripe
    match: "dispute opened on a connected account"
auto_fix: none
reason_not_automatable: "financial and legal exposure"
escalate_with:
  - "dispute amount, reason code, and evidence deadline"
  - "the full request history: agreement, milestones, deliveries, messages"
  - "whether the creator has other disputes"
```

**Cause.** A buyer went to their bank instead of to us. Often that means the
in-product resolution path failed them, which is worth understanding separately
from the dispute itself.

**Detection.** Check `/admin/payment-issues` (filter: Disputed) first. Direct
SQL, for anything the UI doesn't show — `stripe_dispute_id` and `disputed_at`
are now recorded by the webhook the moment `charge.dispute.created` arrives,
this is no longer only discoverable in Stripe directly:

```sql
select id, listing_request_id, payment_type, creator_user_id,
       stripe_charge_id, stripe_dispute_id, disputed_at
from public.listing_request_payments
where stripe_dispute_id is not null
order by disputed_at desc;
```

**Why Tier 3 regardless of count.** Disputes carry deadlines, fees, and
consequences for the creator's account standing. A missed evidence deadline is an
automatic loss. There is no version of this that waits.

**Fix.** Manual and time-critical:

1. Note the evidence deadline immediately. It is short.
2. Gather the record — this is exactly what Made for Stream is for. The agreement,
   the buyer's acceptance, the delivery, the messages. That evidence is the
   product's core value proposition, and a dispute is where it proves out.
3. Tell the creator. It is their account and their money.
4. Decide whether to contest, with the creator.

**Money impact.** The disputed amount plus a dispute fee, debited from the
creator's account. If they lose, they are out both.

---

## `REF-004` — Dispute resolved

```yaml
id: REF-004
tier: 2
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "event_type = 'charge.dispute.closed' AND processing_status = 'processed'"
auto_fix: none
reason_not_automatable: "no write path; outcome determines the request's fate"
escalate_with:
  - "the outcome (won/lost) and final amount, read live from Stripe using stripe_dispute_id"
  - "the request's state and whether it should now be cancelled or completed"
```

**Detection.** `charge.dispute.closed` is now recorded — the event id lands in
the payment's `stripe_event_ids`, so a repeat delivery does not reprocess it.
Since V0.16.05 (migration 187) a **lost** dispute also sets the payment's
`dispute_lost_at`. Won and warning-closed disputes leave it empty. The rest of
the outcome (the final amount, any fees) is still read live from Stripe with the
payment's `stripe_dispute_id`.

**What a lost chargeback does to sales.** `sale_movements()` adds a
`chargeback` movement on the day it was lost. It takes off everything of the
payment not already refunded: price, tip, both fees, the contribution and the
GST/HST in them, worked out the same way as a refund. So the creator's sales
list, earnings, graphs and tax estimates, and Admin → Sales, drop it in the
month it was lost. The row is labelled "Chargeback lost". The original sale
still shows in its own month, as a refund would leave it. Nothing else changes.
The project, milestones and payment status stay as they are. If the creator
was already paid out, recovering that money is still the creator recovery
balance process (see `creator-recovery-balances.md`).

Limits:
- It takes the whole unrefunded amount. Stripe can lose a dispute for less. If
  that happens, the figures overstate the loss. Check against Stripe, then
  raise it as a bug so the amount gets stored.
- A payment already fully refunded gets no chargeback row.
- A dispute lost before migration 187 was not recorded. To find one, look for
  payments with a `stripe_dispute_id` and an empty `dispute_lost_at`. Check
  each in Stripe. For a lost one, set `dispute_lost_at` to the date Stripe
  closed it. That's an owner data change, never done by an agent.

**Fix.** Manual. Sales now reflect a lost dispute, but the project's fate
(cancel, complete, recover a payout) is still decided by hand.

---

## What building this feature required

Recorded here for history. Items 1 and 2 shipped in Sprint 3 (2026-09-22);
the rest shipped in Sprint 5 (launch-scope.md section 6).

1. ~~**Populate `stripe_charge_id` and `stripe_application_fee_id`**~~ **Done**
   (Sprint 3). Fetched live from the PaymentIntent's expanded `latest_charge`
   in `markListingRequestPaymentPaidFromCheckoutSession` (`api/server.js`),
   with a self-healing backfill path (`backfillChargeDetailsForPayment`).
2. ~~**Handle `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`**~~
   **Done** (Sprint 3 recording only, Sprint 5 made `charge.refunded` a real
   reconciling write). `recordChargeRefundedFromWebhook` now calls
   `apply_refunded_listing_request_payment`; the dispute handlers still only
   record, per launch-scope.md section 6.1's "no automated dispute response."
3. ~~**Add `security definer` RPCs**~~ **Done.**
   `apply_refunded_listing_request_payment`
   (`supabase/migrations/20260922_125_add_listing_request_payment_refund_ledger.sql`),
   following the `apply_paid_listing_request_*` shape: writes one immutable
   ledger row, derives `status`, and cascades the request per section 6.7.
4. ~~**Implement the fee policy**~~ **Done.** Cumulative, proportional,
   rounded once against the cumulative figure, with a final refund returning
   the exact remainder rather than a third rounded ratio. Mirrored in JS in
   two places for testability without a live database:
   `api/refundArithmetic.js` (used by the admin route before calling Stripe)
   and `src/domain/payments/listingRequestPaymentRefunds.ts` (used by the
   admin UI preview) — both have their own vitest suites covering repeated
   partial refunds and the rounding remainder.
5. ~~**Decide what a refund does to the request**~~ **Done**, with one
   simplification worth knowing: rather than separately encoding each row of
   launch-scope.md section 6.7's table, `apply_refunded_listing_request_payment`
   uses one rule — a milestone payment being refunded at all cancels that
   milestone, and the request (with its agreement) is cancelled once no
   payment on it remains `paid`/`partially_refunded`, *unless* the request is
   already `completed` (never reverted). This covers every row of the table
   correctly but does not literally branch on "is this the starting payment"
   the way the table is laid out — read the function's comments if a refund's
   cascade effect looks surprising.
6. ~~**Add the first server-side tests**~~ **Done**, for the arithmetic
   (`api/tests/refundArithmetic.test.js`). The route itself (Stripe calls,
   admin auth) still has no integration test harness — `api/server.js` has no
   test harness at all yet, same gap AGENTS.md calls out generally.
7. ~~**Admin surface** for disputes and out-of-band refunds~~ **Done**
   (Sprint 3 for visibility). Sprint 5 added the actual refund action:
   `/admin/requests/:id`'s Payments section, not `/admin/payment-issues`
   (which still only lists payments with an *existing* dispute or refund).
8. **This playbook is updated** (this pass). Tier 2 entries stay Tier 2 —
   issuing and reconciling a refund both still require a human decision, even
   though the mechanism now works. What changed is that `REF-002`'s "escalate
   with" now points at a working replay command instead of "wait for Sprint
   5," and a whole new failure class (a blocked recovery balance) has its own
   playbook.

---

## Known gaps

- **No automated dispute response.** Launch scope (section 6.1) explicitly
  keeps this out — `REF-003`/`REF-004` are still entirely manual by design,
  not by omission.
- **`CAN-005`** (`docs/support/requests/cancellation.md`) — a Stripe checkout
  session completing after its request was already cancelled — is now closed
  by this same refund engine: `refundStrayPaymentOnCancelledRequest` in
  `api/server.js` fires automatically the moment such a payment is marked
  paid, refunding everything and never unlocking work. It shows up in the
  ledger as `initiated_via = 'system_auto_refund'`.
- **`CAN-004`** (a disputed cancellation statement) still has no formal
  "resolved" state — an admin's decision is now *actionable* (issue the
  agreed refund from `/admin/requests/:id`), but the
  `listing_request_cancellation_proposals` row stays `status = 'disputed'`
  forever even after that refund is issued. Recording the decision itself is
  still the same "outside the app" gap this playbook used to have for
  refunds generally.
- **An externally-issued refund's tip/fee split is a best-effort attribution**,
  not a known figure — see `REF-002`.
- **Dispute freezing/closing is still manual.** Recording that a dispute
  exists (`stripe_dispute_id`, `disputed_at`) is not the same as acting on
  one — freezing collection or closing a disputed request are still human
  decisions, by design (see "No automated dispute response" above).
- **No bulk backfill has been run** for `stripe_charge_id` on a `paid` row
  that predates that column and is never retried through a later webhook
  event. As of the last check there were zero `paid` rows in production (no
  live traffic yet), so there was nothing to backfill; re-check before this
  matters.
- Nothing alerts on a new refund, dispute, or recovery-balance entry; the
  detection queries above have to be run by hand until Sprint 6's
  staleness/alerting work covers them too.

The fee-refund policy — Refund Policy §8 and
[`../../launch-scope.md`](../../launch-scope.md) §6 — is now built exactly as
specified, not approximated. See
[`creator-recovery-balances.md`](creator-recovery-balances.md) for the
platform-funded-refund half of section 6 (6.5–6.6), which is its own
playbook rather than an extension of this one.
