---
feature: requests/cancellation-warnings
status: active
surfaces:
  - public.listing_request_cancellation_warnings
  - public.send_listing_request_cancellation_warning()
  - public.withdraw_listing_request_cancellation_warning()
  - public.close_expired_listing_request_cancellation_warnings()
  - public.stop_listing_request_cancellation_warning()        # the one place a warning is answered
  - public.stop_cancellation_warning_on_activity()            # triggers on seven project tables
  - public.notify_conversation_message()                      # a chat reply answers an open warning
  - src/domain/legal/refundPolicy.ts                          # section 7, version 2026-10-07
  - public.listing_request_closures.cancellation_warning_id
  - public.listing_request_closure_refund_items
  - supabase/migrations/20261007_149_add_presence_message_emails_and_cancellation_warnings.sql
  - api/server.js                                             # POST /api/internal/ops/alerts/run, refundFlaggedAmountsForListingRequest
  - src/components/listingRequests/core/CancellationWarningPanel.tsx
  - src/hooks/creatorRequests/useListingRequestCancellationWarnings.ts
unmatched_tier: 2
---

# Cancellation Warnings — Support Playbook

Either side of an active commission can send a **cancellation warning** when
the other has gone quiet. The sender says what they need and picks **7, 10 or
14 days**. The recipient is emailed at once and again two days before the end.
**The recipient stops the timer in either of two ways: by doing something in
the project, or by sending any reply in the commission's chat.** No message is
needed if they act. Acting means paying a payment that is due, accepting or
declining an agreement or change order, approving work or asking for a
revision, submitting a milestone or delivery, or posting a progress update.
Both sides see a note in the chat, the sender is emailed
(`cancellation_warning_answered`), and the commission carries on. If the timer
runs out with neither, the commission is cancelled automatically by the hourly
job, within about an hour of the deadline.

**Nothing is ever cancelled unless a person started a warning.** A commission
where both sides are simply inactive stays open. The sender can withdraw a
running warning at any time. One warning can run per commission at a time.

## What happens to money (decided 2026-10-07)

| Who did not reply | Already paid | Not yet paid |
| --- | --- | --- |
| The buyer | Stays with the creator, deposits included | Cancelled |
| The creator | Payments for milestones the buyer approved stay with the creator. Anything else paid (a deposit, a prepayment) is refunded for the share of milestones not reached: all of it when no milestone was approved, or when the agreement has no milestones | Cancelled |

The database fixes the refund amounts in `listing_request_closure_refund_items`
when it cancels. The API then pays them through the same refund code as every
other refund (`refundFlaggedAmountsForListingRequest`).

Today an agreement has either a deposit or milestones, never both, so in
practice: a deposit agreement refunds the whole deposit when the creator
abandons it, and a milestone agreement refunds nothing (only approved
milestones were ever paid).

**The Refund Policy says the same** since version `2026-10-07` (section 7,
with one sentence each changed in sections 2 and 6). Buyers accept that
version at their next checkout. The older notice process still exists beside
this one ([`REQ-003`](request-lifecycle.md#req-003--unresponsive-participant))
and the policy describes both. The wording has not been checked by a lawyer;
see Known gaps.

## Quick triage

| Symptom | Likely issue |
| --- | --- |
| "It won't let me send a warning" | [`WARN-001`](#warn-001--warning-refused-bad-input), [`WARN-002`](#warn-002--warning-refused-wrong-state) |
| "I paid / accepted and the timer is still running" | [`WARN-005`](#warn-005--taking-a-step-did-not-stop-the-timer) |
| "I replied and it still cancelled" / "it cancelled and I never knew" | [`WARN-003`](#warn-003--a-commission-was-cancelled-and-the-recipient-objects) |
| "The deadline passed and nothing happened" | [`WARN-003`](#warn-003--a-commission-was-cancelled-and-the-recipient-objects), the hourly job |
| "It was cancelled but I have not had my refund" | [`WARN-004`](#warn-004--automatic-refund-not-made) |

---

## `WARN-001` — Warning refused: bad input

```yaml
id: WARN-001
tier: 2
signals:
  - source: db
    match: "WARN-001: Choose 7, 10 or 14 days for the other person to respond."
  - source: db
    match: "WARN-001: Say what you need from the other person, in 10 to 1000 characters."
auto_fix: none
reason_not_automatable: "the person has to re-enter the form"
```

**Cause.** The form sent a number of days other than 7, 10 or 14, or a
message shorter than 10 or longer than 1000 characters. The site's form
prevents both, so a hit usually means an old page or a direct call.

**Fix.** Reload and send again. **Money impact.** None.

---

## `WARN-002` — Warning refused: wrong state

```yaml
id: WARN-002
tier: 2
signals:
  - source: db
    match: "WARN-002: A cancellation warning can only be sent on an active commission."
  - source: db
    match: "WARN-002: A cancellation warning is already running on this commission."
  - source: db
    match: "WARN-002: This cancellation warning is not yours to withdraw, or is no longer running."
auto_fix: none
reason_not_automatable: "the guard is correct"
```

**Cause.** The commission is not accepted (still a request, or already
completed or cancelled); or a warning is already running, from either side;
or someone other than the sender tried to withdraw, or it had already ended.

**Fix.** Explain which applies. To see the state:

```sql
select status, sender_user_id, recipient_user_id, response_days, sent_at, expires_at, answered_at
from public.listing_request_cancellation_warnings
where listing_request_id = '<request>' order by sent_at;
```

**Money impact.** None.

---

## `WARN-003` — A commission was cancelled and the recipient objects

```yaml
id: WARN-003
tier: 2
signals:
  - source: user_report
    match: "my commission was cancelled by a warning and I did reply / never saw it"
  - source: api
    match: "/WARN-003: expired cancellation warnings were not processed: /"
    where: "api/server.js POST /api/internal/ops/alerts/run"
  - source: db
    match: "listing_request_cancellation_warnings.status = 'cancelled_request'"
auto_fix: none
reason_not_automatable: "a cancelled commission cannot be reopened; what to do next is a person's decision"
escalate_with:
  - "the warning row, and the closure row with cancellation_warning_id set"
  - "every non-system message the recipient sent in that conversation after sent_at"
  - "the cancellation_warning and cancellation_warning_reminder rows in listing_request_notifications, with email_status"
```

**Cause.** Two things count as a response, from the recipient, after the
warning was sent: a message in that commission's chat that is not automatic,
or a step in the project (see the top of this page). Messaging somewhere else
does not count. If either exists and the commission was still cancelled, that
is a defect: escalate to Tier 3 (and see `WARN-005`).

The API log line means the hourly job could not run the cancellation step
(usually migration `20261007_149` not applied). Nothing is cancelled while it
fails; expired warnings are processed on the next good run.

**What the user sees.** The commission is closed, with an automatic message
in the chat saying why.

**Fix.** Check the two emails were sent (`email_status = 'sent'`). If they
failed, the recipient had no fair warning, which matters for how you treat the
complaint. **A cancelled commission cannot be reopened.** The buyer can send a
new commission request; any refund beyond the automatic one is made from
`/admin/requests/:id`.

**Money impact.** Whatever the table above produced. A buyer who did not
reply keeps no claim on a deposit under this rule.

---

## `WARN-004` — Automatic refund not made

```yaml
id: WARN-004
tier: 2
signals:
  - source: api
    match: "/WARN-004: refund(s failed| not made) for /"
    where: "api/server.js POST /api/internal/ops/alerts/run"
  - source: db
    match: "listing_request_closure_refund_items.refunded_at is null, for a closure with cancellation_warning_id set, flagged over 2 hours ago"
auto_fix: none
reason_not_automatable: "money movement; the Stripe error decides what to do"
escalate_with:
  - "the WARN-004 log line, which carries Stripe's reason"
  - "the refund item: payment_id, unearned_amount_cents"
```

**Cause.** The database cancelled the commission and fixed a refund amount,
but Stripe refused the refund or the API stopped first. The item stays flagged.

**Fix.** The hourly job only tries at the moment of cancellation. Afterwards,
either participant opening the commission page retries it, or issue it by
hand from `/admin/requests/:id`'s refund panel for exactly
`unearned_amount_cents`. Same underlying causes as
[`CAN-006`](cancellation.md#can-006--accepted-cancellations-flagged-refund-never-applied).

**Money impact.** The buyer is owed the flagged amount until it is paid.

---

## `WARN-005` — Taking a step did not stop the timer

```yaml
id: WARN-005
tier: 2
signals:
  - source: db
    match: "/WARN-005: could not stop a cancellation warning for request /"
    where: "public.stop_cancellation_warning_on_activity (a Postgres warning)"
  - source: user_report
    match: "I paid or accepted and the cancellation warning is still showing"
auto_fix: none
reason_not_automatable: "either expected behaviour to explain, or a defect"
escalate_with:
  - "the warning row and what the recipient did, with times"
  - "the WARN-005 text from the database log, if any"
```

**Cause.** Usually expected: the step was taken by the **sender**, not the
recipient (only the recipient's actions count); or it was not a project step
(opening the checkout page without paying, reading the page). A payment
counts when it turns `paid`, which is a few seconds after Stripe confirms it.
The Postgres warning means the trigger itself failed; the payment or step
still went through.

**Fix.** If the recipient really did act and the warning is still `open`,
tell them to send any chat message, which also stops it, and treat it as a
defect. A support agent must not edit the warning row by hand to cancel or
extend a timer; the sender can withdraw it.

**Money impact.** None, unless the timer then runs out wrongly (`WARN-003`).

---

## Known gaps

- **The Refund Policy wording is a first draft.** Section 7 of version
  `2026-10-07` describes all of this, but no lawyer has read it. The rule that
  a silent buyer does not get a deposit back needs checking against EU and UK
  consumer law before anything is public.
- **Two processes exist side by side**: this one and the older non-response
  notices, with different money outcomes. Decide whether to remove the older
  one.
- **The refund share uses milestones only.** A creator who did real work on a
  deposit agreement and then went silent still refunds the whole deposit.
- **No gate on when a warning can be sent.** Either side can start one at any
  time on an active commission; the 7 to 14 days are the protection.
- **Cancellation happens up to an hour after the deadline**, when the hourly
  job next runs.
