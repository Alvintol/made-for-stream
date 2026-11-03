import { useState } from "react";
import { Link } from "react-router-dom";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { SMALL_SUPPLIER_LIMIT_CENTS, formatSalesMonth } from "../../domain/payments/sales";
import { useMyTaxSummary } from "../../hooks/payments/useSales";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
import CreatorTaxRegions from "./CreatorTaxRegions";

const classes = {
  section: "card space-y-4 p-6",
  header: "flex flex-wrap items-end justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  note: "mt-0.5 max-w-2xl text-sm text-zinc-500",
  side: "flex flex-wrap items-end gap-3",
  link: "btnOutline",
  filter: "space-y-1",
  label: "formLabel block",
  input: "formControl",
  stats: "grid gap-3 sm:grid-cols-2",
  stat: "rounded-xl border border-[var(--hairline)] p-4",
  statLabel: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  statValue: "mt-1 font-display text-2xl font-bold tracking-tight text-zinc-900",
  statNote: "mt-0.5 text-xs text-zinc-500",
  meter: "mt-2 h-2 w-full",
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

  return (
    <section className={classes.section} aria-labelledby="tax-help-title">
      <div className={classes.header}>
        <div>
          <h2 id="tax-help-title" className={classes.title}>
            {t("tax.title")}
          </h2>
          <p className={classes.note}>{t("tax.note")}</p>
        </div>

        <div className={classes.side}>
          <Link className={classes.link} to={`/creator/earnings/statement/${year}`}>
            {t("statement.link")}
          </Link>

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

          {data.regions.length > 0 && <CreatorTaxRegions regions={data.regions} inCanada={inCanada} />}
        </>
      )}
    </section>
  );
};

export default CreatorTaxHelp;
