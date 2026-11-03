import { useState } from "react";
import { Link } from "react-router-dom";
import CreatorSalesTotals from "../../components/sales/CreatorSalesTotals";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { currentSalesMonth } from "../../domain/payments/sales";
import { useMySales } from "../../hooks/payments/useSales";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  page: "space-y-4",
  header: "flex flex-wrap items-end justify-between gap-3",
  h1: "pageTitle",
  sub: "pageSub",
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

// A creator's sales for one month: the totals, then every sale and refund.
const CreatorSales = () => {
  const t = useT();
  const [month, setMonth] = useState(currentSalesMonth);
  const sales = useMySales(month);
  const rows = sales.data?.pages.flatMap((page) => page.rows) ?? [];

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div>
          <h1 className={classes.h1}>{t("sales.title")}</h1>
          <p className={classes.sub}>{t("sales.sub")}</p>
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

      <section className={classes.card}>
        <h2 className={classes.title}>{t("sales.eachSale")}</h2>

        {sales.error && <div className={classes.error}>{t("sales.loadFailed")}</div>}

        {sales.data && rows.length === 0 && <p className={classes.empty}>{t("sales.noSales")}</p>}

        {rows.length > 0 && (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>{t("sales.date")}</th>
                  <th className={classes.th}>{t("sales.item")}</th>
                  <th className={classes.th}>{t("sales.sale")}</th>
                  <th className={classes.th}>{t("sales.fee")}</th>
                  <th className={classes.th}>{t("sales.earnings")}</th>
                  <th className={classes.th}>
                    <span className="sr-only">{t("invoice.title")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.movement_id}>
                    <td className={classes.td}>{row.happened_at.slice(0, 10)}</td>
                    <td className={classes.td}>
                      <Link className={classes.link} to={`/creator/requests/${row.listing_request_id}`}>
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
    </div>
  );
};

export default CreatorSales;
