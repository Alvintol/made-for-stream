# Launch Rehearsal Runbook (test mode)

Sprint 8's last gate (`launch-implementation-checklist.md`). **Written 2026-09-23,
updated 2026-10-08, section 0 nearly done, section 1 started in CAD, sections 1b to 7 not yet run.** Tick the boxes as you go and record
the ids you used, so "has this been rehearsed" has an answer.

**Progress, 2026-10-08.** The first CAD request
(`6070950f-424c-4f60-9d17-4996a5ecee4b`, a deposit and balance agreement
accepted by the buyer) was **cancelled before any payment** so the run could
restart with milestones. Confirmed in the database: the request, its
agreement and its unpaid deposit payment are all `cancelled`, nothing was
paid, and all six emails for it are marked `sent`, the last being
`request_cancelled` to the buyer (the creator cancelled). All four rehearsal
accounts have saved their private account details and accepted the
`2026-10-08` Terms and Privacy Policy. **No new request exists yet:** section
1 restarts from "Buyer submits a request". Not yet done: the 9.99 and
early-start refusals, any payment.

A second round of interface changes from this run is on branch
`feat/request-invoice-inbox-dashboard` (website only, no migration, no API
deploy): the estimated invoice and fee note on the request form, percentage
shortcuts and an explanation of the contribution at checkout, a tidier top
bar menu, the promotional email question on the account details form, inbox
folders with search (newest 50 conversations, older ones on demand), and a
real creator dashboard whose numbers are database counts.

Defects found by this run and fixed on branch
`fix/rehearsal-checkout-agreement-and-region` (needs an **API deploy**, then
the website merge):

- Budget box on the commission request form: the currency code sat on top of
  the typed amount.
- Milestone payments needed more than 14 work days while the builder
  defaults to 14. Now 7 days or more; the plan shows but is locked below that.
- Checkout: a tip or contribution from an earlier visit showed in the total
  but could not be changed or removed. The boxes now show the saved amounts.
- Checkout: the billing country was a free choice on every payment. It is
  now the country saved in Settings (enforced by the API); a buyer with none
  saved chooses once and it is saved.
- Checkout: "Continue to payment" was unstyled text.
- Agreement acceptance: one compact list instead of a card per tick box; the
  early-start explanation sits behind "Why am I asked this?".
- Top bar globe: language and currency only. The country is set in Settings.

A passing run clears **CAD and USD** for launch. The EUR run proves the money path works
in a second currency in test mode. It does **not** clear EUR, GBP or any other wave 2
currency for live sales: that stays gated on the Sprint 7 tax advice
(`docs/support/payments/tax.md`).

---

## 0. Before you start

The rehearsal runs on the private dev site, `https://dev.madeforstream.com`
(`environments.md`): Stripe test mode, the dev database, nothing public.

Already confirmed (2026-10-02), no action needed:

- [x] *(2026-10-05)* The API's health probe is correct and `/api/health` is
      `200`. It was malformed until today (`environments.md`), so the API
      had been restarting constantly. If a step fails with a `500`, check
      this first (`OPS-004`).
- [x] Migrations `137`, `138`, `139` and `140` are applied, and every function,
      table, column and trigger matches the repo (drift audit, 2026-09-26).
- [x] The API (Cloud Run) is on **test** Stripe keys, includes Sprints 4–9, and
      sends Stripe redirects and email links to the dev site.
- [x] The Connect webhook endpoint and the account-events destination are
      registered in test mode.
- [x] `STRIPE_TAX_COLLECTION_COUNTRIES` is unset (collection off).
- [x] Cloudflare Email Routing forwards the purpose addresses and `ops@`.
- [x] Hourly resync and ops alerts are running (`operations/alerting.md`).

To do:

- [x] *(Done; confirmed in the database 2026-10-05, except the buyer's profile, below.)* **Accounts.** Sign-ups are off, so accounts are created by hand. Use
      separate browser profiles (or private windows), one per account; each
      passes the Cloudflare login with your own email first.

      | Role | Account | How |
      | --- | --- | --- |
      | Admin **and buyer** | `imallbeans+twitch@gmail.com` (handle `ImAllBeans`) | exists; sign in with Twitch |
      | Creator, CA / CAD | `meowington88@gmail.com` | exists and approved; sign in with Google |
      | Creator, US / USD | `alvin.tolentino@hotmail.com` (handle `PizzaButt`) | exists and approved |
      | Creator, IE / EUR | `trashmailtrash8888@gmail.com` (handle `TrashMailman`) | exists and approved |

      To create one: Supabase → Authentication → Users → **Add user → Create
      new user**, the email above, any password, **Auto Confirm User** on. Then
      on the dev site choose the email sign-in and enter that address; the link
      arrives in the `imallbeans@gmail.com` inbox. **That email arriving is the
      proof that Supabase Auth mail works through Cloudflare** (Sprint 6).
- [x] *(Not needed. Decision 2026-10-07: the admin account
      `imallbeans+twitch@gmail.com` is the buyer; it has a profile and pays
      standard fees, 5% and 5%. `imallbeans@gmail.com` is not used.)*
      **Buyer profile.**
- [x] *(Done; `cancelled`, confirmed in the database 2026-10-07.)* **Clear the buyer's old test request first.** The buyer has an
      accepted, unpaid request from May on meowington's "222222222 updated"
      (`e1ee74b1-a947-45a4-bbb6-b77cde0b5c05`), and a buyer can hold only one
      open request per listing. Cancel it from the buyer's request page. This
      is also section 3's "before payment" check. A rolled-back dry run on
      2026-10-07 showed the cancel is allowed, cancels the agreement and its
      unpaid payment, and frees the listing for a new request.
- [x] *(Done; both applications `approved`, 2026-10-05.)* **Make the two new accounts creators.** Each completes its profile and
      submits a creator application; the admin approves both at
      `/admin/creator-applications`.
- [x] *(Done; verified in the database 2026-10-07: meowington CA/cad, PizzaButt US/usd, TrashMailman IE/eur, all three flags true.)* **Stripe payout setup, all three creators** (Settings → Payouts, Stripe
      test data): CA with CAD, US with USD, IE with EUR. *(2026-10-05: IE was
      done and verified on `TrashMailman`, then that Stripe account was
      deleted. All three are to do again: `meowington88` CA, `PizzaButt` US,
      `TrashMailman` IE. If an account is deleted in Stripe, its row must be
      reset too: `CON-009`.)* Afterwards each row in
      `creator_payment_accounts` shows `charges_enabled`, `payouts_enabled` and
      `details_submitted` all true, and a `v2.core.account…` row appears in
      `stripe_webhook_events` as `processed` (the first real account events).
- [x] *(Done; verified 2026-10-07: meowington "222222222 updated" 123 cad and "Free Overlay"; PizzaButt "VTube Models" 500 usd; TrashMailman "Emote Pack" 100 eur.)* Each creator publishes one **paid** listing. The CA creator also
      publishes one **free** listing (checked in section 1b).
- [x] *(Applied; confirmed 2026-10-07: the check below returns `0`.)* **Apply migration `20261007_147` before taking any payment.** Without
      it half of every payment's base is added to the application fee
      (`REC-005`). Check: `select public.resolve_listing_request_payment_recovery_instalment('00000000-0000-0000-0000-000000000000', 4000);`
      must return `0`.
- [ ] **Every rehearsal account saves its private account details**
      (needs migration `20261008_150`, an API deploy, then the website).
      Each of the four accounts is sent to Settings → Personal details on
      its next visit and can do nothing else until the form is saved; each
      must also accept the new Terms and Privacy Policy (`2026-10-08`)
      first. Use an address in the account's own country (CA, CA, US, IE):
      it is the billing country at checkout. Check while there: the saved
      details show as `********` until **Show details** is pressed, and
      **Settings → Preferences** has the promotional email box, unticked.
      Afterwards: `select count(*) from public.user_account_details;` is 4.
- [ ] **Display name (needs migration `20261008_152`).** The four rehearsal
      accounts already chose theirs, so nothing changes for them. To see the
      new step, sign in with an account that never chose one
      (`imallbeans@gmail.com`): the first-time form has a Display name box at
      the top, starts empty, and will not save without 2 to 50 characters.
- [ ] **Browser-check the Storage Register** (Cookie Policy §7) on the dev
      site: DevTools → Application. The published register lists
      `sb-itbgxxczuazwroniiyot-auth-token`, `creatorhub.pendingPolicyAcceptance`,
      `creatorhub.cookiePreferences`, `creatorhub-theme` and Stripe's `__stripe_mid`
      / `__stripe_sid`. On the dev site you will also see Cloudflare Access's
      `CF_Authorization` cookie: that one is the dev login wall and will not
      exist in prod, so it does not go in the register. Anything else that
      appears (e.g. `__cf_bm`) does: add it, bump the Cookie Policy version and
      record its fingerprint.
- [ ] The rehearsal writes to the dev database next to the seeded rows. Never
      delete rows afterwards: acceptance records and the payment ledger are
      append-only by design.

Useful queries throughout (replace the ids):

```sql
-- Every payment on a request, with the fee arithmetic to check by hand
select id, payment_type, status, currency, base_amount_cents, buyer_service_fee_cents,
       creator_platform_fee_cents, creator_tip_cents, platform_support_cents,
       recovery_instalment_cents, tax_cents, tax_treatment, application_fee_cents,
       total_checkout_cents, buyer_service_fee_minimum_cents, creator_platform_fee_minimum_cents
from public.listing_request_payments
where listing_request_id = '<request>' order by created_at;

-- Acceptance evidence for the request
select policy_type, policy_version, accepted_at
from public.policy_acceptances
where related_listing_request_id = '<request>' order by accepted_at;
```

For every paid row: `buyer_service_fee_cents = ceil(base × 5%)`, the same for the
creator fee, **`recovery_instalment_cents` is 0** and `application_fee_cents` is
the two fees plus any contribution (`REC-005`), `currency` is the creator's, **both `_minimum_cents` columns are 0**, `total_checkout_cents = base +
buyer fee + tip + support + tax`, and `tax_treatment = 'not_collected'`.

---

## 1. Happy path, once in each currency (CAD, USD, EUR)

**Wording (2026-10-07).** On screen and in emails a request is now called a
**commission**, and a **commission request** until the creator accepts it:
the buyer's button is "Send commission request", the creator's are "Accept
commission request" and "Decline commission request", and the lists are
"Commissions". This runbook, the web addresses (`/requests/...`), the
database and its error messages, and the policies still say "request".

**Emails (2026-10-07, needs migration `20261007_148` and an API deploy).**
Every step below now emails the other person within a few seconds. All test
accounts deliver to inboxes you can read, so check as you go: the email
arrives, it is addressed to the right side, and its button opens the right
page while signed in as that account. The full list is in
`docs/support/messaging/commission-notifications.md`. To see what was queued
and sent for a request:

```sql
select n.kind, u.email, n.email_status, n.email_failed_reason
from public.listing_request_notifications n
join auth.users u on u.id = n.recipient_user_id
where n.listing_request_id = '<request>' order by n.created_at;
```

- [ ] Each step's email arrived for the CAD run, and every button opened the
      right page. (Buyer links were broken before this change: `NOTIF-004`.)
- [ ] The 3-day and 7-day reminders cannot be seen in a one-day rehearsal.
      They were checked by a rolled-back dry run only.
- [ ] **Chat emails (needs `20261007_149`).** With the creator signed out
      for more than five minutes, the buyer sends two chat messages: the
      creator gets **one** email. With the creator active on the site, the
      buyer sends another: **no** email.
- [ ] **Cancellation warning (needs `20261007_149`).** On an active
      commission the creator sends a warning ("Send cancellation warning",
      10 days). The buyer gets the email and sees the deadline on the
      commission page. The buyer replies in the chat: the panel now says the
      warning was answered, and the creator gets an email. Send another while
      a payment is due and have the buyer pay **without writing anything**:
      the warning stops within a few seconds of the payment. Send a third and
      withdraw it. The automatic
      cancellation itself takes 7 days or more, so it was checked by a
      rolled-back dry run only (`docs/support/requests/cancellation-warnings.md`).

Record the request id per currency: CAD `____` (the first attempt, `6070950f-…`, was cancelled before payment: section 3) USD `____` EUR `____`

- [ ] *(Needs migration `20261008_151` applied before the website is merged.)*
      The budget box takes an amount or a range: type `100 to 150` and the
      "Estimated invoice" card (now above the listing summary) shows a range on
      every line; type `around 100` and the form refuses it with a message
      saying what it accepts.
- [ ] Buyer submits a request. On the form: the budget box shows the
      creator's currency, the note under it states the 5% buyer service
      fee, and the "Estimated invoice" card beside the form follows the
      budget as it is typed (and shows an estimate in the buyer's own
      currency when that differs: the USD and EUR runs). Creator accepts it.
- [ ] Creator builds a **milestone** agreement with two milestones (estimated
      work days must be 7 or more, or the milestone plan is locked; the
      builder has no deposit on a milestone agreement; a deposit exists only
      on "deposit and balance", which sections 2 and 3 can use),
      every payment ≥ 10.00. **The amounts show the creator's currency.** **Summary shows the fee line as a maximum**, with the
      right figure (5% of each item, rounded up, summed).
- [ ] Negative checks before sending (each must refuse with `AGR-005`'s message and
      send nothing):
  - [ ] a 9.99 milestone, in the builder;
  - [ ] the same through a direct RPC call (`create_listing_request_agreement`
        with a 9.99 schedule item), which proves the database refuses it, not just
        the form.
- [ ] Send. Buyer opens it: the **early-start box is separate** from the
      acknowledgements, and Accept stays disabled until it is ticked.
- [ ] Negative check: call `respond_listing_request_agreement` directly with
      `buyer_accepted`, every acknowledgement key and **no**
      `p_early_service_request_version`. Refused with `AGR-007`; the agreement stays
      `sent`.
- [ ] Accept. `policy_acceptances` has an `early_service_request` row for the
      request at the current Refund Policy version (`2026-10-07`).
- [ ] Starting payment checkout: the policy step shows the Fee Schedule / Refund
      Policy box but **not** the early-start box again. Add a **tip and a
      contribution** on this payment. The billing country shows the
      country from the buyer's private account details and cannot be changed
      on the page (2026-10-08); the tax row reads as not collected. Leave the page and
      come back: the tip and contribution boxes show what was entered and
      can be changed. The percentage buttons fill in a share of the project
      payment, **Round up** brings the total to a whole number, and the
      contribution explains what it is for. Both boxes start empty. Pay with `4242 4242 4242 4242`.
- [ ] Webhook marks it paid, and the workflow advances. The fee arithmetic above
      holds. `listing_request_payment_tax_evidence` has the billing country and the
      card country (country codes only).
- [ ] Milestone 1: creator submits, buyer approves, milestone payment paid.
- [ ] **Change order:** first try +5.00, which the creator's send must refuse
      (`AGR-005`, via the change-order trigger). Then +15.00: send, buyer accepts,
      payment paid.
- [ ] Milestone 2, then final delivery, final balance paid, project completed.
- [ ] Receipt emails arrived for each payment (transactional email, Sprint 6).

## 1b. Free listing and a restricted creator (Sprint 9)

- [ ] **Free listing:** the buyer requests the CA creator's free listing. It is
      accepted without touching Stripe (no `CON-007` refusal).
- [ ] **Not-ready creator:** the buyer tries to request a listing from a seeded
      creator who has no Stripe account (use Amatrine's "Cozy Emote Pack (12)";
      the database refused it in a rolled-back dry run on 2026-10-07). Refused with `CON-007`'s buyer message
      ("This creator can't take new paid work right now…").
- [ ] **Ops alert:** an alert email arrives at `ops@` for anything this run
      leaves open, and its "Open in admin" button opens the dev site.

## 2. Two payments in the same month

The scope asks to prove "the minimum is charged once". There are no fee minimums
since `20260921_117`, so the check is now that **no minimum is charged at all**.

- [ ] On the CAD creator, in the same calendar month, take two separate paid
      payments of **10.00** each (two small projects, or deposit + balance).
- [ ] Each shows buyer fee 50 and creator fee 50 (5%), both `_minimum_cents` = 0.
      Neither shows 100/150.

## 3. Cancellation

- [x] *(2026-10-08, request `6070950f-…`, cancelled by the creator after the
      buyer accepted the agreement: request, agreement and the unpaid deposit
      all `cancelled`, `paid_at` empty, buyer emailed.)* **Before payment:** accept an agreement, cancel before paying. Nothing is
      charged, and no payment row reaches `paid`.
- [ ] **After work starts:** on a paid project, the buyer requests cancellation,
      the creator submits the itemised statement, and the buyer accepts it. The
      refund matches earned value (`docs/support/requests/cancellation.md`).

## 4. Refunds

- [ ] Partial refund of a paid base (e.g. 40 of 100). The buyer fee refunded is
      proportional (2.00), the creator fee is reversed proportionally, tip and
      contribution are untouched, and the tax lines stay 0.
- [ ] A second partial refund, then a full refund of the remainder. The cumulative
      fee refunds equal the original fees exactly, with no rounding drift
      (`listing_request_payment_refunds`).
- [ ] Refund a tip or contribution explicitly (Refund Policy §8).

## 5. Payout hold

- [ ] For each test connected account, read its payout schedule (Stripe Dashboard,
      or `stripe.balance.retrieve` on the account). Record the delay days: CA
      `__`, US `__`, EUR `__`. §6.3 was confirmed at 7 days for CA only; this
      records the other two.
- [ ] Refund a payment **inside** the hold. It is funded from the creator's
      pending balance, with no platform funding and no recovery balance.

## 6. Recovery balance

- [ ] On a creator whose Stripe balance cannot cover it (test mode: use a payment
      that has already paid out, or refund more than the available balance), issue
      a refund. Made for Stream funds the shortfall and a `creator_recovery_balances`
      row opens (`docs/support/payments/creator-recovery-balances.md`).
- [ ] The creator's listings refuse **new** requests; existing projects continue.
- [ ] The creator's next payment diverts up to 50% of base into
      `recovery_instalment_cents`, and the balance falls by that amount.
- [ ] Settle the rest by card from payout settings. The balance reaches zero, and
      new requests are accepted again.

## 7. What to record afterwards

- [ ] Tick Sprint 8's rehearsal item in `launch-implementation-checklist.md`, with
      the date, the three request ids and any failures.
- [ ] Anything that fails: file it against its playbook issue, or write a new one.

---

## Carried gaps the rehearsal may run into

These are known, recorded under "Carried, not launch-blocking", and not defects
of the rehearsal:

- **`processing` state.** Card payments won't hit it. Don't test local payment
  methods (SEPA and so on): they are not supported until that rework lands.
- **Change orders vs milestone schedules.** After step 1's change order, check
  `AGR-001`'s totals query still reconciles. If it doesn't, that's the known gap in
  `change-orders.md`.
- **Delivery links are not verified.** Final delivery accepts any URL.

Closed since this runbook was written (Sprint 9): Stripe account changes are
handled and resynced hourly, and `PAY-005`, `CHG-003`, `REQ-003` and
`TAX-002`–`004` are alerted by email. At the end of the run, check the `ops@`
inbox instead of running those queries by hand.
