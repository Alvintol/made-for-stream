import { useState } from "react";
import { Link } from "react-router-dom";
import CreatorSalesTotals from "../../components/sales/CreatorSalesTotals";
import SalesChart, {
  type SalesChartMetric,
  type SalesChartText,
} from "../../components/sales/SalesChart";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { currentSalesMonth, type CreatorChartRow } from "../../domain/payments/sales";
import {
  useMyCompletedSales,
  useMySalesChart,
  useMyTransactions,
} from "../../hooks/payments/useSales";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";

const classes = {
  page: "space-y-6",
  sub: "pageSub",
  h1: "pageTitle",
  months: "space-y-3",
  monthHeader: "flex flex-wrap items-end justify-between gap-3",
  monthTitle: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  note: "mt-0.5 max-w-2xl text-sm text-zinc-500",
  month: "space-y-1",
  label: "formLabel",
  input: "formControl",
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

// A creator's numbers: a graph over time, then one month's totals, each
// completed sale and each transaction.
const CreatorSales = () => {
  const t = useT();
  const language = useLanguage();
  const [month, setMonth] = useState(currentSalesMonth);
  const sales = useMyCompletedSales(month);
  const transactions = useMyTransactions(month);
  const saleRows = sales.data?.pages.flatMap((page) => page.rows) ?? [];
  const transactionRows = transactions.data?.pages.flatMap((page) => page.rows) ?? [];

  const metrics: SalesChartMetric<CreatorChartRow>[] = [
    {
      id: "earnings",
      label: t("sales.totalEarnings"),
      cents: (row) => row.earned_cents,
    },
    {
      id: "sales",
      label: t("sales.totalSales"),
      cents: (row) => row.sold_cents,
      count: (row) => t("sales.completedCount", { count: row.sales }),
    },
    {
      id: "transactions",
      label: t("sales.transactions"),
      cents: (row) => row.paid_cents,
      count: (row) => t("sales.paymentCount", { count: row.transactions }),
    },
    {
      id: "fees",
      label: t("sales.totalFees"),
      cents: (row) => row.fee_cents,
    },
  ];

  const text: SalesChartText = {
    title: t("sales.overTime"),
    range: t("sales.range"),
    days: (count) => t("sales.rangeDays", { count }),
    months: t("sales.range12Months"),
    currency: t("sales.currency"),
    loading: t("sales.loading"),
    empty: t("sales.noPeriod"),
    failed: t("sales.loadFailed"),
    table: t("sales.showTable"),
    date: t("sales.date"),
  };

  return (
    <div className={classes.page}>
      <div>
        <h1 className={classes.h1}>{t("sales.title")}</h1>
        <p className={classes.sub}>{t("sales.sub")}</p>
      </div>

      <SalesChart
        useChart={useMySalesChart}
        metrics={metrics}
        text={text}
        locale={dateLocale(language)}
      />

      <section className={classes.months}>
        <div className={classes.monthHeader}>
          <div>
            <h2 className={classes.monthTitle}>{t("sales.byMonth")}</h2>
            <p className={classes.note}>{t("sales.monthNote")}</p>
          </div>

          <label className={classes.month}>
            <span className={classes.label}>{t("sales.month")}</span>
            <input
              className={classes.input}
              type="month"
              max={currentSalesMonth()}
              value={month}
              onChange={(event) => event.currentTarget.value && setMonth(event.currentTarget.value)}
            />
          </label>
        </div>

        <CreatorSalesTotals month={month} />
      </section>

      <section className={classes.card}>
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
                  <th className={classes.th}>{t("sales.sale")}</th>
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

      <section className={classes.card}>
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
                      {row.kind === "refund" && <span className={classes.refund}> {t("sales.refund")}</span>}
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
    </div>
  );
};

export default CreatorSales;
