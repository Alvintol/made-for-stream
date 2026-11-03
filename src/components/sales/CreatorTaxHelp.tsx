import { useState } from "react";
import { formatFeeRateBps, formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import {
  SMALL_SUPPLIER_LIMIT_CENTS,
  formatSalesMonth,
  regionName,
  type CreatorTaxRegionRow,
} from "../../domain/payments/sales";
import { useMyTaxSummary } from "../../hooks/payments/useSales";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";

const classes = {
  section: "card space-y-4 p-6",
  header: "flex flex-wrap items-end justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  note: "mt-0.5 max-w-2xl text-sm text-zinc-500",
  filter: "space-y-1",
  label: "formLabel block",
  input: "formControl",
  stats: "grid gap-3 sm:grid-cols-2",
  stat: "rounded-xl border border-[var(--hairline)] p-4",
  statLabel: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  statValue: "mt-1 font-display text-2xl font-bold tracking-tight text-zinc-900",
  statNote: "mt-0.5 text-xs text-zinc-500",
  meter: "mt-2 h-2 w-full",
  subTitle: "font-display text-sm font-bold tracking-tight text-zinc-900",
  text: "text-sm text-zinc-600",
  tableWrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  empty: "text-sm text-zinc-500",
  error: "notice noticeError",
  warning: "notice noticeWarning",
} as const;

// A creator's year of numbers for their own taxes, on the Earnings page
// (20261103_185): earnings and fees, the $30,000 small supplier limit for
// creators in Canada, and sales by the buyer's region. Estimates only.
const CreatorTaxHelp = ({ today = new Date() }: { today?: Date }) => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const thisYear = today.getUTCFullYear();
  const [year, setYear] = useState(thisYear);
  const { data, error, isLoading } = useMyTaxSummary(year);
  const inCanada = data?.creator_country === "CA";
  const supplier = data?.small_supplier;

  const placeName = (row: CreatorTaxRegionRow) => {
    if (row.country === "-") return t("tax.notShared");
    if (row.country === "?") return t("tax.unknownRegion");

    return regionName(row.country, row.region, locale);
  };

  return (
    <section className={classes.section} aria-labelledby="tax-help-title">
      <div className={classes.header}>
        <div>
          <h2 id="tax-help-title" className={classes.title}>
            {t("tax.title")}
          </h2>
          <p className={classes.note}>{t("tax.note")}</p>
        </div>

        <label className={classes.filter}>
          <span className={classes.label}>{t("sales.year")}</span>
          <select
            className={classes.input}
            value={year}
            onChange={(event) => setYear(Number(event.currentTarget.value))}
          >
            {[thisYear, thisYear - 1, thisYear - 2].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className={classes.error}>{t("sales.loadFailed")}</div>}

      {isLoading && <p className={classes.empty}>{t("sales.loading")}</p>}

      {data && (
        <>
          {data.totals.length === 0 && <p className={classes.empty}>{t("tax.noSales")}</p>}

          {data.totals.map((totals) => (
            <div key={totals.currency} className={classes.stats}>
              <div className={classes.stat}>
                <div className={classes.statLabel}>{t("sales.totalEarnings")}</div>
                <div className={classes.statValue}>{formatPaymentCents(totals.earned_cents, totals.currency)}</div>
                <div className={classes.statNote}>{t("tax.earningsNote")}</div>
              </div>
              <div className={classes.stat}>
                <div className={classes.statLabel}>{t("sales.totalFees")}</div>
                <div className={classes.statValue}>{formatPaymentCents(totals.fee_cents, totals.currency)}</div>
                <div className={classes.statNote}>
                  {t("sales.feesIncludeTax", { amount: formatPaymentCents(totals.fee_tax_cents, totals.currency) })}
                </div>
                <div className={classes.statNote}>{t("tax.feesNote")}</div>
              </div>
            </div>
          ))}

          {inCanada && supplier && (
            <div className={classes.stat}>
              <div className={classes.statLabel}>{t("tax.limitTitle")}</div>
              <div className={classes.statValue}>
                {t("tax.limitValue", {
                  amount: formatPaymentCents(supplier.sold_cents, "cad"),
                  limit: formatPaymentCents(SMALL_SUPPLIER_LIMIT_CENTS, "cad"),
                })}
              </div>
              <meter
                className={classes.meter}
                min={0}
                max={SMALL_SUPPLIER_LIMIT_CENTS}
                high={SMALL_SUPPLIER_LIMIT_CENTS * 0.8}
                value={Math.max(0, supplier.sold_cents)}
                aria-label={t("tax.limitTitle")}
              />
              <div className={classes.statNote}>
                {t("tax.limitNote", { month: formatSalesMonth(supplier.from.slice(0, 7), locale) })}
              </div>
            </div>
          )}

          {inCanada && supplier && supplier.sold_cents >= SMALL_SUPPLIER_LIMIT_CENTS && (
            <div className={classes.warning}>{t("tax.limitPassed")}</div>
          )}

          {data.regions.length > 0 && (
            <div className="space-y-2">
              <h3 className={classes.subTitle}>{t("tax.regionsTitle")}</h3>
              <p className={classes.text}>{t("tax.regionsNote")}</p>
              {inCanada && <p className={classes.text}>{t("tax.rateNote")}</p>}

              <div className={classes.tableWrap}>
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.th}>{t("tax.region")}</th>
                      <th className={classes.th}>{t("sales.payments")}</th>
                      <th className={classes.th}>{t("sales.amount")}</th>
                      <th className={classes.th}>{t("sales.earnings")}</th>
                      {inCanada && <th className={classes.th}>{t("tax.rate")}</th>}
                      {inCanada && <th className={classes.th}>{t("tax.atRate")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.regions.map((row) => (
                      <tr key={`${row.country}:${row.region}:${row.currency}:${row.bps}`}>
                        <td className={classes.td}>{placeName(row)}</td>
                        <td className={classes.td}>{row.payments}</td>
                        <td className={classes.td}>{formatPaymentCents(row.sold_cents, row.currency)}</td>
                        <td className={classes.td}>{formatPaymentCents(row.earned_cents, row.currency)}</td>
                        {inCanada && (
                          <td className={classes.td}>{row.bps === null ? "—" : formatFeeRateBps(row.bps)}</td>
                        )}
                        {inCanada && (
                          <td className={classes.td}>
                            {row.tax_cents === null ? "—" : formatPaymentCents(row.tax_cents, row.currency)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default CreatorTaxHelp;
