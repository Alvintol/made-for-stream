---
feature: payments/sales
status: active
surfaces:
  - public.paid_payment_details                  # 20261102_180
  - public.canada_sales_tax_bps()                # the rates
  - public.record_paid_payment_details()
  - public.record_details_when_payment_paid()    # trigger on listing_request_payments
  - public.sale_movements()
  - public.completed_sales()                     # 20261103_181
  - public.sales_by_period()
  - public.sales_chart_range()
  - public.my_sales_summary()
  - public.my_sales()                            # the transactions
  - public.my_completed_sales()
  - public.my_sales_chart()
  - public.admin_sales_summary()
  - public.admin_sales()                         # the transactions
  - public.admin_completed_sales()
  - public.admin_sales_chart()
  - public.sales_chart_window()                  # 20261103_184
  - public.check_sales_kind()
  - public.my_tax_summary()                      # 20261103_185
  - public.creator_sees_buyer_region()
  - public.policy_acceptances                    # privacy 2026-11-03-3
  - src/components/sales/CreatorTaxHelp.tsx
  - src/components/sales/CreatorTaxRegions.tsx
  - src/pages/creator/CreatorStatement.tsx       # /creator/earnings/statement/:year
  - src/components/sales/MonthPicker.tsx
  - src/components/sales/CreatorEarningsChart.tsx
  - src/components/sales/AdminSalesChart.tsx
  - public.get_payment_invoice()
  - public.user_account_details                  # show_tax_number_on_invoices
  - src/domain/payments/sales.ts
  - src/hooks/payments/useSales.ts
  - src/components/sales/
  - src/pages/creator/CreatorSales.tsx
  - src/pages/admin/AdminSales.tsx
  - src/pages/payments/PaymentInvoice.tsx
unmatched_tier: 2
---

# Sales numbers, GST/HST and invoices — Support Playbook

Made for Stream's fees and contributions include any GST/HST. Nothing is added at
checkout, and no amount anyone pays changes. These pages only work out how much of
each amount is tax to set aside.

**The rate.** It follows the customer's address, not Alberta (CRA Memorandum 3-3-6).
The buyer's province sets the rate for the buyer fee and contribution, and the
creator's province sets it for the creator fee. Alberta and the other GST-only places
are 5%, Ontario 13%, Nova Scotia 14%, and New Brunswick, Newfoundland and Labrador and
PEI 15%. Outside Canada it's 0%, which assumes the fee is zero-rated. A rate change is
a new migration editing `canada_sales_tax_bps()`.

**Sales and transactions.** A sale is one completed commission or listing, however many
payments it took. It counts on the day the project completed, with all its payments
added together less refunds, even when they were paid in other months. A transaction
is one payment or refund, and it counts on the day the money moved. So a milestone
project paid in October and November and completed in November is one November sale,
with a transaction in each month. A project that's cancelled, still in progress or
refunded in full isn't a sale, but its payments stay under Transactions.

Earnings, fees and tax follow the transactions, because that's when the money moved
and when tax is due. That's why Total sales less fees won't always equal earnings in a
single month.

**The numbers.** The tax inside an amount is `amount × rate ÷ (1 + rate)`, so $100 at
13% holds $11.50. Tax is rounded per sale. When a payment is paid, a trigger records
the place, rate and seller's details in `paid_payment_details`, so a later change of
address or rate never rewrites an old sale.

| On the page | What it means |
| --- | --- |
| Creator: Total sales | The work and tips on projects completed that month, less refunds |
| Creator: Transactions | The work and tips paid that month, less refunds |
| Creator: Total earnings | Transactions less the creator fee, before Stripe's costs |
| Creator: Fees to Made for Stream | The creator fee on those transactions, less fees given back on refunds |
| Admin: Total sales | Everything buyers paid on projects completed that month, less refunds |
| Admin: Transactions | Everything buyers paid that month, less refunds |
| Admin: Fees and support | The buyer fee, creator fee and contributions kept |
| Admin: Tax to set aside | The GST/HST inside those fees |
| Admin: Total earnings | Fees and support less that tax, before your own costs |

**Where things are.** A creator's dashboard shows the graph, with Needs your
attention and this month's earnings and completed count beside it, lined up with
its bottom; the latest commissions run full width below. That card is always the current month
(since V0.15.01): other months are on the graph and the Earnings page. Their **Earnings** page (`/creator/earnings`;
the old `/creator/sales` address sends people there) has each completed sale with its
fee and each transaction. The fee total isn't shown as a card. The admin dashboard has
the month's cards and the graph; the admin Sales page has the tax table, sales by
region and the lists. Months are chosen from a calendar, so a typed month like
"2026-13" can't happen.

**The graphs.** They show the last 7, 28 or 90 days, the last 12 months, a whole year,
or any dates up to two years apart. Up to 92 days is a line by day; longer is bars by
month. A filter shows commissions, instant downloads or both. Since V0.16.02 the graph
never changes size. Show and Period are its only fields: the Period list holds the
rolling periods, the last three years and Custom dates. Custom dates open a modal
with From, To and Use these dates; until they're used, or if the modal is
cancelled, the graph keeps its period, and the chosen dates show under "Over
time" with a Change link. A second currency is chosen in the totals row, and Show
as a table opens the table in a modal. An empty period keeps the totals row (with
"–") and the graph's height. The dashboard's month cards are always the same
two; sales in other currencies are a link to the Earnings page. They read the same totals
as the month cards. A graph shows one currency at a time, and a refund can take a day
below zero. `sales_chart_window()` refuses an end before the start ("Choose a start
date before the end date.") and `check_sales_kind()` refuses any other kind ("Choose
commissions, instant downloads or everything."); the website stops both first.

**Sales by region.** The admin Sales page adds up, for the month, what buyers in each
country and state or province paid, less refunds, with the GST/HST on their side. It
uses the buyer's `buyer_country` and `buyer_region` saved in `paid_payment_details`
when the payment was made. Sales from before 2026-11-03 use the place recorded at
checkout, or else the buyer's address at that date, which may have changed. US sales
tax is owed by state once sales there pass that state's limit, so these totals are
what to watch; nothing here charges US tax.

**Tax help for creators.** At the bottom of the Earnings page, `my_tax_summary()` gives a
creator a year of estimates for their own tax records:

- Earnings for the year, and the fees Made for Stream charged with the GST/HST inside them.
  A registered creator can usually claim that GST/HST back; the fees are a business expense.
- For a creator whose account country is Canada, their Canadian-dollar sales over the last
  four calendar quarters against the $30,000 small supplier limit, with a warning past it.
  It counts Made for Stream sales only, downloads included.
- Their sales by the buyer's country and province or state. For buyers in Canada, and
  only for a creator in Canada, the GST/HST rate there and that rate on the commission
  sales, on top of the price. Downloads are left out of that column because Made for
  Stream pays their GST/HST. The rate is the one saved with each payment.

A region row reads **Not shared** when the buyer paid before accepting Privacy Policy
version 2026-11-03-3, which is what tells buyers creators see their region.
`creator_sees_buyer_region()` checks for that acceptance, dated on or before the payment;
a refund follows its payment. Those payments still count in every total. It refuses a
year before 2020 or after this one ("Choose a year from 2020 to this one.", 22023).

**Yearly statement.** Tax help's **Yearly statement** button opens
`/creator/earnings/statement/:year`, one page to print or save as a PDF. It shows the
creator's legal or business name, address and tax number from their own personal
details, the year's totals from `my_tax_summary()`, each month from `my_sales_chart()`
(added up by month on the page, because the first 92 days of a year come back by day),
and sales by region. It says it isn't a government tax form. It reads nothing new from
the database. A year before 2020 or after this one shows "There's no statement for that
year." without asking the database.

Days and months run in UTC, the same as the tax reports. A refund counts in the month
it was made, as a negative amount. Each currency has its own row, because amounts in
different currencies can't be added. Money in US dollars is converted when the return
is filed.

**Privacy.** Creators see where buyers are only in the tax help's region table: the
country and province or state, added up for the year, and only for payments made after
the buyer accepted the 2026-11-03-3 Privacy Policy. Never a street address, city or
postal code, and never the place of a single sale: the lists and the invoice still leave
out the buyer's place and rate. A creator with one buyer in a place can still tell which
sale it was, and the policy says so. The
buyer's `tax_jurisdiction_*` columns aren't readable from the browser, and
`paid_payment_details` is read only through these functions. New columns on
`listing_request_payments` are private until a migration grants them.

**Tax numbers on invoices.** A creator opts in under Settings → Personal details. Their
business name, or legal name if they have none, then appears with the number. Invoices
keep the name and number from the day of the sale.

**Made for Stream's own number.** It appears on invoices once `VITE_PLATFORM_TAX_NUMBER`
is set in the site's settings. It isn't a secret: it's printed on receipts.

**Stripe Tax stays off.** `STRIPE_TAX_COLLECTION_COUNTRIES` must stay empty, or tax is
added on top of the price. See [`tax.md`](tax.md).

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Your sales could not be loaded." or "Sales could not be loaded." | [`SALE-001`](#sale-001--the-sales-pages-do-not-load) |
| "That invoice could not be found." | [`SALE-002`](#sale-002--an-invoice-does-not-open) |
| Can't tick "Show my tax number on invoices" | [`SALE-003`](#sale-003--a-tax-number-is-refused) |
| The admin page warns about an unknown location | [`TAX-009`](#tax-009--a-sale-has-no-known-location) |
| "My earnings don't match my payout" | Expected: earnings are before Stripe's costs, and payouts run on their own schedule |
| "My milestone payment isn't in my sales" | Expected until the project completes. It's under Transactions now |
| "Sales less fees doesn't equal my earnings" | Expected: sales land when a project completes, and earnings when each payment is made |
| "Last month's total sales changed" | Expected: a refund on a completed project lowers that sale's total |
| "The tax looks a cent off" | Expected: tax is rounded per sale |
| A creator asks where a buyer lives | Refuse anything beyond the tax help's region totals |
| A creator's region table says "Not shared" | Expected: those buyers paid before accepting the updated Privacy Policy |
| A creator in Canada sees no GST/HST rate column | Their account country isn't Canada (Settings → Personal details) |
| The statement says "Add your legal name and address in Settings → Personal details" | Expected: they haven't filled in their personal details yet |
| A creator asks for a T4A, T5018 or 1099 | Made for Stream doesn't issue tax forms yet: the yearly statement is a record, not a form. See the checklist's accountant question |
| "My $30,000 total doesn't match my own records" | Expected: it counts Made for Stream sales only, in Canadian dollars |

---

## `SALE-001` — The sales pages do not load

```yaml
id: SALE-001
tier: 2
signals:
  - source: client
    match: "/Could not find the function public\\.(my_tax_summary|my_sales_summary|my_sales|my_completed_sales|my_sales_chart|admin_sales_summary|admin_sales|admin_completed_sales|admin_sales_chart)/"
    where: "PostgREST PGRST202 on /rest/v1/rpc/*"
  - source: client
    match: "Only an administrator can see sales."
    where: "admin_sales_summary(), admin_sales(), admin_completed_sales() and admin_sales_chart(), Postgres 42501"
  - source: client
    match: "Choose a year from 2020 to this one."
    where: "my_tax_summary(), Postgres 22023; the website only offers this year and the two before"
auto_fix: none
reason_not_automatable: "applying a migration is the owner's step"
escalate_if:
  - "the functions exist and the pages still fail"
  - "a creator can see another creator's sales"
```

**Cause.** The website went out before its migration (180, 181, 184 or 185), or someone without an admin
role opened the admin page.

**What the user sees.** The load error on the graph, the lists or the dashboard's
This month's sales.

**Fix.** Check the functions exist. If they don't, apply
`20261102_180_add_sales_numbers_and_invoices.sql` or
`20261103_181_group_sales_by_completed_project.sql`, or for the tax help
`20261103_185_add_creator_tax_help.sql`.
**Money impact.** None. These pages only read.

---

## `SALE-002` — An invoice does not open

```yaml
id: SALE-002
tier: 2
signals:
  - source: client
    match: "That invoice could not be found."
    where: "get_payment_invoice(), Postgres P0002"
auto_fix: none
reason_not_automatable: "it depends on who asked for which payment"
escalate_if:
  - "the buyer or creator of a paid payment is refused"
```

**Cause.** The payment hasn't been paid, or the person isn't its buyer, its creator or
an admin. A stranger gets the same message as a payment that doesn't exist, on purpose.

**Fix.** Check `paid_at` on the payment. Unpaid payments have no invoice.

**Money impact.** None.

---

## `SALE-003` — A tax number is refused

```yaml
id: SALE-003
tier: 2
signals:
  - source: client
    match: "This looks like a social insurance or social security number."
    where: "validateAccountDetails in src/domain/settings/accountDetails.ts"
  - source: db
    match: "user_account_details_invoice_tax_number_check"
    where: "check constraint, 20261102_180"
auto_fix: none
reason_not_automatable: "only the creator knows their number"
escalate_if:
  - "a valid sales tax number is refused"
```

**Cause.** The number is nine digits alone, the shape of a SIN or SSN, and buyers would
see it. A GST/HST number has its RT0001 ending. A US EIN is also nine digits, so it's
refused too.

**Fix.** Ask for the full sales tax number. Never ask for a SIN or SSN.

**Money impact.** None.

---

## `TAX-009` — A sale has no known location

```yaml
id: TAX-009
tier: 2
signals:
  - source: db
    match: "TAX-009: paid payment details could not be recorded for"
    where: "record_details_when_payment_paid(), a Postgres warning in the database logs"
  - source: client
    match: "Some sales have no known location"
    where: "src/pages/admin/AdminSales.tsx"
auto_fix: none
reason_not_automatable: "the right province is a judgment about a real customer before a tax filing"
escalate_if:
  - "more than a handful of sales are affected"
```

**Cause.** Recording a sale's details failed, or a creator's address has no province
(`CA-?`, from a Stripe account's country with no account details). Recording never
stops a payment being marked paid, because the money has already moved.

**What the user sees.** Nothing. The admin page warns, and counts the sale at 5%.

**Fix.** Read the buyer's and creator's account details for the payment, then run
`select public.record_paid_payment_details('<payment id>');`. It does nothing if a row
already exists. For a `CA-?` row, delete that row first, once the address is filled in.

**Money impact.** The tax figure can be low: in Ontario the true tax is more than 5%.
Fix it before filing.

---

**Instant downloads.** A download is a sale on the day it's paid, since it
completes itself then. Its GST/HST is on the whole price at the buyer's rate, and
there's no creator-side tax, so the admin tax table counts the whole price as the
taxable amount. See [`../listings/instant-downloads.md`](../listings/instant-downloads.md).

## Known gaps
- **A lost chargeback still counts as a sale,** because disputes don't write to the
  refund ledger. Adjust the return by hand.
- **Earnings are before Stripe's costs.** They're charged on the creator's account and
  aren't recorded here.
- **Provincial sales tax isn't included.** BC, Manitoba and Saskatchewan have their own,
  and whether it applies to these fees is a question for the accountant.
- **Each page reads the whole month, and each graph its whole period.** That's fine into
  the tens of thousands of sales a month. Past that, keep daily totals in a table.
- **A refund changes an old month's sale.** Total sales shows each project as it stands
  now. Transactions and tax don't change: a refund counts in the month it was made.
- **Tax help is an estimate.** It leaves out sales made elsewhere, provincial sales tax and
  income tax, and treats GST/HST as on top of the price. Whether a creator's commissions
  are taxable, and how, is for their accountant.
- **Tax help is by calendar year only.** A creator who files GST/HST quarterly or monthly
  adds up the Earnings page's months instead.
- **Province names stay in English** in the creator's region table, in every language.
- **There's no monthly statement for creators by email.** The Sales page and each
  invoice are the record.
