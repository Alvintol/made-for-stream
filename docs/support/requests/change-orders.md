---
feature: requests/change-orders
status: active
surfaces:
  - public.listing_request_change_orders
  - supabase/migrations/20260608_085_respond_listing_request_change_order_rpc.sql
  - supabase/migrations/20260608_086_create_change_order_payment_on_acceptance.sql
  - supabase/migrations/20261012_155_add_change_order_withdrawal_and_future_date.sql
  - public.withdraw_listing_request_change_order
  - public.enforce_listing_request_change_order_completion_date
  - src/components/listingRequests/changeOrders/ListingRequestChangeOrderCreatorActions.tsx
  - src/components/listingRequests/changeOrders/ListingRequestChangeOrderBuilder.tsx
  - src/lib/errorMessage.ts
  - supabase/migrations/20261012_158_let_change_orders_lower_remaining_payments.sql
  - public.check_listing_request_change_order_reduction
  - public.handle_listing_request_change_order_reduction
unmatched_tier: 2
---

# Change Orders — Support Playbook

A change order amends an accepted agreement: scope, price, or timeline. The buyer
accepts or declines, and acceptance of a price increase creates a new payment.

Change orders are where an agreed record gets rewritten, so the integrity
question here is: **after the change, does the record still show what both
parties actually agreed, and does the money still add up?**

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't send a change order" | [`CHG-001`](#chg-001--change-order-content-rejected), [`CHG-002`](#chg-002--request-not-ready-for-a-change-order) |
| "It says nothing changed" | [`CHG-001`](#chg-001--change-order-content-rejected) |
| "Buyer accepted but no payment appeared" | [`CHG-003`](#chg-003--accepted-change-order-did-not-create-its-payment) |
| "The new price isn't reflected" | [`CHG-003`](#chg-003--accepted-change-order-did-not-create-its-payment) |
| "It won't take my completion date" | [`CHG-005`](#chg-005--revised-completion-date-is-not-in-the-future) |
| "I gave a discount and the buyer is still asked for the old amount" / "It won't let me lower the price" | [`CHG-007`](#chg-007--lowering-the-price-after-part-of-it-is-paid) |
| "I sent a change order by mistake" / "I can't withdraw it" | [`CHG-006`](#chg-006--withdrawing-a-change-order) |
| "It just says it could not be created, with no reason" | Fixed 2026-10-12: screens used to drop the database's message and show a generic line. Ask for a reload; the real reason now shows. |

---

## `CHG-001` — Change order content rejected

```yaml
id: CHG-001
tier: 2
signals:
  - source: db
    match: "A change order must change at least one project term."
  - source: db
    match: "Change order title must be between 3 and 160 characters."
  - source: db
    match: "Change order summary must be between 10 and 4000 characters."
  - source: db
    match: "A revised total amount is required for a price change."
  - source: db
    match: "A revised completion date is required for a timeline change."
  - source: db
    match: "This timeline change does not include a revised completion date."
  - source: db
    match: "Change order response reason cannot exceed 2000 characters."
auto_fix: none
reason_not_automatable: "user input correction"
```

**Cause.** Validation. The most common is a change order that declares a price or
timeline change without supplying the new value — usually a partly-filled form.

**What the user sees.** A rejected change order, often mid-negotiation when the
creator is trying to respond quickly to a buyer request.

**Fix.** Complete the missing field. "Must change at least one term" means the
change order is identical to the current agreement — there is nothing to accept.

**Money impact.** None yet.

---

## Change orders and the instalment floor

A change order that raises the price becomes its own payment when the buyer
accepts it (`20260608_086`). Since `20260923_138` that increase must be at least
10.00 in the project's currency, checked **when the creator sends it** (trigger
`listing_request_change_orders_enforce_instalment`) so the creator sees the
refusal rather than the buyer. The message and fix are
[`AGR-005`](agreements.md#agr-005--a-payment-is-below-the-instalment-floor). A
change order with no price increase is never checked.

---

## `CHG-002` — Request not ready for a change order

```yaml
id: CHG-002
tier: 2
signals:
  - source: db
    match: "This request is not ready for a change order."
  - source: db
    match: "Change order status must be draft or sent."
  - source: db
    match: "Change order response must be buyer_accepted or buyer_declined."
  - source: db
    match: "This change order is not available for your response."   # already answered, or withdrawn by the creator first (CHG-006)
  - source: db
    match: "This agreement already has a pending change order."      # one open change order per agreement
auto_fix: none
reason_not_automatable: "sequencing guard"
```

**Cause.** A change order needs an accepted agreement to amend. Attempting one
before the buyer has accepted, or on a completed request, is refused.

**Fix.** Establish the agreement first. See
[`request-lifecycle.md`](request-lifecycle.md) `REQ-001` for walking back to the
first incomplete step.

**Money impact.** None.

---

## `CHG-003` — Accepted change order did not create its payment

```yaml
id: CHG-003
tier: 2
signals:
  - source: db
    match: "change order status = 'buyer_accepted' with no corresponding listing_request_payments row"
    where: public.listing_request_change_orders
auto_fix: none
reason_not_automatable: "creating a payment record is originating financial state"
escalate_with:
  - "the change order id, revised total, and acceptance timestamp"
  - "existing payments for the request"
  - "whether the agreement total was updated"
```

**Cause.** Acceptance of a price-increasing change order should create a
change-order payment. If the acceptance wrote but the payment creation did not,
the agreement says one thing and the payment records another.

**What the user sees.** A change order marked accepted, an updated scope, and no
way to pay the difference. Work may proceed on the expectation of a payment that
was never requested.

**Fix.** Manual. **The agent may not create the payment record** — that is
originating payment state, which is on the forbidden list.

Establish first whether the agreement total was updated, since that determines
whether the record is merely incomplete or actively inconsistent.

**Money impact.** Direct. The creator may deliver expanded scope with no
mechanism to be paid for it.

**Query.** The payment is created in two hops, so both are checked:

```sql
select co.id, co.listing_request_id, co.price_delta, co.buyer_accepted_at
from public.listing_request_change_orders co
where co.status = 'buyer_accepted'
  and co.changes_price
  and co.price_delta > 0
  and not exists (
    select 1
    from public.listing_request_payment_schedule_items si
    join public.listing_request_payments p on p.payment_schedule_item_id = si.id
    where si.change_order_id = co.id
  );
```

Alerted hourly since Sprint 9: `list_ops_alerts()` emails ops as `change_order_payment_missing` (CHG-003), once, then daily while it stays open. See [`operations/alerting.md`](../operations/alerting.md).

---

## `CHG-004` — Change-order payment confirmation restricted

```yaml
id: CHG-004
tier: 2
signals:
  - source: db
    match: "Only an administrator can confirm a change-order payment."
  - source: db
    match: "You must be signed in to confirm a change-order payment."
auto_fix: none
reason_not_automatable: "manual confirmation is break-glass, not the production path"
escalate_with:
  - "why the automated path did not apply the payment"
```

**Cause.** The admin manual-confirmation fallback was attempted.

**Same caution as milestones.** The production path is the Stripe webhook.
Routine use of manual confirmation means the automated path is broken, and
confirming by hand marks money as received without verifying it moved. See
[`milestones.md`](milestones.md) `MIL-004`.

**Money impact.** Manual confirmation can release work against an unpaid change
order.

---

## `CHG-005` — Revised completion date is not in the future

```yaml
id: CHG-005
tier: 2
signals:
  - source: db
    match: "The revised completion date must be in the future."
    where: "public.enforce_listing_request_change_order_completion_date (20261012_155), errcode 22023"
  - source: ui
    match: "The revised completion date must be in the future."
    where: "ListingRequestChangeOrderBuilder; the date box also refuses anything before tomorrow"
auto_fix: none
reason_not_automatable: "the creator has to choose a real date"
```

**Cause.** A change order that changes the timeline named a completion date
that has already passed. Before `20261012_155` this was accepted, and one such
change order was sent in the rehearsal (23 days in the past). The check runs
when a change order is drafted or sent. It does not run when the buyer
answers or the creator withdraws, so a change order written before the
migration can still be closed either way. A date earlier than the current
completion date is fine, as long as it is still ahead.

**Fix.** Choose a date from tomorrow onwards.

**Money impact.** None.

---

## `CHG-006` — Withdrawing a change order

```yaml
id: CHG-006
tier: 2
signals:
  - source: db
    match: "This change order can no longer be withdrawn. The buyer may already have answered it."
    where: "public.withdraw_listing_request_change_order (20261012_155), errcode P0001"
  - source: db
    match: "You must be signed in to withdraw a change order."
    where: "public.withdraw_listing_request_change_order, errcode 42501"
  - source: user_report
    match: "I got an email about a change order and there is nothing to answer"
auto_fix: none
reason_not_automatable: "the refusal is correct; the buyer got there first, or it is not the caller's change order"
escalate_with:
  - "the change order's status, sent_at, cancelled_at, buyer_accepted_at and buyer_declined_at"
```

**How it works.** The creator can withdraw their own change order while it is
a draft or is waiting for the buyer ("Withdraw change order" under Change
order actions). It becomes `cancelled` with `cancelled_at` set and stays in
the history. The "waiting for the buyer's answer" hold ends, so milestone
submissions and other steps are no longer blocked. If it had been sent, the
commission chat gets a line saying it was withdrawn. There is no separate
edit: to change a change order the creator withdraws it and proposes a new
one, and the form starts from the withdrawn one's details.

**When both sides act at once.** Accepting, declining, sending and
withdrawing each lock the change order's row and check its status before
changing anything, so the first one to arrive wins and the other is refused
with one of the messages here or "This change order is not available for your
response." (`CHG-002`). Nothing is overwritten. An answer always names one
change order, and a corrected change order is a new row, so a buyer on a
stale page can never accept terms they were not shown: their Accept is
refused with the reason, and a notice at the bottom of the page offers
**Reload page**. The page is not reloaded for them (that would discard what
they were typing); after reloading, the corrected one appears with a fresh
panel. The refusal is also logged
([`OPS-006`](../operations/alerting.md#ops-006--yesterdays-failures-on-the-site)).
Only one change order can be open on an agreement at a time ("This agreement
already has a pending change order.").

**Cause, by signal.**
- "Can no longer be withdrawn": the buyer accepted or declined first, it was
  already withdrawn (two tabs), or the caller is not its creator. If the buyer
  accepted, the change stands; a further change order is the way to undo it.
- The buyer's report: they were emailed when it was sent, and **no email is
  sent when it is withdrawn**. They find it marked "Cancelled" and a chat
  line explaining. That is expected.

**Money impact.** None. A withdrawn change order never created a payment: the
payment is only created when the buyer accepts.

---

## `CHG-007` — Lowering the price after part of it is paid

```yaml
id: CHG-007
tier: 2
signals:
  - source: db
    match: "A lower total must say what each remaining payment becomes."
    where: "public.check_listing_request_change_order_reduction (20261012_158), errcode 22023"
  - source: db
    match: "/The remaining payments must add up to the new total: [0-9.]+ already paid or due plus [0-9.]+ remaining is [0-9.]+, not [0-9.]+\\./"
    where: "public.check_listing_request_change_order_reduction, errcode 22023"
  - source: db
    match: "A change order can only lower payments that are not yet due."
    where: "public.check_listing_request_change_order_reduction, errcode P0001"
  - source: db
    match: "A lower total cannot raise a remaining payment."
    where: "public.check_listing_request_change_order_reduction, errcode 22023"
  - source: db
    match: "Enter an amount for every remaining payment."
    where: "public.check_listing_request_change_order_reduction, errcode 22023"
  - source: db
    match: "Nothing is left to pay on this project, so a change order cannot lower its price. Money already paid can only be returned as a refund."
    where: "public.check_listing_request_change_order_reduction, errcode P0001"
  - source: db
    match: "The payment plan changed after this change order was sent, so it can no longer be accepted as written. Ask the creator to withdraw it and send a new one."
    where: "public.handle_listing_request_change_order_reduction, when the buyer accepts; errcode P0001"
  - source: ui
    match: "/The remaining payments must add up to .+\\. They add up to .+\\./"
    where: "ListingRequestChangeOrderBuilder, before anything is sent"
auto_fix: none
reason_not_automatable: "the creator decides how a discount is spread; nobody may rewrite agreed amounts for them"
escalate_if:
  - "an agreement's total_amount does not equal the sum of its payment schedule (not cancelled or waived)"   # -> tier 3, the books do not add up
escalate_with:
  - "the agreement's total_amount, and every payment schedule item with its amount and status"
  - "the change order's revised_total_amount and proposed_snapshot -> 'revised_payment_amounts'"
```

**The rule.** A change order that lowers the total must say what every
payment that is not yet due becomes, and

    paid or due  +  the new remaining payments  =  the new total.

- Only payments still `pending` can be lowered. One that is due or paid is
  fixed.
- No remaining payment may go up, and each must still be at least the
  instalment floor ([`AGR-005`](agreements.md#agr-005--a-payment-is-below-the-instalment-floor)).
- The total cannot go below what is already paid or due plus the floor for
  each remaining payment. **Money already paid is never returned by a change
  order**; that is a refund ([`refunds-and-disputes.md`](../payments/refunds-and-disputes.md)).
- If nothing is left to pay, the price cannot be lowered this way at all.

**How it works.** On the creator's form, entering a total lower than the
current one opens "Remaining payments": one box per payment not yet due,
starting at its current amount, with the sum they must reach. The database
checks the same sums when the change order is drafted or sent and keeps its
own copy of the list (each payment's real title and current amount), which
is what the buyer sees: "Payment: Colour, 40.00 becomes 15.00". When the
buyer accepts, it checks again and then changes the amount on the payment
schedule, the milestone and the agreement line together with the total. The
fee on each later payment is worked out from its new, lower amount. A price
**increase** is unchanged: a separate payment for the difference
(`CHG-003`).

**Cause, by signal.**
- "Must add up" / "must say what each remaining payment becomes": the split
  is missing or wrong. The form catches this first; from the database it
  means a hand-made request or a stale page.
- "Can only lower payments that are not yet due": the plan names a payment
  that is due or paid, or one that became due after the page was opened.
- "The payment plan changed after this change order was sent": between
  sending and the buyer's Accept, one of the remaining payments became due
  (a milestone was approved) or was paid. The buyer cannot accept it; the
  creator withdraws it ([`CHG-006`](#chg-006--withdrawing-a-change-order))
  and sends a new one against the plan as it now stands.

**Before `20261012_158`.** Accepting a lower total changed `total_amount`
and nothing else, so the remaining payments kept their old amounts and the
buyer would have gone on paying the old price. One agreement in the
rehearsal was left that way (total 90.00, payment schedule 115.00) and
needed a one-off correction. If an older agreement shows a total lower than
its schedule, that is this; correct the unpaid amounts with the creator's
agreement, never the paid ones.

**Money impact.** Direct. Before the fix the buyer was over-asked by the
amount of the discount. After it, a wrong split is refused rather than
applied.

---

## Known gaps

- **Nothing alerts when an agreement's total and its payment schedule
  disagree.** `CHG-007` now keeps them equal for discounts, but there is no
  standing check that would catch a new way of breaking them.
- **A payment that is already due cannot be discounted.** Once a milestone
  is approved its payment is fixed; a discount on it is a refund after it is
  paid.
- **The buyer is not emailed when a change order is withdrawn.** They were
  emailed when it was sent, so an email can lead to a change order that is no
  longer there to answer. The commission chat says what happened.
- **"Cancelled" does not say who cancelled.** A change order withdrawn by the
  creator and one closed because the whole commission was cancelled look the
  same in the list.
- **A price increase is its own payment, not spread over the milestones.**
  The milestone amounts stay as agreed and the difference is paid at once
  (`CHG-003`); a price decrease lowers the unpaid milestones (`CHG-007`).
  Either way the schedule adds up to the total.
- **`CHG-003` alerting runs through `list_ops_alerts()`** (Sprint 9), which
  reports an accepted price-increasing change order with no schedule item or no
  payment 15 minutes after acceptance. The detail says which is missing
  (`has_schedule_item`).
- **Declined change orders** have no documented effect on the project's state.
- **No versioned view of terms over time**, so which version applied when is not
  reconstructable for a dispute.
