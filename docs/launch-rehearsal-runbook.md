# Launch Rehearsal Runbook (test mode)

Sprint 8's last gate (`launch-implementation-checklist.md`). **Written 2026-09-23,
updated 2026-10-05, section 0 partly done, sections 1 to 7 not yet run.** Nothing past section 0 has been executed; tick the boxes as you go and record
the ids you used, so "has this been rehearsed" has an answer.

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
      | Admin | `imallbeans+twitch@gmail.com` | exists; sign in with Twitch |
      | Buyer | `imallbeans@gmail.com` | exists; sign in with Google |
      | Creator, CA / CAD | `meowington88@gmail.com` | exists and approved; sign in with Google |
      | Creator, US / USD | `trashmailtrash8888@gmail.com` (handle `TrashMailman`) | exists and approved |
      | Creator, IE / EUR | `alvin.tolentino@hotmail.com` (handle `PizzaButt`) | exists and approved |

      To create one: Supabase → Authentication → Users → **Add user → Create
      new user**, the email above, any password, **Auto Confirm User** on. Then
      on the dev site choose the email sign-in and enter that address; the link
      arrives in the `imallbeans@gmail.com` inbox. **That email arriving is the
      proof that Supabase Auth mail works through Cloudflare** (Sprint 6).
- [ ] **Buyer profile.** `imallbeans@gmail.com` signs in with Google and
      completes profile setup (no row in `profiles` as of 2026-10-05).
- [x] *(Done; both applications `approved`, 2026-10-05.)* **Make the two new accounts creators.** Each completes its profile and
      submits a creator application; the admin approves both at
      `/admin/creator-applications`.
- [ ] **Stripe payout setup, all three creators** (Settings → Payouts, Stripe
      test data): CA with CAD, US with USD, IE with EUR. *(2026-10-05: IE
      done and verified, on `TrashMailman`; `PizzaButt` takes US / USD. CA and
      US still to do.)* Afterwards each row in
      `creator_payment_accounts` shows `charges_enabled`, `payouts_enabled` and
      `details_submitted` all true, and a `v2.core.account…` row appears in
      `stripe_webhook_events` as `processed` (the first real account events).
- [ ] Each creator publishes one **paid** listing. The CA creator also
      publishes one **free** listing (checked in section 1b).
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
creator fee, **both `_minimum_cents` columns are 0**, `total_checkout_cents = base +
buyer fee + tip + support + tax`, and `tax_treatment = 'not_collected'`.

---

## 1. Happy path, once in each currency (CAD, USD, EUR)

Record the request id per currency: CAD `____` USD `____` EUR `____`

- [ ] Buyer submits a request. Creator accepts it.
- [ ] Creator builds a **milestone** agreement with a deposit and two milestones,
      every payment ≥ 10.00. **Summary shows the fee line as a maximum**, with the
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
      request at the current Refund Policy version (`2026-09-24`).
- [ ] Starting payment checkout: the policy step shows the Fee Schedule / Refund
      Policy box but **not** the early-start box again. Add a **tip and a
      contribution** on this payment. Billing-country step, tax row reads as
      not collected. Pay with `4242 4242 4242 4242`.
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
      creator who has no Stripe account. Refused with `CON-007`'s buyer message
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

- [ ] **Before payment:** accept an agreement, cancel before paying. Nothing is
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
