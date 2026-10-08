---
feature: requests/request-lifecycle
status: active
surfaces:
  - public.listing_requests
  - public.listing_request_notices
  - public.listing_request_closures
  - public.listing_request_early_review_flags
  - src/domain/listings/requestWorkspace.ts
  - src/domain/listings/listingRequestNotices.ts
  - src/pages/buyer/ , src/pages/creator/ , src/pages/admin/
unmatched_tier: 2
---

# Request Lifecycle — Support Playbook

A request is the container for a commission. It carries a snapshot of the listing
as it was when the buyer asked, the conversation, the agreement, payments,
milestones, deliveries, and the final outcome.

The workflow is a strict sequence:

```
buyer request -> creator acceptance -> project agreement -> buyer acceptance
-> required payment -> work and progress -> revisions / change orders
-> final delivery -> completion
```

`cancelled` can terminate the sequence from `accepted` onward, once an
agreement exists — before or after payment, by two different mechanisms. See
[`cancellation.md`](cancellation.md).

Almost every "not ready for…" error in this family means **something upstream in
that sequence has not happened**. Diagnosing them is usually a matter of walking
backwards to the first incomplete step rather than investigating the step that
produced the error.

The workspace UI computes whose turn it is from
`src/domain/listings/requestWorkspace.ts`. When a user says the request is
stuck, that "Next step" card is the fastest way to see what the system thinks is
outstanding.

**What users call it.** Since 2026-10-07 the site and its emails say
**commission**, and **commission request** until the creator accepts. A user
who says "my commission is stuck" means a row in `listing_requests`. The
database, its error messages (the `match:` strings below), the web addresses
(`/requests/...`) and the policies still say "request".

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Nothing happens, it's stuck" | [`REQ-001`](#req-001--request-stuck-behind-an-unmet-precondition) |
| "I paid but it won't move on" | [`WHK-002`](../payments/webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance) |
| "The other party has gone quiet" | [`REQ-003`](#req-003--unresponsive-participant) |
| "I can't archive this" | [`REQ-002`](#req-002--action-attempted-by-the-wrong-party) |
| "My request was declined and the chat is gone" | [`REQ-004`](#req-004--conversation-missing-for-a-declined-request) |
| "I need to cancel this request" | [`cancellation.md`](cancellation.md) |
| "It won't accept my budget" | [`REQ-005`](#req-005--budget-not-accepted-on-the-request-form) |

---

## `REQ-001` — Request stuck behind an unmet precondition

```yaml
id: REQ-001
tier: 2
signals:
  - source: db
    match: "This request is not ready for a project agreement."
  - source: db
    match: "This request is not ready for agreement response."
  - source: db
    match: "This request is not ready for a change order."
  - source: db
    match: "Final delivery can only be created for an accepted request."
auto_fix: none
reason_not_automatable: "the guard is correct; forcing the stage would corrupt the workflow"
escalate_with:
  - "the request's current stage"
  - "the first incomplete step walking backwards from the attempted action"
  - "the Next step card's computed state for both parties"
```

**Cause.** An action was attempted out of order. Usually the UI offered it — a
stale page, or a state the workspace computed differently from the database.

**What the user sees.** A button that exists and then fails, which reads as the
product being broken rather than as them being early.

**Fix.** Identify the actual current stage and complete the missing upstream step.
**Never force the stage forward.** These guards exist because payments and
deliverables depend on the ordering, and stepping over one leaves money and work
records disagreeing.

**Worth watching.** Frequent hits mean the UI and the database disagree about
state. That is a bug in the workspace computation, not a support problem, and it
will keep generating tickets until it is fixed.

**Money impact.** None directly. The project is frozen.

---

## `REQ-002` — Action attempted by the wrong party

```yaml
id: REQ-002
tier: 2
signals:
  - source: db
    match: "/^You must be signed in to /"
  - source: db
    match: "/^Only (the creator|the buyer|an administrator|admins) /"
auto_fix: none
reason_not_automatable: "authorization boundary"
escalate_if:
  - "one user hitting these across several requests"   # -> tier 3, probing
escalate_with:
  - "the acting user id and their actual role on the request"
  - "count of similar denials from that user"
```

**Cause.** Either an expired session (the "must be signed in" variants) or
genuinely the wrong role attempting a role-restricted action.

**What the user sees.** For the session case, an action failing for no apparent
reason — see [`auth/sign-in.md`](../auth/sign-in.md) `AUTH-004`.

**Fix.** Re-authenticate, or clarify who is meant to act. The "Next step" card
shows whose turn it is.

**Escalate on patterns.** One person hitting role denials across multiple
requests is testing boundaries, not misclicking.

**Money impact.** None. These checks run at the database, so a UI bypass does not
get past them.

---

## `REQ-003` — Unresponsive participant

```yaml
id: REQ-003
tier: 2
signals:
  - source: user_report
    match: "the other party has stopped responding"
  - source: db
    match: "admin_list_stale_listing_requests_checked() returns the request"
    where: "public.admin_list_stale_listing_requests / admin_list_stale_listing_requests_checked (20260922_135)"
auto_fix: none
reason_not_automatable: "who closes and on what branch is an administrator's judgement call, not a mechanical match -- see launch-scope.md section 7's \"who closes\" note"
escalate_with:
  - "the request's notice history (public.listing_request_notices) -- notice_type, sent_at, expires_at, answered_at, email_status"
  - "which side sent the open notice, and whether a substantive (non-'system') conversation_messages reply exists after it"
  - "money already paid and its current state"
  - "what has been delivered so far"
```

**Cause.** A buyer who stopped responding to a delivery, or a creator who took a
deposit and went quiet.

Alerted hourly since Sprint 9: `list_ops_alerts()` emails ops as `stale_request` (REQ-003), once, then daily while it stays open. See [`operations/alerting.md`](../operations/alerting.md).

**What the user sees.** A project frozen indefinitely, often with money already
paid into it, and no way to end it on their own.

**Fix — Sprint 6 implemented the policy in full.** The 7+7 day notice clock and
administrative closure now run in the database, not by hand:

- Either party sends a **first notice** stating what they need
  (`send_listing_request_first_notice`,
  `supabase/migrations/20260922_131_add_listing_request_notices.sql`) — logged
  against the request and starting a server-side 7-day clock
  (`listing_request_notices.expires_at`).
- **7 calendar days** without a substantive reply, then the same party may send a
  **final notice** (`send_listing_request_final_notice`), granting **7 more**.
  The RPC refuses server-side if the first notice has not actually expired, or if
  a substantive reply was received — a message with `message_type <> 'system'`
  from the recipient (`listing_request_has_substantive_reply`). An automated
  acknowledgement (`message_type = 'system'`) never counts.
- After the final notice expires unanswered, the waiting party may ask for
  **administrative closure**. An admin runs
  `admin_close_listing_request_for_non_response`
  (`supabase/migrations/20260922_133_add_listing_request_administrative_closure.sql`)
  — it re-verifies every precondition itself (expired final notice, no
  substantive reply, or an approved early-review flag) rather than trusting the
  caller. **Neither party can close unilaterally** — the RPC is admin-only.
  - **Buyer unresponsive:** unfinished work cancels. Unearned prepaid amounts
    *remain refundable* through the ordinary admin refund route — not
    auto-issued, since there is no itemised earned-value statement the way
    Sprint 4's cancellation flow has.
  - **Creator unresponsive:** unfinished work cancels **and** every
    paid-but-unrefunded amount is flagged and refunded automatically, via
    Sprint 5's `apply_refunded_listing_request_payment` (drained by
    `POST /api/stripe/refunds/drain-flagged-for-request`, extended in Sprint 6
    to also read `listing_request_closure_refund_items`) — "a creator who
    retains payment must evidence earned value," and an unresponsive one has
    evidenced none.
  - Recorded as a `listing_request_closures` row: branch, reason, admin, and the
    notice or early-review flag it was based on. **Not a finding that the work
    delivered so far was satisfactory** (Refund Policy §6) — the system message
    posted on closure says so explicitly.
- **Early review** (`flag_listing_request_for_early_review` /
  `admin_decide_listing_request_early_review`,
  `20260922_132_add_listing_request_early_review_flags.sql`) lets either party
  skip the wait for a missed essential deadline, credible fraud, or the creator
  saying they cannot complete — but only by asking an admin to approve it, not by
  closing anything directly.

Sources: Refund Policy §7, [`../../launch-scope.md`](../../launch-scope.md) §7,
and [`../messaging/transactional-email.md`](../messaging/transactional-email.md)
for how each notice's delivery is tracked and what a failed send means for the
clock (short answer: the clock still runs — see that playbook's `EMAIL-004`).

**Escalate when:** the RPC refuses a closure the requester believes should be
allowed (check the notice history and substantive-reply signal above before
escalating further — it usually explains the refusal), or when a closure needs
overriding after the fact (there is no reversal path; see
[`../payments/refunds-and-disputes.md`](../payments/refunds-and-disputes.md) if
money needs to move afterward).

**Money impact.** Handled per branch above. A creator-unresponsive closure moves
real money (an automatic refund) — verify the drain route actually ran
(`listing_request_closure_refund_items.refunded_at`) rather than assuming the RPC
call alone moved it, the same caution as `CAN-006` in
[`cancellation.md`](cancellation.md) for the equivalent Sprint 4 drain.

---

## `REQ-004` — Conversation missing for a declined request

```yaml
id: REQ-004
tier: 2
signals:
  - source: db
    match: "Conversation not found for declined request."
auto_fix: none
reason_not_automatable: "data inconsistency; needs inspection before any write"
escalate_with:
  - "the request id and its status"
  - "whether a conversation row exists in any state"
```

**Cause.** A request was declined but the expected conversation is not there. The
decline flow assumes one exists.

**What the user sees.** A decline that errors, or a request with no visible
history of why.

**Fix.** Manual inspection. This is a data-consistency issue — if it recurs,
treat it as an integrity problem rather than a series of one-offs.

**Money impact.** None; declined requests have no payments.

---

## `REQ-005` — Budget not accepted on the request form

```yaml
id: REQ-005
tier: 2
signals:
  - source: client
    match: "Enter an amount such as 100, or a range such as 100-150. Put anything else about your budget in the details."
    where: "src/domain/listings/listingRequestForm.ts, parseListingRequestBudget"
  - source: db
    match: "/violates check constraint \"listing_requests_budget_amount(_max)?_check\"/"
    where: "public.listing_requests (20261008_151 for the _max constraint)"
  - source: db
    match: "/column \"?(listing_requests\\.)?budget_amount_max\"? does not exist|Could not find the 'budget_amount_max' column/"
    where: "any page that reads a commission, when migration 20261008_151 is not applied"
auto_fix: none
reason_not_automatable: "explanation, not a fault; a missing migration needs a person"
```

**Cause.** The optional budget is one amount or a range, in the listing's
currency. The form reads "100", "$1,250.50", "CAD 100", "100-150", "100 to
150" and "$100 – $150"; a range is saved as `budget_amount` (bottom) and
`budget_amount_max` (top, `20261008_151`). Anything it cannot be sure of
("around 100", "100 per emote") is refused with the message above instead of
guessing a number. While the budget is text it cannot read, the "Estimated
invoice" card beside the form keeps showing the listing price.

**What the user sees.** The message under the budget box, and the box focused.

**Fix.** Explain the two accepted shapes; anything else about the budget goes
in the details. The budget is information for the creator only: the price is
set in the agreement.

**If every commission page fails to load** with the "does not exist" signal,
the website was deployed before migration `20261008_151`. Apply the migration.

**Money impact.** None.

---

## Known gaps

- **No reversal path for an administrative closure.** `REQ-003`'s
  `admin_close_listing_request_for_non_response` is one-way — if it turns out to
  have been the wrong call (the "unresponsive" party actually replied but the
  message was missed, for example), there is no undo RPC. Treat it as a data-fix
  escalation, the same as any other terminal-status mistake.
- **No retry UI for a failed notice email** — see `EMAIL-001` in
  [`../messaging/transactional-email.md`](../messaging/transactional-email.md).
- **UI/database state disagreement** is the likely cause of most `REQ-001`
  reports and is not instrumented.
