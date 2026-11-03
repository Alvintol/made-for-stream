import { useState } from "react";
import { Link } from "react-router-dom";
import AdminSalesTotals from "../../components/sales/AdminSalesTotals";
import {
  formatFeeRateBps,
  formatPaymentCents,
} from "../../domain/payments/listingRequestPaymentDisplay";
import {
  currentSalesMonth,
  isUnknownTaxPlace,
  taxPlaceName,
  taxTotalsByCurrency,
} from "../../domain/payments/sales";
import { useAdminSales, useAdminSalesSummary } from "../../hooks/payments/useSales";

const classes = {
  page: "space-y-6",
  header: "flex flex-wrap items-end justify-between gap-3",
  h1: "pageTitle",
  sub: "pageSub",
  month: "space-y-1",
  label: "formLabel",
  input: "formControl",
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

// Every sale on the site for one month, what Made for Stream kept, and the
// GST/HST to set aside for each place. Playbook: docs/support/payments/sales.md.
const AdminSales = () => {
  const [month, setMonth] = useState(currentSalesMonth);
  const summary = useAdminSalesSummary(month);
  const sales = useAdminSales(month);

  const taxRows = summary.data?.tax ?? [];
  const rows = sales.data?.pages.flatMap((page) => page.rows) ?? [];

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div>
          <h1 className={classes.h1}>Sales</h1>
          <p className={classes.sub}>
            Months run in UTC, the same as the tax reports. A refund counts in the month it was made.
          </p>
        </div>

        <label className={classes.month}>
          <span className={classes.label}>Month</span>
          <input
            className={classes.input}
            type="month"
            max={currentSalesMonth()}
            value={month}
            onChange={(event) => event.currentTarget.value && setMonth(event.currentTarget.value)}
          />
        </label>
      </div>

      <AdminSalesTotals month={month} />

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
        <h2 className={classes.title}>Each sale</h2>

        {sales.error && <div className={classes.error}>Sales could not be loaded.</div>}

        {sales.data && rows.length === 0 && <p className={classes.empty}>No sales this month.</p>}

        {rows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Date</th>
                  <th className={classes.th}>Item</th>
                  <th className={classes.th}>Creator</th>
                  <th className={classes.th}>Sale</th>
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
                {rows.map((row) => (
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
    </div>
  );
};

export default AdminSales;
