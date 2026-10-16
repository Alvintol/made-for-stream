---
feature: requests/final-delivery
status: active
surfaces:
  - public.listing_request_final_deliveries
  - supabase/migrations/20260609_088_create_listing_request_final_delivery_foundation.sql
  - supabase/migrations/20260619_107_enforce_final_delivery_approval_readiness.sql
  - supabase/migrations/20260619_108_enforce_final_delivery_creation_readiness.sql
  - supabase/migrations/20260611_093_complete_request_after_final_delivery_approval.sql
  - supabase/migrations/20261013_162_add_off_site_delivery_record.sql
  - public.create_listing_request_final_delivery_off_site
  - src/components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder.tsx
unmatched_tier: 2
---

# Final Delivery — Support Playbook

Final delivery closes the project. The creator submits the finished work, the
buyer approves it or requests a revision, and approval completes the request and
closes its conversations.

Several readiness guards protect this step: there must be an accepted agreement,
milestone payments must be configured and confirmed, and outstanding payments
must be resolved before a delivery can be created or approved.

Those guards are the reason this playbook matters. **Approval is the point of no
return** — it completes the request and releases the final balance. A delivery
approved while payments are outstanding means work handed over that was not paid
for, and there is no refund or reversal path to undo it.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't submit the final delivery" | [`FIN-001`](#fin-001--delivery-blocked-by-outstanding-payments) |
| "The buyer can't approve it" | [`FIN-001`](#fin-001--delivery-blocked-by-outstanding-payments) |
| "I can't submit a new delivery" | [`FIN-002`](#fin-002--previous-delivery-not-resolved) |
| "Approved but the project isn't complete" | [`FIN-004`](#fin-004--approved-delivery-did-not-complete-the-request) |
| "My delivery was rejected on content" | [`FIN-003`](#fin-003--delivery-content-rejected) |
| "I ticked Provided off site and it would not submit" / "They say they sent it by email and I never got it" | [`MIL-007`](milestones.md#mil-007--work-sent-outside-the-site-provided-off-site) (the same record is used for milestones and final deliveries) |

---

## `FIN-001` — Delivery blocked by outstanding payments

```yaml
id: FIN-001
tier: 2
signals:
  - source: db
    match: "Outstanding project payments must be resolved before final delivery."
  - source: db
    match: "All milestone payments must be confirmed before final delivery can be created."
  - source: db
    match: "All milestone payments must be confirmed before final delivery can be approved."
  - source: db
    match: "Milestone payments must be configured before final delivery can be created."
  - source: db
    match: "Milestone payments must be configured before final delivery can be approved."
  - source: db
    match: "A buyer-accepted project agreement is required before final delivery can be created."
  - source: db
    match: "A buyer-accepted project agreement is required before final delivery can be approved."
auto_fix: none
reason_not_automatable: "the guard protects unpaid work; never bypass it"
escalate_with:
  - "every payment for the request with its status"
  - "which specific payment is unresolved"
  - "whether that payment is genuinely unpaid or merely unrecorded"
```

**Cause.** A payment is not in a resolved state. The critical distinction:

- **Genuinely unpaid** — the guard is correct and doing its job.
- **Paid but unrecorded** — the money arrived and the webhook did not land it.
  This is [`WHK-001`](../payments/webhooks.md#whk-001--transient-failure-processing-a-received-event)
  or [`PAY-005`](../payments/checkout.md#pay-005--payment-stuck-in-checkout_opened-or-processing)
  presenting itself here instead.

**Always check the second case first.** It is the more common one and it has a
safe automated fix upstream. Resolving it there clears this error without
touching the delivery at all.

**What the user sees.** A creator unable to deliver finished work, or a buyer
unable to approve work they have received — both convinced they have already paid
or been paid.

**Fix.** Resolve the payment record properly. **Never bypass the guard.** It is
the last thing standing between a creator and handing over work for free.

**Money impact.** This guard is protecting it. Bypassing it means delivering
unpaid work with no reversal path.

---

## `FIN-002` — Previous delivery not resolved

```yaml
id: FIN-002
tier: 2
signals:
  - source: db
    match: "A new final delivery can only be created after the previous delivery is revised or cancelled."
  - source: db
    match: "Only submitted final deliveries can be approved."
  - source: db
    match: "Final delivery status must be draft or submitted."
auto_fix: none
reason_not_automatable: "sequencing guard"
```

**Cause.** An existing delivery is still open. Only one can be live at a time.

**What the user sees.** A creator who wants to send an updated version and
cannot, often after a buyer asked for a change verbally rather than through the
revision flow.

**Fix.** Resolve the existing delivery first — the buyer requests a revision, or
it is cancelled.

**Money impact.** None. Completion is delayed.

---

## `FIN-003` — Delivery content rejected

```yaml
id: FIN-003
tier: 2
signals:
  - source: db
    match: "Final delivery title must be between 3 and 160 characters."
  - source: db
    match: "Final delivery summary must be between 10 and 4000 characters."
  - source: db
    match: "A final delivery can contain no more than 20 delivery links."
  - source: db
    match: "Each final delivery link must be 2000 characters or fewer."
  - source: db
    match: "Final delivery response must be revision_requested or buyer_approved."
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "the 20-link limit is hit repeatedly"
```

**Cause.** Validation on delivery content.

**Fix.** Adjust the content. As with milestones, a repeatedly-hit link limit
suggests the limit is wrong rather than the creators — a full asset pack can
reasonably exceed 20 files.

**Money impact.** None. Delivery is delayed at the final step, which is the worst
moment for it.

---

## `FIN-004` — Approved delivery did not complete the request

```yaml
id: FIN-004
tier: 1
signals:
  - source: db
    match: "final delivery status = 'buyer_approved' AND the request is not completed"
    where: public.listing_request_final_deliveries
auto_fix: reapply_payment_workflow
params:
  listing_request_payment_id: "$.final_balance_payment_id"
verify:
  - "the request status is completed"
  - "the request's conversations are closed"
retry_limit: 2
escalate_if:
  - "there is no final balance payment to reapply"
  - "the cascade raises a readiness or constraint error"   # -> tier 3
```

**Cause.** Approval should complete the request and close its conversations. If
the cascade after the final balance payment did not finish, the delivery shows
approved and the request stays open.

**What the user sees.** Both parties believe the project is done, and it will not
close. The creator may be waiting on it for payout expectations.

**Fix.** Re-run the cascade, same as
[`WHK-002`](../payments/webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance).

**If the cascade raises a readiness error**, the guards consider the request
inconsistent — Tier 3, do not retry.

**Money impact.** The final balance may be paid with the project not recorded as
complete.

---

## Known gaps

- **No reversal after approval.** Approval completes the request and there is no
  documented path back. If a buyer approves in error, or the delivered work turns
  out to be wrong, the only remedy is a refund — and no refund path exists. See
  [`refunds-and-disputes.md`](../payments/refunds-and-disputes.md).
- **A buyer who never responds to a delivery** now has a documented, implemented
  path — the creator sends a non-response notice, waits 7+7 days, then requests
  administrative closure. See [`request-lifecycle.md`](request-lifecycle.md)
  `REQ-003`. Not automatic: an admin has to act, and closure cancels the
  unfinished delivery rather than treating it as approved.
- **There is no file upload for finished work.** Delivery is by links to
  wherever the creator keeps the files, plus the optional record of work
  sent off site (`MIL-007`). The site never holds the finished files.
- **Delivery links are not verified.** Nothing checks that a link resolves, so a
  dead or revoked link is indistinguishable from a good one at approval time.
- **No alerting for `FIN-004`.**
