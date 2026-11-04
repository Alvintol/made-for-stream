import { useState } from "react";
import { Link } from "react-router-dom";
import GuideHelpLink from "../../components/guide/GuideHelpLink";
import CreatorMonthEarnings from "../../components/sales/CreatorMonthEarnings";
import CreatorTaxHelp from "../../components/sales/CreatorTaxHelp";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { currentSalesMonth } from "../../domain/payments/sales";
import { useMyCompletedSales, useMyTransactions } from "../../hooks/payments/useSales";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  page: "space-y-6",
  sub: "pageSub",
  h1: "pageTitle",
  card: "card p-4",
  title: "font-display text-sm font-bold tracking-tight text-zinc-900",
  tableWrap: "mt-3 overflow-x-auto",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  link: "font-semibold text-[rgb(var(--accent-text))] hover:underline",
  refund: "font-semibold text-amber-700",
  more: "btnOutline btnSm mt-3",
  empty: "mt-3 text-sm text-zinc-500",
  error: "notice noticeError mt-3",
} as const;

// A creator's Earnings page: one month's totals, each completed commission
// or download with its fee, each transaction, and a year of tax help. The
// graph is on the dashboard.
const CreatorSales = () => {
  const t = useT();
  const [month, setMonth] = useState(currentSalesMonth);
  const sales = useMyCompletedSales(month);
  const transactions = useMyTransactions(month);
  const saleRows = sales.data?.pages.flatMap((page) => page.rows) ?? [];
  const transactionRows = transactions.data?.pages.flatMap((page) => page.rows) ?? [];

  return (
    <div className={classes.page}>
      <Link to="/creator/dashboard" className="backLink">
        ← {t("myListings.back")}
      </Link>

      <div>
        <h1 className={classes.h1}>{t("sales.title")}</h1>
        <p className={classes.sub}>{t("sales.sub")}</p>
        <GuideHelpLink track="creators" step="earnings" tour="earnings" />
      </div>

      <div data-tour="earnings-month">
        <CreatorMonthEarnings month={month} onMonthChange={setMonth} />
      </div>

      <section className={classes.card} data-tour="earnings-sales">
        <h2 className={classes.title}>{t("sales.eachSale")}</h2>

        {sales.error && <div className={classes.error}>{t("sales.loadFailed")}</div>}

        {sales.data && saleRows.length === 0 && <p className={classes.empty}>{t("sales.noSales")}</p>}

        {saleRows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>{t("sales.date")}</th>
                  <th className={classes.th}>{t("sales.item")}</th>
                  <th className={classes.th}>{t("sales.payments")}</th>
                  <th className={classes.th}>{t("sales.amount")}</th>
                  <th className={classes.th}>{t("sales.fee")}</th>
                  <th className={classes.th}>{t("sales.earnings")}</th>
                </tr>
              </thead>
              <tbody>
                {saleRows.map((row) => (
                  <tr key={`${row.listing_request_id}:${row.currency}`}>
                    <td className={classes.td}>{row.completed_at.slice(0, 10)}</td>
                    <td className={classes.td}>
                      <Link
                        className={classes.link}
                        to={row.instant ? `/creator/listings/${row.listing_id}` : `/creator/requests/${row.listing_request_id}`}
                      >
                        {row.title ?? t("sales.untitled")}
                      </Link>
                    </td>
                    <td className={classes.td}>{row.transactions}</td>
                    <td className={classes.td}>{formatPaymentCents(row.sold_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.fee_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.earned_cents, row.currency)}</td>
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
            {t("sales.loadMore")}
          </button>
        )}
      </section>

      <section className={classes.card} data-tour="earnings-transactions">
        <h2 className={classes.title}>{t("sales.eachTransaction")}</h2>

        {transactions.error && <div className={classes.error}>{t("sales.loadFailed")}</div>}

        {transactions.data && transactionRows.length === 0 && (
          <p className={classes.empty}>{t("sales.noTransactions")}</p>
        )}

        {transactionRows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>{t("sales.date")}</th>
                  <th className={classes.th}>{t("sales.item")}</th>
                  <th className={classes.th}>{t("sales.amount")}</th>
                  <th className={classes.th}>{t("sales.fee")}</th>
                  <th className={classes.th}>{t("sales.earnings")}</th>
                  <th className={classes.th}>
                    <span className="sr-only">{t("invoice.title")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactionRows.map((row) => (
                  <tr key={row.movement_id}>
                    <td className={classes.td}>{row.happened_at.slice(0, 10)}</td>
                    <td className={classes.td}>
                      <Link
                        className={classes.link}
                        to={row.instant ? `/creator/listings/${row.listing_id}` : `/creator/requests/${row.listing_request_id}`}
                      >
                        {row.title ?? t("sales.untitled")}
                      </Link>
                      {row.kind !== "sale" && (
                        <span className={classes.refund}> {t(row.kind === "chargeback" ? "sales.chargeback" : "sales.refund")}</span>
                      )}
                    </td>
                    <td className={classes.td}>{formatPaymentCents(row.sold_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.fee_cents, row.currency)}</td>
                    <td className={classes.td}>{formatPaymentCents(row.earned_cents, row.currency)}</td>
                    <td className={classes.td}>
                      <Link className={classes.link} to={`/payments/invoice/${row.payment_id}`}>
                        {t("invoice.title")}
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
            {t("sales.loadMore")}
          </button>
        )}
      </section>

      <div data-tour="earnings-tax">
        <CreatorTaxHelp />
      </div>
    </div>
  );
};

export default CreatorSales;
