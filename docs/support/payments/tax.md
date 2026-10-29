---
feature: payments/tax
status: active
surfaces:
  - public.listing_request_payments  # tax_* columns, stripe_tax_calculation_id, stripe_tax_transaction_id
  - public.listing_request_payment_tax_evidence
  - public.listing_request_payment_refunds  # *_tax_refund_cents, tax_refund_cents, stripe_tax_reversal_id
  - public.creator_payment_accounts  # tax_entity_type, tax_id_types
  - public.set_listing_request_payment_tax()
  - public.record_listing_request_payment_tax_evidence()
  - public.get_listing_request_payment_tax_evidence_status()
  - public.set_listing_request_payment_tax_transaction()
  - public.set_listing_request_payment_refund_tax_reversal()
  - public.apply_refunded_listing_request_payment()
  - api/tax.js
  - api/refundArithmetic.js
  - api/server.js  # applyCheckoutTax, finalizePaidPaymentTaxBestEffort, reverseRefundTaxBestEffort
  - src/pages/payments/ListingRequestPaymentCheckout.tsx
  - src/domain/payments/listingRequestPaymentTax.ts
  - public.list_ops_alerts()  # tax_evidence_insufficient, tax_transaction_missing, tax_reversal_missing, paid_wave2_currency (20260924_139), tax_report_due (20261028_170)
  - public.tax_reporting_obligations()  # the tax calendar (20261028_170)
  - public.tax_report_filings
  - public.admin_get_tax_reporting_overview()
  - public.admin_list_tax_report_sellers()
  - public.admin_set_tax_report_filed()
  - src/pages/admin/AdminTaxReporting.tsx
  - src/domain/payments/taxReporting.ts
unmatched_tier: 2
---

# Regional Sales Tax — Support Playbook

Sprint 7 (`../../launch-scope.md` section 12). The buyer's billing country
is the address in their private account details (2026-10-08, `20261008_150`,
[`../profiles/account-details.md`](../profiles/account-details.md)); nothing is chosen at checkout. For a country Made for Stream collects tax in,
the API calculates tax with Stripe Tax and charges it as its own line.
Tax is swept to the platform inside the application fee, and a Stripe Tax
transaction is recorded on the platform account once the payment is paid.
Refunds reverse tax proportionally, line by line. Money is always
involved: a tax problem is either a buyer charged the wrong amount or a
filing that will not reconcile.

**Collection is off by default.** `STRIPE_TAX_COLLECTION_COUNTRIES` ships
empty. Every payment is recorded as `tax_treatment = 'not_collected'`
with its billing country until a tax professional has advised on:

- which jurisdictions to register in, and in what order;
- whether the buyer fee, tip and contribution are separately taxable;
- whether the platform can be the deemed supplier while the charge is a
  direct charge on the creator's account.

**Rehearsal settings (owner's decision, 2026-10-12; test mode only).** So
that the tax path is exercised before launch, the dev environment collects
in every country the site serves, taxes the project amount and the buyer
service fee, and does **not** tax the tip or the contribution
(`STRIPE_TAX_CODE_TIP` and `STRIPE_TAX_CODE_SUPPORT` set to Stripe's
non-taxable code). This answers the second question for the rehearsal only.
It is not the adviser's answer, and production stays empty until that
arrives. The exact values are in `docs/launch-rehearsal-runbook.md`.

The questions for the adviser are in
[`../../tax-adviser-questions.md`](../../tax-adviser-questions.md), and what
each answer would change is in
[`../../tax-answers-to-work.md`](../../tax-answers-to-work.md).

This is the advice gate in the Sprint 7 checklist. Until it clears, most
of the issues below cannot happen in production. They exist so the
feature is supportable the day a country is switched on.

**How a country gets switched on.** Both of these are needed, and neither
is a code change:

1. Add the registration in the Stripe Dashboard (Tax → Registrations) on
   the **platform** account. Stripe Tax only calculates tax where a
   registration exists, so without it every calculation returns zero.
2. Add the country to `STRIPE_TAX_COLLECTION_COUNTRIES`, and set all four
   `STRIPE_TAX_CODE_*` values (see `api/.env.example`). Enabling a
   country with any code unset makes checkout refuse (`TAX-005`). This is
   deliberate: an unset code would silently answer the advice gate's
   fee-taxability question.

**Charge model.** Payments are direct charges on the creator's connected
account (launch-scope.md section 3.4). Stripe Tax does not support
platform liability on direct charges, so tax is calculated with the Tax
Calculation API on the platform account, not with Checkout's
`automatic_tax`. Do not "fix" a tax issue by enabling `automatic_tax` on
the session: that makes the creator's account the liable party.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Checkout says to choose my billing country" / "Checkout won't open after I picked a country" | [`TAX-001`](#tax-001--checkout-refused-at-the-tax-step) |
| "Why was I charged tax?" / "Why wasn't I charged tax?" / "The tax is for the wrong country" | [`TAX-006`](#tax-006--buyer-questions-the-tax-on-a-payment) |
| (internal) A taxed payment's location evidence is insufficient or contradictory | [`TAX-002`](#tax-002--location-evidence-insufficient-or-contradictory) |
| (internal) A taxed payment has no Stripe Tax transaction | [`TAX-003`](#tax-003--taxed-payment-missing-its-stripe-tax-transaction) |
| (internal) A refund returned tax but Stripe Tax was not reversed, or the ledger tax disagrees | [`TAX-004`](#tax-004--refund-tax-not-reversed-or-ledger-mismatch) |
| (internal) Every checkout fails with "Tax collection is enabled but …" | [`TAX-005`](#tax-005--tax-configuration-incomplete) |
| (internal) Ops alert: a sale was paid in a currency other than CAD or USD | [`TAX-007`](#tax-007--paid-sale-in-a-currency-whose-tax-advice-is-open) |
| (internal) Ops alert: a tax report or the GST/HST return is due or overdue | [`TAX-008`](#tax-008--tax-report-or-return-due) |

---

## `TAX-001` — Checkout refused at the tax step

```yaml
id: TAX-001
tier: 2
signals:
  - source: api
    match: "Add your account details in Settings before paying."
    where: "POST /api/stripe/checkout/session (also shown by the checkout page itself)"
  - source: api
    match: "Your account details could not be read. Please try again."
    where: "POST /api/stripe/checkout/session"
  - source: api
    match: "/Location evidence could not be recorded: /"
    where: "POST /api/stripe/checkout/session"
  - source: db
    match: "/Tax jurisdiction [A-Z]{2} does not match the buyer's recorded billing country/"
    where: "set_listing_request_payment_tax()"
  - source: stripe
    match: "/customer_tax_location_invalid|address/i"
    where: "stripe.tax.calculations.create (platform account)"
auto_fix: none
reason_not_automatable: "the fix is usually buyer input (country or postal code); anything else is a code or Stripe-side fault that needs a person"
escalate_with:
  - "payment id and the exact error text"
  - "public.listing_request_payment_tax_evidence rows for the payment"
  - "the billing country the buyer chose, and whether that country is in STRIPE_TAX_COLLECTION_COUNTRIES"
```

**Cause.** `applyCheckoutTax` in `api/server.js` runs before any Stripe
session is created or reused. It reads the buyer's country, province or
state and postal code from `public.user_account_details` and uses them as the
billing location, whatever the checkout page sent. A buyer with no details,
or a failed read, is refused. It records the country as
`billing_address_declared` evidence (`source` is `account_details`), and records the IP country too if
`TAX_IP_COUNTRY_HEADER` is set. For a collecting country it then calls
Stripe Tax. Stripe Tax rejects addresses it cannot place: US calculations
need a ZIP code, and Canadian ones need a province.
`set_listing_request_payment_tax` refuses any jurisdiction that doesn't
match the declared billing country on record.

**What the user sees.** The billing-country prompt on the checkout page,
or a red error box after accepting the policies.

**Fix.** A buyer told to add their account details saves the form in
Settings → Personal details (`ACC-001` in
[`../profiles/account-details.md`](../profiles/account-details.md)); one whose
country is wrong corrects their address there. "Could not be read" is a
database fault or a missing migration (`ACC-004`): retry, and escalate if it
repeats. A buyer can still change their address before paying; a declared
country that disagrees with the card or IP country is
[`TAX-002`](#tax-002--location-evidence-insufficient-or-contradictory),
which is where a wrong country is caught. If the error names
an address, ask them to correct the postal/ZIP code in their account details. Then reload the checkout
page and continue. A jurisdiction-mismatch error from the database
should not be reachable from the UI; escalate it.

**If the fix does not work.** Escalate with the evidence rows. A
`Pre-payment location evidence cannot change after checkout has
completed` error means the buyer is retrying a payment that has already
gone through. Check its status instead.

**Money impact.** None. Nothing has been charged yet.

---

## `TAX-002` — Location evidence insufficient or contradictory

```yaml
id: TAX-002
tier: 2
signals:
  - source: db
    match: "get_listing_request_payment_tax_evidence_status(payment_id).evidence_status in ('insufficient', 'contradictory') for a paid payment with tax_treatment = 'calculated'"
    where: "public.listing_request_payment_tax_evidence"
  - source: api
    match: "/TAX-002: recording (card_issuer|billing_address_checkout) evidence failed/"
    where: "finalizePaidPaymentTaxBestEffort (api/server.js), server logs"
auto_fix: none
reason_not_automatable: "deciding which country a supply belongs to when evidence conflicts is a tax judgement (EU Implementing Regulation 282/2011 art. 24b/24f), not a data fix"
escalate_with:
  - "all evidence rows for the payment (type, country, source, captured_at)"
  - "the payment's tax_jurisdiction_country, tax lines and stripe_tax_transaction_id"
```

**Cause.** EU VAT needs two non-contradictory pieces of evidence of the
buyer's location. Evidence comes in three categories: billing address
(the country the buyer declared, and the address Stripe Checkout
collects), IP address, and card-issuing country. The two billing-address
rows are one category, so they only ever count once.
`get_listing_request_payment_tax_evidence_status` returns:

- `sufficient`: two categories agree on the taxed country.
- `contradictory`: two categories agree on some other country.
- `insufficient`: neither of the above.

Before payment there is usually only one category, because the IP header
is not configured today. The card country recorded after payment is
normally what makes the evidence sufficient.

Signal query. Alerted hourly since Sprint 9: `list_ops_alerts()` emails ops as `tax_evidence_insufficient` (TAX-002), once, then daily while it stays open. See [`operations/alerting.md`](../operations/alerting.md).


```sql
select p.id, p.paid_at, p.tax_jurisdiction_country, s.*
from public.listing_request_payments p
cross join lateral public.get_listing_request_payment_tax_evidence_status(p.id) s
where p.tax_treatment = 'calculated'
  and p.status in ('paid', 'partially_refunded', 'refunded')
  and s.evidence_status <> 'sufficient';
```

**What the user sees.** Nothing. This is internal.

**Manual fix.** For `insufficient`, check whether the post-payment
evidence failed to record (a `TAX-002` log line). If so, read the card and
billing country from the Stripe charge on the connected account, and
record them with `record_listing_request_payment_tax_evidence` (service
role). For `contradictory`, escalate to whoever owns tax filings with the
evidence. Tax may have been charged for the wrong country, and correcting
that is a refund-and-recharge or filing adjustment decision.

**Money impact.** Possible wrong-country tax on a completed payment.

---

## `TAX-003` — Taxed payment missing its Stripe Tax transaction

```yaml
id: TAX-003
tier: 2
signals:
  - source: api
    match: "/TAX-003: finalizing tax for payment .* failed/"
    where: "finalizePaidPaymentTaxBestEffort (api/server.js), server logs"
  - source: db
    match: "tax_treatment = 'calculated' and status in ('paid','partially_refunded','refunded') and stripe_tax_transaction_id is null"
    where: "public.listing_request_payments"
auto_fix: none
reason_not_automatable: "Stripe Tax calculations expire; recreating one after the fact must use the original tax_date and amounts, which needs a person to check"
escalate_with:
  - "payment id, stripe_tax_calculation_id, paid_at"
  - "the TAX-003 log line"
```

**Cause.** After a payment is paid, the webhook commits the calculation
with `tax.transactions.createFromCalculation` on the platform account.
This is what puts the sale in Stripe Tax's filing exports. The step never
fails the webhook, so a failure only shows up in the log and in the query
below. A webhook redelivery retries it, and so does the paid-retry branch.
Alerted hourly since Sprint 9: `list_ops_alerts()` emails ops as `tax_transaction_missing` (TAX-003), once, then daily while it stays open. See [`operations/alerting.md`](../operations/alerting.md).

```sql
select id, paid_at, stripe_tax_calculation_id
from public.listing_request_payments
where tax_treatment = 'calculated'
  and status in ('paid', 'partially_refunded', 'refunded')
  and stripe_tax_transaction_id is null
  and paid_at < now() - interval '1 hour';
```

**What the user sees.** Nothing. The buyer was charged correctly.

**Manual fix.** If the calculation has not expired, create the transaction
from it (reference = the payment id), then call
`set_listing_request_payment_tax_transaction`. If it has expired, create
the transaction from a fresh calculation dated to `paid_at` with the
stored per-line amounts, and check that its tax equals `tax_cents`.

**Money impact.** Tax was collected but is missing from the filing export.
It would be under-reported unless fixed before the filing period closes.

---

## `TAX-004` — Refund tax not reversed, or ledger mismatch

```yaml
id: TAX-004
tier: 2
signals:
  - source: api
    match: "/TAX-004: tax reversal for refund .* failed/"
    where: "reverseRefundTaxBestEffort (api/server.js), server logs"
  - source: db
    match: "tax_refund_cents > 0 and stripe_tax_reversal_id is null"
    where: "public.listing_request_payment_refunds"
auto_fix: none
reason_not_automatable: "the Stripe refund has already happened; the reversal has to match the ledger exactly, per line"
escalate_with:
  - "refund ledger row (all *_tax_refund_cents columns), stripe_refund_id"
  - "the payment's stripe_tax_transaction_id and per-line tax"
  - "the TAX-004 log line -- especially if it says the ledger tax does not match"
```

**Cause.** A refund returns tax proportionally, following the same
cumulative pattern as the fees (Refund Policy section 8):

- Base and buyer-fee tax follow the cumulative base refunded.
- Tip and contribution tax follow the tip or contribution refunded.
- Rounding happens once, against the original tax. A line that has been
  fully refunded returns exactly what is left.

`api/refundArithmetic.js` decides the Stripe amounts, and
`apply_refunded_listing_request_payment` writes the ledger. After
writing, the route re-reads the ledger row and checks it matches. It then
reverses those lines on the Stripe Tax transaction. Neither step throws,
because the money has already moved.

```sql
select r.id, r.payment_id, r.stripe_refund_id, r.tax_refund_cents
from public.listing_request_payment_refunds r
where r.tax_refund_cents > 0 and r.stripe_tax_reversal_id is null;
```

Alerted hourly since Sprint 9: `list_ops_alerts()` emails ops as `tax_reversal_missing` (TAX-004), once, then daily while it stays open. See [`operations/alerting.md`](../operations/alerting.md). The
alert waits an hour after the refund, so an in-flight reversal isn't reported.

**What the user sees.** Nothing. The buyer got the right refund.

**Manual fix.** Create the partial reversal by hand:
`tax.transactions.createReversal`, `mode=partial`, reference = the Stripe
refund id, one negative line per refunded line (matched by the original
line's `reference`), using the ledger row's amounts. Then call
`set_listing_request_payment_refund_tax_reversal`. **A ledger/Stripe
mismatch means the SQL and JS copies of the arithmetic have diverged.
That is a code bug: stop and escalate. Don't patch the row.**

**Money impact.** Over-reported tax in the filing export until reversed.
A mismatch may also mean the buyer received a slightly different tax
refund than the ledger records.

---

## `TAX-005` — Tax configuration incomplete

```yaml
id: TAX-005
tier: 2
signals:
  - source: api
    match: "/Tax collection is enabled but STRIPE_TAX_CODE_.* (is|are) not set\\./"
    where: "POST /api/stripe/checkout/session"
auto_fix: none
reason_not_automatable: "the missing value is a tax-advice decision (whether that line is taxable), not a default an agent may choose"
escalate_with:
  - "the current STRIPE_TAX_COLLECTION_COUNTRIES value (not the secret keys)"
```

**Cause.** A country was listed in `STRIPE_TAX_COLLECTION_COUNTRIES`
without every `STRIPE_TAX_CODE_*` being set. `parseTaxConfig` fails
closed, and **every** checkout refuses, not just checkouts in that
country.

**What the user sees.** Every buyer gets that error at checkout.

**Manual fix.** Either set the missing codes to the values the tax advice
specifies, or empty `STRIPE_TAX_COLLECTION_COUNTRIES` to switch collection
off again. Redeploy the API either way.

**Money impact.** None charged, but all checkout is blocked until fixed.

---

## `TAX-006` — Buyer questions the tax on a payment

```yaml
id: TAX-006
tier: 2
signals:
  - source: client
    match: "/why (was|wasn't) I charged tax|wrong (country|tax)/i"
auto_fix: none
reason_not_automatable: "explaining or disputing tax treatment for a specific buyer is a tax question"
escalate_with:
  - "payment id, tax_treatment, tax_jurisdiction_country/region, per-line tax"
  - "evidence rows and get_listing_request_payment_tax_evidence_status for the payment"
```

**Cause.** Tax depends only on the billing country the buyer chose and on
whether Made for Stream collects in that country. `not_collected` means
no tax was added, which is expected almost everywhere while the advice
gate is open. `calculated` shows the amount Stripe Tax returned for each
line.

**What the user sees.** A "Tax (XX)" line on the checkout summary and in
Stripe Checkout.

**Manual fix.** Explain which country the tax was for, using the payment
record. If the buyer says the country was wrong, check the evidence
(`TAX-002`). A buyer who claims a business VAT exemption cannot be
handled yet (see Known gaps: reverse charge). Escalate.

**Money impact.** Only if the treatment was actually wrong.

---

## `TAX-007` — Paid sale in a currency whose tax advice is open

```yaml
id: TAX-007
tier: 2
signals:
  - source: alert
    match: "paid_wave2_currency (TAX-007)"
    where: "public.list_ops_alerts(), emailed by POST /api/internal/ops/alerts/run"
  - source: db
    match: "currency not in ('cad', 'usd') and paid_at is not null"
    where: "public.listing_request_payments"
auto_fix: none
reason_not_automatable: "whether and where to register for VAT/GST is the open tax advice, not a support action"
escalate_with:
  - "payment id, currency, paid_at, and the buyer's billing country (tax_jurisdiction_country)"
  - "how many such payments there are so far"
```

**Cause.** `20260923_138` enables EUR, GBP and the other two-decimal majors
alongside CAD and USD (decided 2026-09-23), before the tax advice is in.
Nothing stops a live EUR or GBP sale while collection is off everywhere, and
EU VAT applies from the first sale with no small-seller threshold.

```sql
select id, currency, status, paid_at, tax_jurisdiction_country
from public.listing_request_payments
where currency not in ('cad', 'usd') and paid_at is not null
order by paid_at;
```

The alert covers every status a paid payment can reach (refunded, disputed),
not just `paid`. It's emailed **once per payment and never repeated**, since
these rows never clear on their own.

**What the user sees.** Nothing. This is internal.

**Fix.** Take the first one as the prompt to chase the tax advice. The
payment itself is fine; don't refund or alter it. Record the count for
whoever is advising.

**Money impact.** Possible tax liability on the sale that isn't being
collected or filed.

---

## `TAX-008` — Tax report or return due

```yaml
id: TAX-008
tier: 2
signals:
  - source: alert
    match: "tax_report_due (TAX-008)"
    where: "public.list_ops_alerts(), emailed by POST /api/internal/ops/alerts/run"
  - source: ui
    match: "Only an administrator can see tax reporting."
    where: "src/pages/admin/AdminTaxReporting.tsx (admin_get_tax_reporting_overview, admin_list_tax_report_sellers)"
  - source: ui
    match: "That report period is not on the tax calendar."
    where: "admin_set_tax_report_filed"
auto_fix: none
reason_not_automatable: "filing is done by the owner on each tax authority's own site"
escalate_with:
  - "the report name and period from the email"
  - "whether the report was filed, and its confirmation number"
```

**What it is (2026-10-28, `20261028_170`).** Made for Stream reports each
creator's earnings to the tax authority of the country the creator lives in,
and files its own GST/HST return. The admin **Tax reporting** page
(`/admin/tax-reporting`) lists every report from launch onwards with its
due date, how many creators it covers and whether it is marked filed. The
ops email lists an unfiled report **30, 14, 7 and 1 days** before it is due
and **every day** once overdue. Each step is a separate email line, sent
once.

| Report | Creators it covers | Period | Due |
| --- | --- | --- | --- |
| EU DAC7 | living in an EU country | calendar year, figures by quarter | 31 January |
| Canada (CRA) | living in Canada | calendar year | 31 January |
| UK (HMRC) | living in the UK | calendar year | 31 January |
| New Zealand (Inland Revenue) | living in New Zealand | calendar year | 31 January |
| Australia (ATO) | living in Australia | each half year | 31 July and 31 January |
| US Form 1099-K | living in the US, paid over $20,000 in more than 200 payments | calendar year | 31 January to the creator; 31 March to the IRS by e-file |
| GST/HST return | Made for Stream itself | calendar year (annual filer) | pay by 30 April, file by 15 June |

Where a creator lives is their account address country, or their Stripe
account's country when they have no account details. A creator report is
only emailed when it has at least one creator to report; the GST/HST return
always is. Reports due before 1 October 2026 are ignored.

**Fix (filing a report).**

1. Open Tax reporting and choose the report. The table shows each creator's
   payments, amount paid (the work and the tip), refunds and the creator fees
   Made for Stream kept, by currency and quarter, and lists missing details
   (tax number, date of birth, address).
2. Ask any creator with missing details to complete them in Settings →
   Personal details, then reload.
3. Download the file. It holds private identity details: keep it off shared
   drives and delete it after filing.
4. File it in that authority's own format on its own site. The file is the
   working copy; it is not in any authority's upload format.
5. Press **Mark as filed** and enter the confirmation number. The reminders
   stop. **Undo** brings them back.

For the GST/HST return, use Made for Stream's fee income for the year
together with Created by Alvin's: it is one return for the same business
number.

**Before the first report of each kind (owner's steps).**

- DAC7: register with one EU country's tax authority once the first EU
  creator is paid. That country is where every DAC7 report is filed. Once
  registered, some countries expect a report even in a year with no EU
  creators: check with that country, because this page only reminds you when
  there is someone to report.
- UK, Canada, New Zealand and Australia: register for each authority's
  platform reporting service before the first due date.
- 1099-K: Stripe can file these for a fee (Stripe Dashboard → Connect → Tax
  forms).

**Money impact.** Late or missing reports carry penalties from each
authority.

---

## Known gaps

- **Not in any authority's upload format.** The Tax reporting file is a
  spreadsheet of the figures and identity details; each authority has its
  own XML format or online form.
- **The creator's full bank account number is not stored.** DAC7 asks for
  the account the creator is paid into. Stripe gives Made for Stream only the
  last four digits, so it has to be asked from the creator.
- **The GST/HST schedule assumes an annual filer.** A quarterly or monthly
  filer changes `tax_reporting_obligations()`.
- **Amounts are by currency, not converted.** Each authority's conversion
  rule is applied when filing.

- **Wave 2 currencies are enabled before the advice.** Tracked as
  [`TAX-007`](#tax-007--paid-sale-in-a-currency-whose-tax-advice-is-open), which
  alerts on the first paid non-CAD/USD sale.

- **The advice gate is open.** Collection is off everywhere. Nothing here
  decides which jurisdictions Made for Stream must register in, whether
  the fees, tip and contribution are separately taxable, or whether the
  platform can be the deemed supplier on a direct charge. Enabling a
  country before that advice exists is a policy decision, not a support
  action.
- **EU B2B reverse charge is not applied.** The buyer's VAT ID is not
  collected. Stripe Tax applies reverse charge when a valid tax id is
  passed in `customer_details.tax_ids`, so the remaining engineering is
  small, but who the supplier is (and so whether reverse charge applies
  at all) is part of the advice gate. Creator tax status is stored for
  when it's needed (`creator_payment_accounts.tax_entity_type`,
  `tax_id_types`), but it isn't used, and no registration status is
  derived from it. The v2 identity payload shape it reads is unverified
  against a live account.
- **Refunds issued outside the app** (`webhook_external` in
  `refunds-and-disputes.md` REF-002) go through the same SQL function, so
  the ledger attributes tax to them on a best-effort base. But no Stripe
  Tax reversal is created for them, so they need manual `TAX-004`
  handling.
- **No IP evidence in production yet.** `TAX_IP_COUNTRY_HEADER` needs a
  proxy that sets a geo header, such as Cloudflare's `cf-ipcountry`. The
  API on Cloud Run gets none by default, so the card country recorded
  after payment is the second piece of evidence.
- **Tax on the creator's platform fee (commission)** is a separate
  question from everything above and isn't modelled.
- **Never exercised against real Stripe Tax.** Migration
  `20260923_137` is written but not applied, and no test-mode calculation,
  transaction or reversal has been run. The API shapes follow Stripe's
  published reference, checked when this was written.
