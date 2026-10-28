# Launch Rehearsal Runbook (test mode)

Sprint 8's last gate (`launch-implementation-checklist.md`). **Written 2026-09-23,
updated 2026-10-09, section 0 nearly done, section 1 under way in CAD (agreement accepted, no payment yet), sections 1b to 7 not yet run.** Tick the boxes as you go and record
the ids you used, so "has this been rehearsed" has an answer.

**Progress, 2026-10-09 (all confirmed in the database).**

- **CAD run, request `4fb4b602-73f1-474f-9ef8-7d55ce1cfa9a`** ("TEST NEW
  COMMISSION" on meowington's "222222222 updated", budget saved as a range,
  100 to 123). Sent by the buyer, accepted by the creator.
- **Agreement `f1157fac-69ee-47b0-9b11-1065da171919`:** milestone payments, CAD,
  total 100.00, two milestones ("sketches" 60.00, "coloured" 40.00), both
  fee rates locked at 500 (5%), no starting payment. **Accepted by the buyer**
  at 2026-10-09 00:26 UTC: 15 confirmations recorded item by item, and the
  `early_service_request` row is recorded at Refund Policy `2026-10-07`.
- **Emails, all `sent`:** `request_received` and `agreement_accepted` to
  meowington; `request_accepted` and `agreement_sent` to the buyer.
- **Milestone 1, done for real on 2026-10-11 (confirmed in the database):**
  meowington submitted "sketches" with one preview image (stored as an
  89 KB WebP in the private `milestone-previews` bucket: the first real
  upload, migration `20261011_154` confirmed applied). The buyer approved it
  at 23:42 UTC. One payment row exists: `milestone_payment`, 60.00 CAD, fees
  3.00 and 3.00, total 63.00, `requires_checkout`. Emails `sent`:
  `milestone_submitted` and `payment_required` to the buyer,
  `milestone_approved` to meowington. **Next step: the buyer pays it, with a
  tip and a contribution.**
- **Defect found on that step, fixed on `fix/refresh-payments-after-approval`:**
  after the buyer clicked Approve, no pay button appeared until the page was
  reloaded. Approving did not refresh the payments list. The same was true
  of accepting an agreement, accepting a change order and approving a final
  delivery; all four now refresh it.
- **Milestone 1 payment, paid for real on 2026-10-12 20:22 UTC (confirmed in
  the database).** The first real payment through the Stripe webhook. Base
  60.00, buyer fee 3.00, creator fee 3.00, tip 3.00, contribution 1.00, total
  67.00 CAD; application fee 7.00 (the two fees plus the contribution);
  recovery instalment 0; both minimums 0; `not_collected`; the charge id is
  stored. Tax evidence: billing country CA from `account_details`, CA from
  the checkout, card issuer US (the test card). Refund Policy and Fee
  Schedule acceptances recorded at checkout, the early-start box not asked
  again. Milestone 1 and its schedule line are `paid`. `payment_received`
  email to meowington `sent`.
- **Change order, 2026-10-12.** A +5.00 change order was refused by the
  database, but the screen gave no reason. A change order with a completion
  date 23 days in the past (`f436a9d4-…`) was accepted and sent, and could
  not be changed or cancelled by the creator; it is still `sent` and holds
  up milestone 2. **Fixed on `feat/change-order-withdraw`** (migration
  `20261012_155`): screens show the database's reason, a past date is
  refused, and the creator can withdraw a change order until the buyer
  answers. **Next step, after that ships: meowington withdraws
  `f436a9d4-…`, then sends +15.00.**
- **2026-10-12 21:25 UTC, after PRs #165 and #166:** meowington withdrew
  `f436a9d4-…` with the new button. It is `cancelled`, the chat has the
  "withdrew" line, and no hold is open, so milestone 2 is no longer blocked.
- **Defect found in the emails, fixed on `fix/system-message-emails`
  (migration `20261012_156`):** at 20:45 the buyer was sent a
  `message_received` email ("meowington sent you a message") although
  nobody had written anything; the hourly safety net had counted the
  automatic "change order sent" chat line as a message (`NOTIF-005`).
- **Change order +15.00, done for real on 2026-10-12 (confirmed in the
  database).** Sent, accepted, and paid at 21:34 UTC: base 15.00, buyer fee
  0.75, creator fee 0.75, total 15.75 CAD, application fee 1.50, recovery 0,
  minimums 0, `not_collected`. Emails `sent`: `change_order_sent` and
  `payment_required` to the buyer, `change_order_accepted` and
  `payment_received` to meowington.
- **Defect found by the operator, fixed on
  `feat/failure-log-refresh-and-discounts` (migration `20261012_158`):** a
  change order lowering the total by 25.00 ("Discount", version 3) was
  accepted, and only the agreement's total changed. The agreement says
  **90.00** but its payment schedule still adds up to **115.00** (60.00 and
  15.00 paid, "coloured" still 40.00), so the buyer would be asked for 40.00
  where 15.00 is owed. **Before milestone 2 is submitted, the one-off
  correction in `CHG-007` must be run** ("coloured" becomes 15.00).
  Version 4 ("discount", no price change) was declined by the buyer; its
  email was sent.
- **Also on that branch:** a reload notice after any failed action instead
  of an automatic refresh; every failure logged
  (`20261012_157`, `OPS-006`, `OPS-007`) and listed daily in the ops email.
- **Milestone 2, done for real on 2026-10-13 (confirmed in the database).**
  meowington submitted "coloured" with one preview image at 23:31 UTC, the
  buyer approved at 23:33 and paid at 23:36: base 15.00, buyer fee 0.75,
  creator fee 0.75, no tip or contribution, total 15.75 CAD, application
  fee 1.50, recovery 0, minimums 0. Milestone and schedule line `paid`; the
  whole 90.00 is now paid. Emails `sent`: `milestone_submitted` and
  `payment_required` to the buyer, `milestone_approved` and
  `payment_received` to meowington. No new acceptance rows (the Refund
  Policy and Fee Schedule are asked once per commission).
- **Tax was switched on for this payment, and returned zero.** It is the
  first payment with `tax_treatment = 'calculated'` (CA, AB) and it has a
  Stripe Tax calculation and transaction id, but `tax_cents` is 0 where
  Alberta's 5% would be 0.79. The playbook's first cause is a missing
  Canada registration on the platform account in Stripe test mode
  (`tax.md`, "How a country gets switched on"); not confirmed. Its location
  evidence is `insufficient` (billing CA, card issuer US, because the
  `4242` test card is American), so `TAX-002` will email ops within the
  hour: expected for that card, and the first real run of that alert. Use
  `4000 0012 4000 0000` for this buyer from now on.
- **Final delivery and completion, done for real on 2026-10-16/17
  (confirmed in the database).** meowington submitted the final delivery at
  23:57 UTC with a 6.8 MB `delivery.zip` and "Provided off site" (another
  way). After migration `20261016_166` the buyer was emailed to confirm
  (00:14, `sent`). Approving first was refused three times (logged in
  `app_failure_events`, as designed). The buyer confirmed receipt at 07:56,
  downloaded the zip (logged, 6,831,759 bytes) and approved; the commission
  is `completed`, the chat closed, `off_site_receipt_confirmed` and both
  `request_completed` emails `sent`, and `commission_image_retention` has
  its row, deleting 2 preview images and the zip on 2027-04-15. **The CAD
  run is complete.** Not tried in the browser: "It hasn't arrived".
- **Found on that step, fixed on `feat/receipt-jump-and-completed-order`:**
  the approval refusal only showed an error; it now takes the buyer to the
  confirmation box on the Messages tab. A completed project lists the final
  delivery first.
- There is no cancellation warning.
- **Rehearsed as roll-back dry runs on 2026-10-09, nothing kept** (the real
  steps are still to do): submitting milestone 2 first is refused
  (`MIL-001`); milestone 1 submit and approve creates one payment, 60.00 CAD,
  fees 3.00 and 3.00, total 63.00, no recovery instalment, no minimums; once
  paid the milestone and its schedule line are `paid` and milestone 2 can be
  submitted. A +5.00 change order is refused with `AGR-005`'s message; +15.00
  is accepted and makes a 15.00 payment (fees 0.75 and 0.75, total 15.75),
  and the agreement total becomes 115.00. Each step queued the right email
  to the right person. Marking a payment paid was done by hand in the dry
  run: the Stripe webhook itself has still never run on a milestone payment.
- **Not done on this run, because the agreement was already accepted when
  they were due:** the 9.99 direct-call refusal (`AGR-005`) and the
  early-start direct-call refusal (`AGR-007`). Run both as roll-back dry runs
  on the USD run, before the agreement is sent and before it is accepted.
- **Its scope checklist lines all read "Included"**, including "buyer send
  reference photos": the agreement was written before the form had the
  "provides" and "approves" boxes (`20261008_153`). The USD run is the first
  to use them.
- **Earlier attempts.** `6070950f-…` (deposit and balance) was cancelled by
  the creator before any payment: request, agreement and the unpaid deposit
  are `cancelled`, nothing was paid, and the buyer was emailed. That is
  section 3's "before payment" check. `e1ee74b1-…` is the May test request,
  also cancelled.
- **Accounts.** All four rehearsal accounts have private account details
  (CA, CA, US, IE), a chosen display name and a handle, and have accepted the
  `2026-10-08` Terms and Privacy Policy.

**Open, found during this run and not fixed:**

- The buyer and meowington each have their `2026-10-08` Terms and Privacy
  acceptance recorded three times in `policy_acceptances`. Harmless.
  **Cause found 2026-10-13, fixed on `feat/version-history`:** it happened
  again (the buyer's sign-in at 23:13 UTC wrote three identical pairs within
  30 ms). The page that records the box ticked at sign-in could start more
  than once before the first write returned; every start now waits on the
  same write. The old extra rows stay (the table is append-only). No
  playbook covers this sign-in step yet.
- **Privacy Policy `2026-10-12-2`, 2026-10-13:** accepted by the buyer
  (22:48 UTC, from the "what changed" card) and by meowington (23:14 UTC,
  by ticking the box on the sign-in page, so the card was not involved).
  PizzaButt and TrashMailman are still on `2026-10-08`. **Someone who signs
  in afresh accepts the current policies with the sign-in box and never
  sees the list of changes;** only a person already signed in gets the
  card. Not decided whether that is acceptable.
- Buyer-side on-screen checks for the CAD steps above were done by the
  operator and are not individually ticked below; only what the database
  shows is.

**What changed in the product during this run** (all merged, PRs #152 to
#161; migrations `20261008_150` to `153` applied; details in each playbook):
private account details and a chosen display name are required before
listing, requesting or paying; the billing location comes from those details;
budgets can be a range and the request form shows an estimated invoice;
checkout has tip shortcuts and "Round up"; the agreement is confirmed section
by section, with examples on the form and "who is this for" on checklist
lines; emails name people by handle; the inbox has folders and search; the
creator dashboard and the top bar were rebuilt.

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

Record the request id per currency: CAD `4fb4b602-73f1-474f-9ef8-7d55ce1cfa9a` (the first attempt, `6070950f-…`, was cancelled before payment: section 3) USD `97653182-2930-417f-83f5-d7a373a5f949` EUR `____`

- [ ] *(Needs migration `20261008_151` applied before the website is merged.)*
      The budget box takes an amount or a range: type `100 to 150` and the
      "Estimated invoice" card (now above the listing summary) shows a range on
      every line; type `around 100` and the form refuses it with a message
      saying what it accepts.
- [x] *(CAD 2026-10-08: request `4fb4b602-…` sent with a budget range and accepted; both emails `sent`. USD and EUR to do.)* Buyer submits a request. On the form: the budget box shows the
      creator's currency, the note under it states the 5% buyer service
      fee, and the "Estimated invoice" card beside the form follows the
      budget as it is typed (and shows an estimate in the buyer's own
      currency when that differs: the USD and EUR runs). Creator accepts it.
- [x] *(CAD 2026-10-09: agreement `f1157fac-…`, milestones 60.00 and 40.00 CAD, fee rates 500/500. USD and EUR to do.)* Creator builds a **milestone** agreement with two milestones (estimated
      work days must be 7 or more, or the milestone plan is locked; the
      builder has no deposit on a milestone agreement; a deposit exists only
      on "deposit and balance", which sections 2 and 3 can use),
      every payment ≥ 10.00. **The amounts show the creator's currency.** **Summary shows the fee line as a maximum**, with the
      right figure (5% of each item, rounded up, summed).
- [ ] *(USD 2026-10-26: sent with one "provides" line and one "approves"
      line, stored as `buyer_provides` and `buyer_approves`. The labels on
      both sides' pages still to be looked at.)* On the
      agreement form, fill "What <buyer> needs to provide" and "What <buyer>
      needs to approve" as well as the required checklist. After sending, the
      scope checklist shows "Included", "<buyer's handle> provides" and
      "<buyer's handle> approves" beside the lines, on both sides' pages.
- [ ] Negative checks before sending (each must refuse with `AGR-005`'s message and
      send nothing):
  - [x] *(Refused in the builder on earlier runs; not tried again on USD.)* a 9.99 milestone, in the builder;
  - [x] *(USD 2026-10-26, rolled back: 9.99 refused with `AGR-005`'s
        message, 10.00 accepted, nothing kept.)* the same through a direct RPC call (`create_listing_request_agreement`
        with a 9.99 schedule item), which proves the database refuses it, not just
        the form.
- [ ] Send. Buyer opens it: each section of the agreement ends with its own
      "I understand the … above." box (2026-10-08; there is no separate list
      any more), the panel underneath counts them ("0 of 5 confirmed"), the
      **early-start box is separate** from them, and Accept stays disabled
      until every box and the early-start box are ticked. After accepting,
      "Buyer confirmations" on the agreement lists every item individually.
- [x] *(USD 2026-10-26, agreement `ec81ed28-…`, rolled back: with all 17
      keys, no version and the version "yes" were both refused with
      `AGR-007`'s message and the agreement stayed `sent`; the same call with
      `2026-10-07` was accepted, proving the keys were complete. Nothing kept:
      0 confirmations, 0 early-start rows. EUR to do.)* Negative check: call
      `respond_listing_request_agreement` directly with
      `buyer_accepted`, every acknowledgement key and **no**
      `p_early_service_request_version`. Refused with `AGR-007`; the agreement stays
      `sent`.
- [x] *(CAD 2026-10-09: accepted 00:26 UTC, 15 confirmations, early-start row at `2026-10-07`; `agreement_accepted` email `sent`. USD 2026-10-26: accepted 23:19 UTC, 17 confirmations, early-start row at `2026-10-07`, fees locked at 5% and 5%, `agreement_accepted` email to the creator `sent`. EUR to do.)* Accept. `policy_acceptances` has an `early_service_request` row for the
      request at the current Refund Policy version (`2026-10-07`).
- [ ] *(USD 2026-10-27, milestone 1 payment `6fcd87fd-…`: Fee Schedule and Refund Policy accepted 00:09, no early-start box; tip 12.50 and contribution 3.00. Found: the second Round up was greyed once the first made the total whole. V0.6.04 made each press add up to 1.00 instead; on review that was worse (1.10 → 2.00 → 3.00 …), so V0.7.00 restores "whole once, then rests" and the summary now shows the tip, contribution and total live. Re-checked on milestone 2 (payment `4d9185b0-…`, 2026-10-28): tip 2.16 and contribution 3.84 brought 315.00 to a whole 321.00, and no problem was reported. EUR to do.)* Starting payment checkout: the policy step shows the Fee Schedule / Refund
      Policy box but **not** the early-start box again. Add a **tip and a
      contribution** on this payment. The billing country shows the
      country from the buyer's private account details and cannot be changed
      on the page (2026-10-08); the tax row reads as not collected. Leave the page and
      come back: the tip and contribution boxes show what was entered and
      can be changed. The percentage buttons fill in a share of the project
      payment, **Round up** brings the total to a whole number and then rests until the total changes (the summary above shows the tip, contribution and total as they are typed), and the
      contribution explains what it is for. Both boxes start empty. Pay with `4242 4242 4242 4242`.
- [x] *(USD 2026-10-27: paid 00:10 UTC; 250.00 + fee 12.50 + tip 12.50 + contribution 3.00 = 278.00; application fee 28.00 = both 12.50 fees + 3.00; milestone and schedule item `paid`; `payment_received` email `sent`. Tax `calculated`, 0.00, region CA-AB, with a Stripe Tax transaction id. Evidence: billing CA (account details and checkout), card US, so `TAX-002` is expected to flag it. Milestone 2, 2026-10-28: paid 00:09 UTC; 300.00 + fee 15.00 + tip 2.16 + contribution 3.84 = 321.00; application fee 33.84 = both 15.00 fees + 3.84; `payment_received` email `sent`; tax 0.00 as before. EUR to do.)* Webhook marks it paid, and the workflow advances. The fee arithmetic above
      holds. `listing_request_payment_tax_evidence` has the billing country and the
      card country (country codes only).
- [x] *(USD 2026-10-26/27: three images stored on submission 1, bucket private; the watermark showed on the thumbnails and a file that is not an image was refused. The one-hour expiry not tried.)*
      **Milestone preview images.** When submitting milestone 1 the creator
      adds one or two images in "Preview images". Each thumbnail on the form
      already carries "Made for Stream · @<creator handle>" across it. After
      submitting, the creator and the buyer both see the watermarked images
      under the milestone, and clicking one opens it in a new tab. Also try a
      file that is not an image (refused with "Choose a JPEG, PNG or WebP
      image.") and removing an image before submitting. In the database the
      submission's `preview_image_paths` lists the files, and
      `select public from storage.buckets where id = 'milestone-previews';`
      is `false`. An image's address works for one hour for anyone who has
      it, then stops (`MIL-005`).
- [ ] *(Migration `20261027_168` applied 2026-10-27. Not tried on USD: milestone 2 was submitted before the website change merged. EUR to do.)*
      **Milestone preview videos.** On milestone 2 the creator adds a short
      MP4 (or WebM/MOV) and an animated GIF under "Preview images and
      videos". Each shows as a playable thumbnail with "Made for Stream ·
      @<creator handle>" across every frame; a clip takes about as long as
      it lasts to prepare. After submitting, the buyer plays both on the
      commission page (silent, looping). In the database the submission's
      `preview_image_paths` has `.webm` (or `.mp4` from Safari) files.
      Also try a still GIF (refused: "That GIF does not move…") and, in
      Safari, a GIF (may be refused with "This browser cannot prepare
      GIFs…").
- [ ] **Tax in the rehearsal (test mode only; settings, not code).** In
      Stripe test mode add tax registrations for Canada, the EU (the One
      Stop Shop union scheme, or Ireland) and Washington State. On Cloud Run
      set `STRIPE_TAX_COLLECTION_COUNTRIES` to CA, US, GB and the 27 EU
      countries, `STRIPE_TAX_CODE_BASE` and `STRIPE_TAX_CODE_BUYER_FEE` to
      the general services code, and `STRIPE_TAX_CODE_TIP` and
      `STRIPE_TAX_CODE_SUPPORT` to the non-taxable code. Then, with a tip
      and a contribution on every payment:

      | Buyer (billing) | Seller | Test card |
      | --- | --- | --- |
      | ImAllBeans (CA, AB) | meowington (CAD) | `4000 0012 4000 0000` |
      | ImAllBeans (CA, AB) | TrashMailman (EUR) | `4000 0012 4000 0000` |
      | PizzaButt (US, WA) | meowington (CAD) | `4242 4242 4242 4242` |
      | PizzaButt (US, WA) | TrashMailman (EUR) | `4242 4242 4242 4242` |
      | TrashMailman (IE) | meowington (CAD) | `4000 0037 2000 0005` |

      For each: the checkout shows a tax line; `tax_cents` is greater than 0
      and `tax_treatment` is no longer `not_collected`; the tax is on the
      project amount and the buyer fee only, with nothing on the tip or the
      contribution; `total_checkout_cents` includes it; a Stripe Tax
      transaction id is stored; the evidence rows agree with the buyer's
      country (`TAX-002` stays quiet). An EU buyer buying from the EU seller
      needs a fifth account and is not covered.
- [ ] *(Needs migration `20261012_160`, then an API deploy, then the
      website.)* **Dispute hold and listing images.** On the admin page of a
      commission, "Mark as in dispute" needs a reason, then shows "In
      dispute"; "End dispute" clears it. A creator deactivates a listing:
      `select * from public.listing_image_retention;` has its row, 180 days
      on; reactivating removes it. A draft with no image cannot be published
      ("Add a preview image before making this listing live.", `LST-006`).
- [ ] **What changed, on the acceptance card.** Every account is asked to
      accept Privacy Policy `2026-10-12-2` and is shown its changes under
      "What changed in the Privacy Policy (2026-10-12-2)" before it accepts.
      *(Since V0.7.02 this also holds for someone who signs in fresh after
      the change: the sign-in box is not counted for a document they
      accepted in an older version. PizzaButt missed the card on 2026-10-16
      for that reason. Re-check at the next Privacy Policy change; a new
      account still sees no card.)*
- [ ] *(Needs migration `20261012_161` before the website is merged.)*
      **Site updates.** The footer shows "V0.2.00 · What's new" (version
      numbers since 2026-10-13; it read "Version 2026.10.12" before), and
      `/updates` lists the versions with their dates, signed in or not: the
      current one is open, and choosing another shows its changes instead.
      With ten or fewer versions there are no arrow buttons. In Settings →
      Preferences tick "Show me what's new after the site is updated":
      nothing happens straight away. Sign out and in again: a small window
      lists the latest changes, with "See all updates" and "Close". After
      closing it does not come back on the next sign-in
      (`last_seen_version` is the footer's version). No email is sent at any point
      (`SITE-001`).
- [ ] *(Needs migration `20261012_159`, then an API deploy, then the
      website.)* *(CAD: row from 2026-10-17 07:56, `delete_after` 2027-04-15. USD: row from 2026-10-28 00:42, `delete_after` 2027-04-26. Both 180 days on, `on_hold` false.)* **Image retention.** A closed commission that has images
      gets one row: `select listing_request_id, closed_at, delete_after,
      on_hold, deleted_at from public.commission_image_retention;` shows the
      CAD commission after it is completed, with `delete_after` 180 days
      on. The deletion itself cannot be seen in a one-day rehearsal; it was
      checked by a rolled-back dry run only (`MIL-006`).
- [ ] **Privacy Policy `2026-10-12`.** Every account is asked to accept it
      on its next visit. Sections 2, 3 and 8 mention the failure records and
      the 180 days for commission images.
- [ ] Milestone 1: creator submits, buyer approves, milestone payment paid.
- [ ] **Change order:** first try +5.00, which the creator's send must refuse
      (`AGR-005`, via the change-order trigger), **with the reason shown on the
      form** ("Each payment in a project must be at least 10.00 …"). Then
      +15.00: send, buyer accepts, payment paid.
- [ ] *(Needs migration `20261012_158` before the website is merged.)*
      **Lowering the price.** On a commission with one payment made and at
      least one not yet due, the creator proposes a lower total. The form
      opens "Remaining payments"; it will not send until they add up to the
      new total less what is paid or due, and refuses an amount under
      10.00. The buyer sees "Payment: <name>, X becomes Y" before accepting.
      After accepting, the next milestone's payment is the lower amount and
      `select total_amount` on the agreement equals the sum of its payment
      schedule. A total below what is already paid is refused (`CHG-007`).
- [ ] *(Needs migration `20261012_157`, then an API deploy, then the
      website.)* **Failures are logged and offered a reload.** Cause a
      refusal (a +5.00 change order): the form shows the reason, and a
      notice at the bottom offers "Reload page" without reloading by
      itself. `select source, route, code, message from
      public.app_failure_events order by id desc limit 5;` shows it. The
      next day's first ops email after 00:00 UTC lists it under "Yesterday's
      failures on the site" with its count (`OPS-006`).
- [ ] *(Needs migration `20261012_155` before the website is merged.)*
      **Withdrawing a change order.** The date box will not take a date
      before tomorrow (`CHG-005`). The creator sends a change order, then
      presses "Withdraw change order": it shows as "Cancelled" on both
      sides, the chat says it was withdrawn, and "Propose change" opens a
      form already filled in from it. After the buyer accepts a change order
      there is no Withdraw button (`CHG-006`).
- [ ] *(Needs migration `20261013_162` before the website is merged.)*
      **Provided off site.** On the milestone form and the final delivery
      form the warning about work sent outside the site shows before
      anything is ticked. Tick "Provided off site": the ways appear (Email,
      Discord, Text message, Another way). Submitting with none chosen is
      refused under the box. Choose Discord and "Another way" with a short
      description and submit: the chat gains the line "The creator reports
      that the work for … was also sent outside Made for Stream, by:
      Discord, another way (…)", both sides see "Also sent off site" on the
      commission page, the buyer gets the usual "submitted" email and **no**
      "new message" email. For a final delivery saved as a draft the line
      appears only when the draft is sent (`MIL-007`).
- [ ] **Conversation layout (2026-10-13, website only).** In a commission's
      chat each day appears once, as a line across the thread, and every
      message and automatic line under it shows only its time. An automatic
      line sits on the side of whoever caused it: signed in as the creator,
      "The creator sent a project change order…" is on the right with your
      own messages and "The buyer declined…" is on the left; signed in as
      the buyer it is the other way round. "Stripe confirmed payment…" sits
      on the buyer's side. The pill styling is unchanged.
- [ ] *(Needs migration `20261016_163` before the website is merged, and
      the project-wide upload limit in Supabase raised to at least 1 GB.)*
      *(USD 2026-10-28, final delivery `d26fcdd1-…`: four loose PNGs, stored
      under their own names with a 12-character code. No folder and no zip,
      so the folder zip and "Zip these 2 files into one" were not tried on
      USD. No download was made. EUR to do.)*
      **Delivery files.** On the final delivery form the "Files" section
      recommends one .zip. Choose a folder: it becomes one .zip named after
      the folder, listed with its size. Add two loose files: "Zip these 2
      files into one" appears and works. A file over 1 GB is refused under
      the section. Submit: the button shows "Uploading file 1 of …". On the
      delivery card both sides see "Files" with a Download button that
      saves the file under its own name. Signed in as the rehearsal buyer
      (an admin) the download always works; the lock while a balance is
      owed was checked by a dry run (`FIN-005`).
- [ ] *(Needs migration `20261016_164`, an API deploy, then the website;
      and the project-wide upload limit in Supabase at 2 GB.)* **Storage
      limits and the bar.** The final delivery form shows "Commission
      storage … of 20.0 GB" with the files being added as a lighter part of
      the bar. Limits: 2 GB a file, 50 files and 10 GB a delivery, a folder
      over 2 GB is refused for zipping with the steps to zip it on the
      computer. After a delivery, downloading a file adds a row to
      `delivery_file_downloads` *(CAD 2026-10-18: two rows. USD: none, as
      no file was downloaded; the row is written before the link is made, so
      a missing row means no download, not a lost record)*. The admin dashboard has a **Storage** card;
      `/admin/storage` shows stored and downloaded against the included
      amounts, the buckets, the largest commissions and the plans (`STO-001`,
      `STO-002`, `OPS-008`).
- [ ] *(Needs migration `20261016_165` before the website is merged.)*
      **Safe file types.** On the final delivery form, add a `.exe` or a
      `.bat`: refused with "For safety, only these file types can be
      uploaded: … Not allowed: setup.exe." A zip holding one is refused
      naming the file inside; a password-protected zip is refused as "could
      not be opened". A folder with a `.DS_Store` zips without it. The file
      picker offers only the allowed types (`FIN-005`).
- [ ] *(Needs migration `20261016_166`, an API deploy, then the website.)*
      **Confirming work sent off site.** The CAD final delivery
      (`7ea7b9ae-…`, marked "Provided off site") has a receipt from the
      migration, and the buyer gets an "Action needed: confirm you received
      the work" email. *(USD 2026-10-28: the final delivery was marked Discord
      only, so "Another way" was not tried; receipt `c81187bb-…` requested at
      00:41:31 with its email `sent`, answered **received** at 00:41:53 with an
      email to PizzaButt `sent`; approval at 00:42:05 completed the commission.
      **It hasn't arrived** was not pressed. EUR to do.)* Above the chat the buyer sees "Did the work arrive?"
      with **I received it** and **It hasn't arrived**. Approving the final
      delivery first is refused with "Confirm in the chat that you received
      the work…". Press **It hasn't arrived**: a chat line on the buyer's
      side, an email to meowington, and the creator's panel says so. Then
      **I received it**: a second chat line, an email to meowington, the
      panel disappears, and approval completes the commission. The 3- and
      7-day reminders and the 10-day ops alert were checked by dry run only.
      An admin can **Record as received** with a note (`MIL-008`).
- [ ] *(Needs migration `20261028_169` before the website is merged.)*
      **Milestone approval confirms receipt.** On the EUR run, mark milestone
      1 "Provided off site" and have the buyer press **It hasn't arrived**,
      then approve the milestone. The "Did the work arrive?" panel goes away
      without another press, the chat reads "The buyer approved milestone 1
      (…), which confirms that the work sent outside Made for Stream
      arrived.", and `select status, answered_by from
      public.off_site_delivery_receipts` shows `received` by the buyer. No
      "receipt confirmed" email is sent for it (`MIL-008`).
- [ ] **Unity packages.** Add a file named `avatar.unitypackage` to the
      final delivery: the refusal ends "…For now, send them outside Made for
      Stream and tick “Provided off site” so the buyer can confirm they
      arrived." A `.exe` alone gets no Unity sentence.
- [ ] **Zip name and chat boxes.** A folder zipped on the final delivery
      form is listed as "meowington_222222222_updated_deliverables.zip" and
      stored and downloaded as that name with a 12-character code before
      ".zip". Automatic lines that wrap have even
      padding.
- [ ] **Names in the chat (website only).** Automatic lines read
      "@meowington sent a project change order for @ImAllBeans to review:
      …" for both sides, not "The creator …".
- [ ] *(USD 2026-10-28: milestone 2 revision then approval, paid 321.00,
      final delivery approved 00:42 UTC, request `completed`, "completed"
      emails to both `sent`. CAD done earlier. EUR to do.)* Milestone 2, then
      final delivery, final balance paid, project completed.
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
