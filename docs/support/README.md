# Made for Stream Support Playbooks

Every feature ships with a playbook describing how to support it. A feature is
not done when the code merges — it is done when someone (or something) on call
can diagnose and resolve its known failures without reverse-engineering the
source.

These documents are dual-purpose:

- **For people.** When something breaks, the playbook is the first thing to open.
- **For the support agent.** The machine-readable block under each issue is the
  agent's instruction set. The agent matches a live signal against these blocks
  and acts only on what is documented here.

There is one source of truth. If the fix lives only in someone's head, or only
in a chat thread, it does not exist.

---

## The tier model

Every issue is classified into one of three tiers. The tier decides who acts.

### Tier 1 — Automated resolution

A **known** failure with a **documented, idempotent** fix. The agent matches the
signal, runs the whitelisted action, verifies the result, and logs it. Nobody is
woken up.

An issue qualifies for Tier 1 only when all of these hold:

- The signal match is unambiguous — it cannot collide with a different cause.
- The fix is one of the whitelisted actions in [`agent-contract.md`](agent-contract.md).
- The fix is idempotent: running it twice is the same as running it once.
- Success is machine-verifiable.
- Failure is safe: if the fix does not work, nothing is worse than before.

If any of those fail, it is not Tier 1. Write it as Tier 2.

### Tier 2 — Assisted triage

An **unknown or undocumented** failure, or a known one whose fix is not safely
automatable. The agent does **not** act. It packages context and escalates.

The escalation package is defined in [`agent-contract.md`](agent-contract.md) and
always includes: the raw signal, the affected records, what the agent ruled out,
the nearest matching playbook entries, and a proposed fix the agent is *not*
applying.

Tier 2 is the default for anything unrecognised. Silence is never the answer —
an unmatched signal is always escalated, never dropped.

**Every Tier 2 resolution ends by writing the issue into its playbook.** That is
how Tier 2 becomes Tier 1 and the on-call load goes down over time. An incident
that is fixed but not documented is an incident that will happen again.

### Tier 3 — Incident

Multiple users affected, or security, or data integrity. The agent stops trying
to fix anything and runs [`incident-response.md`](incident-response.md): notify,
contain, communicate.

Tier 3 is triggered by impact, not by cause. A Tier 1 issue that hits eight
accounts in ten minutes is a Tier 3 incident, and the agent must escalate it as
one even though it knows the fix.

Automatic Tier 3 triggers are listed in [`agent-contract.md`](agent-contract.md);
they include auth/authorization failures, payment identity mismatches, webhook
signature failures, and any data-integrity constraint violation.

---

## Writing a playbook

Copy [`TEMPLATE.md`](TEMPLATE.md). One playbook per feature area, named after the
feature, filed in the matching directory.

Each playbook has file-level frontmatter describing the feature and its
surfaces, then one section per known issue. Each issue carries a fenced `yaml`
block with the machine fields, followed by prose for the human reading it at
2am.

Ground every issue in a real failure path — an actual `raise exception` message,
an actual thrown error, an actual constraint. Do not invent failure modes that
the code cannot produce. If you cannot point at the line that produces the
signal, you are guessing, and the agent will match on a string that never
appears.

### Issue IDs

`<AREA>-<NNN>`, stable forever. Never renumber, never reuse. If an issue stops
being possible, mark it `status: retired` and leave it in place — old logs and
old escalations still reference the ID.

---

## Definition of done, for any feature

A feature branch is not ready to merge until:

1. Its playbook exists, or the existing one is updated.
2. Every failure path the change introduces is either documented as an issue or
   deliberately recorded as `tier: 2` with a note saying why it is not
   automatable.
3. Any new auto-fix action is added to the whitelist in
   [`agent-contract.md`](agent-contract.md) **and** `agent.config.yaml`, with its
   idempotency argument written down.
4. The playbook's `surfaces` list points at the real files and tables.

This applies to upgrades as much as to new features. Changing a workflow changes
how it fails.

---

## Contents

| Area | Playbook |
| --- | --- |
| System | [`agent-contract.md`](agent-contract.md) — what the agent may and may not do |
| System | [`incident-response.md`](incident-response.md) — the Tier 3 procedure |
| System | [`TEMPLATE.md`](TEMPLATE.md) — copy this for a new feature |
| Auth | [`auth/sign-in.md`](auth/sign-in.md) |
| Auth | [`auth/twitch-linking.md`](auth/twitch-linking.md) |
| Profiles | [`profiles/profiles-and-media.md`](profiles/profiles-and-media.md) |
| Creators | [`creators/applications.md`](creators/applications.md) |
| Listings | [`listings/listings.md`](listings/listings.md) |
| Requests | [`requests/request-lifecycle.md`](requests/request-lifecycle.md) |
| Requests | [`requests/agreements.md`](requests/agreements.md) |
| Requests | [`requests/milestones.md`](requests/milestones.md) |
| Requests | [`requests/change-orders.md`](requests/change-orders.md) |
| Requests | [`requests/final-delivery.md`](requests/final-delivery.md) |
| Requests | [`requests/cancellation.md`](requests/cancellation.md) |
| Messaging | [`messaging/conversations.md`](messaging/conversations.md) |
| Messaging | [`messaging/moderation.md`](messaging/moderation.md) |
| Messaging | [`messaging/transactional-email.md`](messaging/transactional-email.md) |
| Messaging | [`messaging/commission-notifications.md`](messaging/commission-notifications.md) |
| Requests | [`requests/cancellation-warnings.md`](requests/cancellation-warnings.md) |
| Payments | [`payments/checkout.md`](payments/checkout.md) |
| Payments | [`payments/webhooks.md`](payments/webhooks.md) |
| Payments | [`payments/connect-onboarding.md`](payments/connect-onboarding.md) |
| Payments | [`payments/refunds-and-disputes.md`](payments/refunds-and-disputes.md) |
| Payments | [`payments/creator-recovery-balances.md`](payments/creator-recovery-balances.md) |
| Payments | [`payments/tax.md`](payments/tax.md) |
| Payments | [`payments/display-currency.md`](payments/display-currency.md) |
| Discovery | [`discovery/twitch-live.md`](discovery/twitch-live.md) |
| Operations | [`operations/alerting.md`](operations/alerting.md) — scheduled jobs and ops alerts |

Several playbooks record gaps that were product decisions rather than support
problems — cancellation, refunds, abandonment, currency scope. **Those decisions are
now made**, in [`../launch-scope.md`](../launch-scope.md), and sequenced in
[`../launch-implementation-checklist.md`](../launch-implementation-checklist.md).

What remains in those playbooks is the **implementation** gap, which is different
and worth keeping straight: a playbook describes the product as it behaves today, so
an entry still saying "handle by hand" is correct until the sprint lands. Where a
rule now exists to handle it by hand *consistently*, the entry says so and cites it.
When one is built, the playbook entry is rewritten in the same branch.

---

## Status of the agent

**The support agent is not running.** It is specified here and configured in
`agent.config.yaml`, but it is deliberately dormant until Made for Stream deploys to
production. Nothing in this directory consumes tokens or touches infrastructure
while the product is still being built.

What exists today is the contract it will run under. Writing the playbooks first
is the point: the agent is only ever as good as what is documented here, so the
documentation leads and the automation follows.
