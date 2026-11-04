import { useState } from "react";
import { Link } from "react-router-dom";
import AdminSalesTotals from "../../components/sales/AdminSalesTotals";
import MonthPicker from "../../components/sales/MonthPicker";
import {
  formatFeeRateBps,
  formatPaymentCents,
} from "../../domain/payments/listingRequestPaymentDisplay";
import {
  currentSalesMonth,
  isUnknownTaxPlace,
  regionName,
  taxPlaceName,
  taxTotalsByCurrency,
} from "../../domain/payments/sales";
import {
  useAdminCompletedSales,
  useAdminSalesSummary,
  useAdminTransactions,
} from "../../hooks/payments/useSales";
const classes = {
  page: "space-y-6",
  header: "flex flex-wrap items-end justify-between gap-3",
  h1: "pageTitle",
  sub: "pageSub",
  months: "space-y-3",
  card: "card space-y-4 p-6",
  title: "font-display text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  tableWrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  total: "py-2 pr-4 font-bold tabular-nums text-zinc-900",
  link: "font-semibold text-[rgb(var(--accent-text))] hover:underline",
  refund: "font-semibold text-amber-700",
  more: "btnOutline btnSm",
  empty: "text-sm text-zinc-500",
  error: "notice noticeError",
  warning: "notice noticeWarning",
} as const;

// The whole site's month: totals, the GST/HST to set aside for each place,
// sales by the buyer's region, each completed sale and each transaction.
// The graph is on the admin dashboard. Playbook: docs/support/payments/sales.md.
const AdminSales = () => {
  const [month, setMonth] = useState(currentSalesMonth);
  const summary = useAdminSalesSummary(month);
  const sales = useAdminCompletedSales(month);
  const transactions = useAdminTransactions(month);

  const taxRows = summary.data?.tax ?? [];
  const regionRows = summary.data?.regions ?? [];
  const saleRows = sales.data?.pages.flatMap((page) => page.rows) ?? [];
  const transactionRows = transactions.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <div className={classes.page}>
      <Link to="/admin/dashboard" className="backLink">
        ← Back to admin dashboard
      </Link>

      <div>
        <h1 className={classes.h1}>Sales</h1>
        <p className={classes.sub}>
          A sale is one completed commission or listing. Transactions, fees and tax follow each
          payment. Days and months run in UTC, the same as the tax reports.
        </p>
      </div>

      <section className={classes.months}>
        <div className={classes.header}>
          <div>
            <h2 className={classes.title}>By month</h2>
            <p className={classes.text}>A refund counts in the month it was made.</p>
          </div>

          <MonthPicker
            value={month}
            onChange={setMonth}
            text={{ label: "Month", previousYear: "Previous year", nextYear: "Next year" }}
          />
        </div>

        <AdminSalesTotals month={month} />
      </section>
      <section className={classes.card}>
        <h2 className={classes.title}>Tax to set aside</h2>
        <p className={classes.text}>
          The GST/HST inside your fees and support, by the customer's province. It all goes on one
          GST/HST return, and amounts in US dollars are converted to Canadian when you file.
        </p>

        {taxRows.some((row) => isUnknownTaxPlace(row.place)) && (
          <div className={classes.warning}>
            Some sales have no known location, so they're counted at 5%. Check them before filing
            (TAX-009).
          </div>
        )}

        {summary.data && taxRows.length === 0 && <p className={classes.empty}>No tax this month.</p>}

        {taxRows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Where</th>
                  <th className={classes.th}>Rate</th>
                  <th className={classes.th}>Fees and support</th>
                  <th className={classes.th}>Tax to set aside</th>
                </tr>
              </thead>
              <tbody>
                {taxRows.map((row) => (
                  <tr key={`${row.place}:${row.bps}:${row.currency}`}>
                    <td className={classes.td}>{taxPlaceName(row.place)}</td>
                    <td className={classes.td}>{formatFeeRateBps(row.bps)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.fees_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.tax_cents, row.currency)}</td>
                  </tr>
                ))}
                {taxTotalsByCurrency(taxRows).map((total) => (
                  <tr key={total.currency}>
                    <td className={classes.total} colSpan={3}>
                      Total in {total.currency.toUpperCase()}
                    </td>
                    <td className={classes.total}>{formatPaymentCents(total.tax_cents, total.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={classes.card}>
        <h2 className={classes.title}>Sales by region</h2>
        <p className={classes.text}>
          What buyers in each country and state or province paid this month, less refunds. US sales
          tax is owed by state once sales there pass that state's limit, so watch these totals.
          GST/HST here is the buyers' side; the table above is the full amount to set aside.
        </p>

        {summary.data && regionRows.length === 0 && <p className={classes.empty}>No sales this month.</p>}

        {regionRows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Region</th>
                  <th className={classes.th}>Payments</th>
                  <th className={classes.th}>Buyers paid</th>
                  <th className={classes.th}>GST/HST</th>
                </tr>
              </thead>
              <tbody>
                {regionRows.map((row) => (
                  <tr key={`${row.country}:${row.region}:${row.currency}`}>
                    <td className={classes.td}>{regionName(row.country, row.region)}</td>
                    <td className={classes.td}>{row.payments}</td>
                    <td className={classes.td}>{formatPaymentCents(row.paid_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.tax_cents, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={classes.card}>
        <h2 className={classes.title}>Each sale</h2>

        {sales.error && <div className={classes.error}>Sales could not be loaded.</div>}

        {sales.data && saleRows.length === 0 && <p className={classes.empty}>No sales this month.</p>}

        {saleRows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Date</th>
                  <th className={classes.th}>Item</th>
                  <th className={classes.th}>Creator</th>
                  <th className={classes.th}>Payments</th>
                  <th className={classes.th}>Sale</th>
                  <th className={classes.th}>Kept</th>
                </tr>
              </thead>
              <tbody>
                {saleRows.map((row) => (
                  <tr key={`${row.listing_request_id}:${row.currency}`}>
                    <td className={classes.td}>{row.completed_at.slice(0, 10)}</td>
                    <td className={classes.td}>
                      <Link className={classes.link} to={`/admin/requests/${row.listing_request_id}`}>
                        {row.title ?? "Untitled"}
                      </Link>
                    </td>
                    <td className={classes.td}>{row.creator_handle ? `@${row.creator_handle}` : "—"}</td>
                    <td className={classes.td}>{row.transactions}</td>
                    <td className={classes.td}>{formatPaymentCents(row.sold_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.kept_cents, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sales.hasNextPage && (
          <button
            type="button"
            className={classes.more}
            disabled={sales.isFetchingNextPage}
            onClick={() => void sales.fetchNextPage()}
          >
            Load more
          </button>
        )}
      </section>

      <section className={classes.card}>
        <h2 className={classes.title}>Each transaction</h2>

        {transactions.error && <div className={classes.error}>Sales could not be loaded.</div>}

        {transactions.data && transactionRows.length === 0 && (
          <p className={classes.empty}>No transactions this month.</p>
        )}

        {transactionRows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Date</th>
                  <th className={classes.th}>Item</th>
                  <th className={classes.th}>Creator</th>
                  <th className={classes.th}>Amount</th>
                  <th className={classes.th}>Kept</th>
                  <th className={classes.th}>Tax</th>
                  <th className={classes.th}>Buyer in</th>
                  <th className={classes.th}>Creator in</th>
                  <th className={classes.th}>
                    <span className="sr-only">Invoice</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactionRows.map((row) => (
                  <tr key={row.movement_id}>
                    <td className={classes.td}>{row.happened_at.slice(0, 10)}</td>
                    <td className={classes.td}>
                      <Link className={classes.link} to={`/admin/requests/${row.listing_request_id}`}>
                        {row.title ?? "Untitled"}
                      </Link>
                      {row.kind === "refund" && <span className={classes.refund}> Refund</span>}
                    </td>
                    <td className={classes.td}>{row.creator_handle ? `@${row.creator_handle}` : "—"}</td>
                    <td className={classes.td}>{formatPaymentCents(row.sold_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.kept_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.tax_cents, row.currency)}</td>
                    <td className={classes.td}>{taxPlaceName(row.buyer_tax_place)}</td>
                    <td className={classes.td}>{taxPlaceName(row.creator_tax_place)}</td>
                    <td className={classes.td}>
                      <Link className={classes.link} to={`/payments/invoice/${row.payment_id}`}>
                        Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {transactions.hasNextPage && (
          <button
            type="button"
            className={classes.more}
            disabled={transactions.isFetchingNextPage}
            onClick={() => void transactions.fetchNextPage()}
          >
            Load more
          </button>
        )}
      </section>
    </div>
  );
};

export default AdminSales;
