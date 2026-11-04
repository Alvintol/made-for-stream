import { Link, useParams } from "react-router-dom";
import CreatorTaxRegions from "../../components/sales/CreatorTaxRegions";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { formatSalesMonth } from "../../domain/payments/sales";
import { useMySalesChart, useMyTaxSummary } from "../../hooks/payments/useSales";
import { useAccountDetails } from "../../hooks/settings/useAccountDetails";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";

const classes = {
  page: "mx-auto max-w-3xl space-y-4",
  back: "text-sm font-semibold text-[rgb(var(--accent-text))] hover:underline print:hidden",
  card: "card space-y-6 p-6",
  header: "flex flex-wrap items-start justify-between gap-3",
  h1: "pageTitle",
  meta: "text-sm text-zinc-600",
  notice: "text-sm text-zinc-600",
  parties: "grid gap-4 sm:grid-cols-2",
  heading: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  party: "mt-1 text-sm font-semibold text-zinc-900",
  lines: "mt-2 space-y-1 text-sm",
  line: "flex justify-between gap-4 text-zinc-800",
  sub: "flex justify-between gap-4 text-xs text-zinc-500",
  total: "flex justify-between gap-4 border-t border-zinc-200 pt-3 text-sm font-bold text-zinc-900",
  subTitle: "font-display text-sm font-bold tracking-tight text-zinc-900",
  tableWrap: "mt-2 overflow-x-auto",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  print: "btnOutline btnSm print:hidden",
  loading: "text-sm text-zinc-600",
  error: "notice noticeError",
} as const;

// Made for Stream's GST/HST number, as on invoices.
const PLATFORM_TAX_NUMBER = import.meta.env.VITE_PLATFORM_TAX_NUMBER as string | undefined;

// A creator's year on one page to print or save (/creator/earnings/statement/:year):
// who it's for, the year's totals, each month and sales by the buyer's region.
// A record for their own taxes, not a government form. Playbook:
// docs/support/payments/sales.md.
const CreatorStatement = ({ today = new Date() }: { today?: Date }) => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const thisYear = today.getUTCFullYear();
  const year = Number(useParams().year);
  const valid = Number.isInteger(year) && year >= 2020 && year <= thisYear;
  const shown = valid ? year : thisYear;
  const summary = useMyTaxSummary(shown);
  const months = useMySalesChart({ from: `${shown}-01-01`, to: `${shown}-12-31`, kind: "all" });
  const details = useAccountDetails();

  if (!valid) return <div className={classes.error}>{t("statement.invalidYear")}</div>;

  if (summary.isLoading || months.isLoading) return <p className={classes.loading}>{t("sales.loading")}</p>;

  if (summary.error || months.error || !summary.data || !months.data) {
    return <div className={classes.error}>{t("sales.loadFailed")}</div>;
  }

  const { totals, regions, creator_country } = summary.data;
  const account = details.data;
  const longDate = (date: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date);
  // The graph's rows come by day for the first 92 days of this year, and by
  // month after, so they're added up by month here.
  const monthCount = year === thisYear ? today.getUTCMonth() + 1 : 12;
  const monthRows = (currency: string) =>
    Array.from({ length: monthCount }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      const rows = months.data.rows.filter((row) => row.currency === currency && row.period.startsWith(month));
      const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);

      return {
        month,
        payments: sum((row) => row.transactions),
        paid_cents: sum((row) => row.paid_cents),
        fee_cents: sum((row) => row.fee_cents),
        earned_cents: sum((row) => row.earned_cents),
      };
    });

  return (
    <div className={classes.page}>
      <Link className={classes.back} to="/creator/earnings">
        {t("statement.back")}
      </Link>

      <article className={classes.card}>
        <div className={classes.header}>
          <div>
            <h1 className={classes.h1}>{t("statement.title", { year })}</h1>
            <p className={classes.meta}>
              {year === thisYear
                ? t("statement.periodSoFar", { year, date: longDate(today) })
                : t("statement.periodFull", { year })}{" "}
              · {t("statement.prepared", { date: longDate(today) })}
            </p>
          </div>

          <button type="button" className={classes.print} onClick={() => window.print()}>
            {t("invoice.print")}
          </button>
        </div>

        <p className={classes.notice}>{t("statement.notAForm")}</p>

        <div className={classes.parties}>
          <section>
            <h2 className={classes.heading}>{t("statement.preparedFor")}</h2>
            {account ? (
              <>
                <p className={classes.party}>
                  {account.business_legal_name || `${account.legal_first_name} ${account.legal_last_name}`}
                </p>
                <p className={classes.meta}>
                  {[account.address_line1, account.address_line2].filter(Boolean).join(", ")}
                  <br />
                  {[account.city, account.region, account.postal_code, account.country_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {account.tax_number && (
                  <p className={classes.meta}>{t("invoice.taxNumber", { number: account.tax_number })}</p>
                )}
              </>
            ) : (
              <p className={classes.meta}>{t("statement.noDetails")}</p>
            )}
          </section>

          <section>
            <h2 className={classes.heading}>{t("statement.preparedBy")}</h2>
            <p className={classes.party}>Made for Stream</p>
            {PLATFORM_TAX_NUMBER && (
              <p className={classes.meta}>{t("invoice.gstNumber", { number: PLATFORM_TAX_NUMBER })}</p>
            )}
          </section>
        </div>

        {totals.length === 0 && <p className={classes.meta}>{t("tax.noSales")}</p>}

        {totals.map((total) => {
          const money = (cents: number) => formatPaymentCents(cents, total.currency);

          return (
            <section key={total.currency} className="space-y-4">
              <div>
                <h2 className={classes.heading}>
                  {t("statement.summary")} · {total.currency.toUpperCase()}
                </h2>
                <div className={classes.lines}>
                  <div className={classes.line}>
                    <span>{t("sales.payments")}</span>
                    <span>{total.payments}</span>
                  </div>
                  <div className={classes.line}>
                    <span>{t("statement.sold")}</span>
                    <span>{money(total.sold_cents)}</span>
                  </div>
                  <div className={classes.line}>
                    <span>{t("sales.totalFees")}</span>
                    <span>−{money(total.fee_cents)}</span>
                  </div>
                  {/* GST/HST is charged on fees to creators in Canada only. */}
                  {creator_country === "CA" && (
                    <div className={classes.sub}>
                      <span>{t("statement.feeTax")}</span>
                      <span>{money(total.fee_tax_cents)}</span>
                    </div>
                  )}
                  <div className={classes.total}>
                    <span>{t("sales.totalEarnings")}</span>
                    <span>{money(total.earned_cents)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={classes.subTitle}>{t("sales.byMonth")}</h3>
                <div className={classes.tableWrap}>
                  <table className={classes.table}>
                    <thead>
                      <tr>
                        <th className={classes.th}>{t("sales.month")}</th>
                        <th className={classes.th}>{t("sales.payments")}</th>
                        <th className={classes.th}>{t("sales.amount")}</th>
                        <th className={classes.th}>{t("sales.fee")}</th>
                        <th className={classes.th}>{t("sales.earnings")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows(total.currency).map((row) => (
                        <tr key={row.month}>
                          <td className={classes.td}>{formatSalesMonth(row.month, locale)}</td>
                          <td className={classes.td}>{row.payments}</td>
                          <td className={classes.td}>{money(row.paid_cents)}</td>
                          <td className={classes.td}>{money(row.fee_cents)}</td>
                          <td className={classes.td}>{money(row.earned_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })}

        {regions.length > 0 && <CreatorTaxRegions regions={regions} inCanada={creator_country === "CA"} />}
      </article>
    </div>
  );
};

export default CreatorStatement;
