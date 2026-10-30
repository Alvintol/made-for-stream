import type { ListingRequestSnapshot } from "../../../lib/listings/listingRequestSnapshot";
import { formatListingPrice } from "../../../lib/money/displayCurrency";
import { dateLocale, useLanguage, useT, wordFor } from "../../../lib/i18n/i18n";
type ListingSnapshotDetailsProps = {
  snapshot: ListingRequestSnapshot;
  extraRows?: { label: string; value: string }[];
};

const classes = {
  wrap: "space-y-3",
  rows: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)] text-sm",
  row: "flex items-start justify-between gap-3 px-3 py-2",
  label: "text-zinc-600",
  value: "text-right font-semibold text-zinc-900 first-letter:uppercase",
  groupLabel: "metaLabel",
  chips: "flex flex-wrap gap-1.5",
  chip: "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700",
  none: "text-xs text-zinc-500",
} as const;

const dateText = (value: string, language: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(language, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const ListingSnapshotDetails = ({ snapshot, extraRows = [] }: ListingSnapshotDetailsProps) => {
  const t = useT();
  const language = dateLocale(useLanguage());
  const rows = [
    { label: t("snapshot.title"), value: snapshot.title },
    { label: t("snapshot.price"), value: formatListingPrice(snapshot, t("price.from")) },
    { label: t("snapshot.offering"), value: wordFor("offering", snapshot.offering_type, t) },
    { label: t("buyerRequests.purchaseFlow"), value: wordFor("fulfilment", snapshot.fulfilment_mode, t) },
    { label: t("snapshot.category"), value: wordFor("category", snapshot.category, t) },
    { label: t("snapshot.updated"), value: dateText(snapshot.updated_at, language) },
    ...extraRows,
  ];

  return (
    <div className={classes.wrap}>
      <dl className={classes.rows}>
        {rows.map((row) => (
          <div key={row.label} className={classes.row}>
            <dt className={classes.label}>{row.label}</dt>
            <dd className={classes.value}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-1.5">
        <div className={classes.groupLabel}>{t("snapshot.deliverables")}</div>
        {snapshot.deliverables.length > 0 ? (
          <div className={classes.chips}>
            {snapshot.deliverables.map((deliverable) => (
              <span key={deliverable} className={classes.chip}>
                {deliverable}
              </span>
            ))}
          </div>
        ) : (
          <p className={classes.none}>{t("snapshot.noDeliverables")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className={classes.groupLabel}>{t("snapshot.tags")}</div>
        {snapshot.tags.length > 0 ? (
          <div className={classes.chips}>
            {snapshot.tags.map((tag) => (
              <span key={tag} className={classes.chip}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className={classes.none}>{t("snapshot.noTags")}</p>
        )}
      </div>
    </div>
  );
};

export default ListingSnapshotDetails;
