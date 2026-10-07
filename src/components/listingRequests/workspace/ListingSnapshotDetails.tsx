import type { ListingRequestSnapshot } from "../../../lib/listings/listingRequestSnapshot";
import { formatListingPrice } from "../../../lib/money/displayCurrency";

type ListingSnapshotDetailsProps = {
  snapshot: ListingRequestSnapshot;
  extraRows?: { label: string; value: string }[];
};

const classes = {
  wrap: "space-y-3",
  rows: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)] text-sm",
  row: "flex items-start justify-between gap-3 px-3 py-2",
  label: "text-zinc-600",
  value: "text-right font-semibold capitalize text-zinc-900",
  groupLabel: "metaLabel",
  chips: "flex flex-wrap gap-1.5",
  chip: "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700",
  none: "text-xs text-zinc-500",
} as const;

const dateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const priceText = (snapshot: ListingRequestSnapshot) => formatListingPrice(snapshot);

const humanize = (value: string) => value.replace(/[_-]+/g, " ");

const ListingSnapshotDetails = ({ snapshot, extraRows = [] }: ListingSnapshotDetailsProps) => {
  const rows = [
    { label: "Title", value: snapshot.title },
    { label: "Price", value: priceText(snapshot) },
    { label: "Offering", value: humanize(snapshot.offering_type) },
    { label: "Purchase flow", value: humanize(snapshot.fulfilment_mode) },
    { label: "Category", value: humanize(snapshot.category) },
    { label: "Listing last updated", value: dateText(snapshot.updated_at) },
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
        <div className={classes.groupLabel}>Deliverables</div>
        {snapshot.deliverables.length > 0 ? (
          <div className={classes.chips}>
            {snapshot.deliverables.map((deliverable) => (
              <span key={deliverable} className={classes.chip}>
                {deliverable}
              </span>
            ))}
          </div>
        ) : (
          <p className={classes.none}>No deliverables were listed.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className={classes.groupLabel}>Tags</div>
        {snapshot.tags.length > 0 ? (
          <div className={classes.chips}>
            {snapshot.tags.map((tag) => (
              <span key={tag} className={classes.chip}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className={classes.none}>No tags were listed.</p>
        )}
      </div>
    </div>
  );
};

export default ListingSnapshotDetails;
