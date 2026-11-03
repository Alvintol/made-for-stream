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

**Where things are.** A creator's dashboard shows the month's earnings and completed
count at the top, and the graph at the bottom. Their **Earnings** page (`/creator/earnings`;
the old `/creator/sales` address sends people there) has each completed sale with its
fee and each transaction. The fee total isn't shown as a card. The admin dashboard has
the month's cards and the graph; the admin Sales page has the tax table, sales by
region and the lists. Months are chosen from a calendar, so a typed month like
"2026-13" can't happen.

**The graphs.** They show the last 7, 28 or 90 days, the last 12 months, a whole year,
or any dates up to two years apart. Up to 92 days is a line by day; longer is bars by
month. A filter shows commissions, instant downloads or both. They read the same totals
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

Days and months run in UTC, the same as the tax reports. A refund counts in the month
it was made, as a negative amount. Each currency has its own row, because amounts in
different currencies can't be added. Money in US dollars is converted when the return
is filed.

**Privacy.** Creators are told nothing about where a buyer lives. Their pages and their
invoice leave out the buyer's place and rate, and the rate would give it away. The
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
| A creator asks where a buyer lives | Refuse. They aren't told |

---

## `SALE-001` — The sales pages do not load

```yaml
id: SALE-001
tier: 2
signals:
  - source: client
    match: "/Could not find the function public\\.(my_sales_summary|my_sales|my_completed_sales|my_sales_chart|admin_sales_summary|admin_sales|admin_completed_sales|admin_sales_chart)/"
    where: "PostgREST PGRST202 on /rest/v1/rpc/*"
  - source: client
    match: "Only an administrator can see sales."
    where: "admin_sales_summary(), admin_sales(), admin_completed_sales() and admin_sales_chart(), Postgres 42501"
auto_fix: none
reason_not_automatable: "applying a migration is the owner's step"
escalate_if:
  - "the functions exist and the pages still fail"
  - "a creator can see another creator's sales"
```

**Cause.** The website went out before migration 180 or 181, or someone without an admin
role opened the admin page.

**What the user sees.** The load error on the graph, the lists or the dashboard's
This month's sales.

**Fix.** Check the functions exist. If they don't, apply
`20261102_180_add_sales_numbers_and_invoices.sql` or
`20261103_181_group_sales_by_completed_project.sql`.
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
- **Dashboards show the month's cards, not the graph.** The graph is on the Sales pages.
- **There's no monthly statement for creators by email.** The Sales page and each
  invoice are the record.
