---
feature: operations/pre-launch
status: active
surfaces:
  - supabase/migrations/20261110_193_add_pre_launch_payment_lock.sql
  - payments_are_live()                                 # the one switch; false until launch
  - refuse_listing_request_accept_before_launch()       # trigger listing_requests_refuse_accept_before_launch
  - refuse_checkout_before_launch()                     # trigger listing_request_payments_refuse_before_launch
  - assert_creator_ready_for_paid_work()                # agreements, change orders, instant purchases
  - enforce_listing_payment_account_readiness()         # publishing without payouts is allowed before launch
  - enforce_listing_request_creator_readiness()         # requests to creators without payouts are allowed before launch
  - api/server.js                                       # assertPaymentsLive: checkout, settlement, payout setup
  - src/hooks/site/usePaymentsLive.ts
  - src/components/app/LaunchBanner.tsx
  - src/components/app/PreLaunchDealNotice.tsx
  - src/domain/legal/termsOfService.ts                  # section 4, "Before launch"
unmatched_tier: 2
---

# Pre-launch mode — Support Playbook

Since 2026-11-10 (for TwitchCon), Made for Stream is open but nothing can be
paid. Payments aren't open because the legal documents haven't been reviewed
by a lawyer yet. People can browse, sign up, apply to be a creator, make
listings, send commission requests and chat. They can't accept a request,
send a project agreement, buy an instant download, open a checkout or set up
payouts. One database function, `payments_are_live()`, returns `false`. The
database rules, the API and the site all read it, so they can't disagree.

Since 2026-11-11 this is the public soft launch at `madeforstream.com`, on
its own prod database and API, open to sign-ups (`../../environments.md`).
Prod's API has no Stripe keys at all, so even a gap in this lock couldn't
reach Stripe: any Stripe route answers "Stripe prod secret key is not
configured." Dev keeps the same lock and Stripe's test mode.

Every page shows a banner saying payments aren't open yet. Commission pages
and chats show both people a notice that there's no date for their region,
and that any deal they make anyway is only between them (Terms section 4).

**Money impact.** None can move. If someone reports paying a creator, the
payment happened outside Made for Stream. See
[Reports of an off-site deal](#reports-of-an-off-site-deal).

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't accept this request" | [`LAUNCH-001`](#launch-001--request-cant-be-accepted-before-launch) |
| "I can't pay", "I can't buy this", "I can't set up payouts" | [`LAUNCH-002`](#launch-002--payment-refused-before-launch) |
| "I paid a creator and got nothing" | [Reports of an off-site deal](#reports-of-an-off-site-deal) |
| "When does my region open?" | No date yet. Don't give one. |

---

## `LAUNCH-001` — Request can't be accepted before launch

```yaml
id: LAUNCH-001
tier: 2
signals:
  - source: db
    match: "Requests can't be accepted yet. Made for Stream hasn't launched in any region, and there's no date yet for when it will."
    where: "trigger listing_requests_refuse_accept_before_launch (refuse_listing_request_accept_before_launch)"
auto_fix: none
reason_not_automatable: "working as designed until launch; opening it is a business decision"
escalate_with:
  - "whether payments_are_live() returns true (it should be false before launch)"
```

**Cause.** A creator tried to move a request from `submitted` to `accepted`.
Before launch that's refused, because accepting leads to an agreement and a
payment.

**What the user sees.** On the creator's request page the Accept button is
greyed out, with the note "Requests can't be accepted until payments open in
your region. You can still chat with the buyer." The database message above
only appears if something gets past the button.

**Manual fix.** None. Tell them requests open at launch and that there's no
date yet.

**Money impact.** None.

---

## `LAUNCH-002` — Payment refused before launch

```yaml
id: LAUNCH-002
tier: 2
signals:
  - source: db
    match: "Payments aren't open yet, so this can't go ahead. There's no date yet for when they will open in your region."
    where: "assert_creator_ready_for_paid_work() (agreement, change order, start_instant_purchase); trigger listing_request_payments_refuse_before_launch (checkout_opened)"
  - source: api
    match: "Payments aren't open yet, so this can't go ahead. There's no date yet for when they will open in your region."
    where: "POST /api/stripe/checkout/session, /api/stripe/recovery/settlement-session, /api/stripe/connect/account-session (assertPaymentsLive), answered 400"
auto_fix: none
reason_not_automatable: "working as designed until launch"
escalate_with:
  - "whether payments_are_live() returns true"
  - "if it returns true and the API still refuses: whether the API can call payments_are_live (it fails closed on any error)"
```

**Cause.** Something tried to start paid work or move money before launch. The
API asks the database each time and refuses if it can't get an answer, so a
database outage also shows up as this message.

**What the user sees.** Buy buttons are replaced with "Buying opens when
payments open in your region." The payout section in Settings says "Payout
setup opens when payments open in your region. You can publish listings in the
meantime." The message above appears only if something gets past those.

**Manual fix.** None before launch.

**Money impact.** None. That's the point of this rule.

---

## Reports of an off-site deal

Not an error the code produces. If a buyer or a creator says they paid, or
delivered, outside Made for Stream before launch:

1. Made for Stream has no record of any money, because none can move here.
   Say so plainly, without taking sides.
2. Point them to Terms section 4, "Before launch". The deal is only between
   them, and Made for Stream offers no refund, dispute process or protection
   for it.
3. If it looks like fraud, or the chat breaks the Community Guidelines,
   handle it as a report (moderation), not a payment issue.
4. Alvin decides anything beyond that. This is a
   [Tier 3](../incident-response.md) matter if several people report the same
   creator.

---

## Opening payments at launch

All of this is Alvin's job, and it happens in this order:

1. A lawyer has reviewed the Terms, Privacy Policy, Creator Terms, Refund
   Policy and Payment Terms. Remove the "Before launch" paragraph from Terms
   section 4 and bump `termsVersion`.
2. Prod's API gets live Stripe keys, webhooks and the `connect-resync` job
   ("Before payments open" in `../../environments.md`).
3. A migration redefines `payments_are_live()` to return `true`. That opens
   accepting, agreements, checkout, instant purchases and payout setup, and
   puts back the payout-account rules for publishing and for receiving
   requests.
4. Paid listings published before launch stay published, even if their
   creator has no payout account. Requests to them are refused
   ("This creator cannot take new paid work right now…") until the creator
   sets up payouts. Tell those creators before launch day.
5. The site picks up the change the next time someone loads a page. No site
   deploy is needed.

## Known gaps

- **No region-by-region opening.** The switch covers everywhere at once. To
  open one country first, `payments_are_live()` would need to take a country.
- **The setup checklist still lists payouts** as a step for approved creators.
  The section itself says payouts open at launch.
- **People can still arrange payment in chat.** The notice says the risk is
  theirs. Nothing blocks it.
