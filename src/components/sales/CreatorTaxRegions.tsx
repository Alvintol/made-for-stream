import { formatFeeRateBps, formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { regionName, type CreatorTaxRegionRow } from "../../domain/payments/sales";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";

const classes = {
  group: "space-y-2",
  title: "font-display text-sm font-bold tracking-tight text-zinc-900",
  text: "text-sm text-zinc-600",
  tableWrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
} as const;

// A creator's year of sales by the buyer's region (20261103_185), for the tax
// help and the yearly statement. The GST/HST columns are only for a creator
// in Canada.
const CreatorTaxRegions = ({ regions, inCanada }: { regions: CreatorTaxRegionRow[]; inCanada: boolean }) => {
  const t = useT();
  const locale = dateLocale(useLanguage());

  const placeName = (row: CreatorTaxRegionRow) => {
    if (row.country === "-") return t("tax.notShared");
    if (row.country === "?") return t("tax.unknownRegion");

    return regionName(row.country, row.region, locale);
  };

  return (
    <div className={classes.group}>
      <h3 className={classes.title}>{t("tax.regionsTitle")}</h3>
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
            {regions.map((row) => (
              <tr key={`${row.country}:${row.region}:${row.currency}:${row.bps}`}>
                <td className={classes.td}>{placeName(row)}</td>
                <td className={classes.td}>{row.payments}</td>
                <td className={classes.td}>{formatPaymentCents(row.sold_cents, row.currency)}</td>
                <td className={classes.td}>{formatPaymentCents(row.earned_cents, row.currency)}</td>
                {inCanada && <td className={classes.td}>{row.bps === null ? "—" : formatFeeRateBps(row.bps)}</td>}
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
  );
};

export default CreatorTaxRegions;
