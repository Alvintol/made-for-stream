import { useT } from "../../lib/i18n/i18n";
import type { ListingRevisionChange } from "../../lib/listings/listingRevisionDiff";
const classes = {
  title: "font-semibold text-zinc-900",
  // break-all: a long web address has nowhere else to wrap.
  line: "mt-1 break-all",
  lineLabel: "mr-2 text-xs font-bold uppercase tracking-wide text-zinc-500",
} as const;

// One revision change. When a field went from one value to another, the two
// values get a line each, so the old and new are easy to tell apart.
const ListingRevisionChangeText = ({ change }: { change: ListingRevisionChange }) => {
  const t = useT();

  return change.from === undefined || change.to === undefined ? (
    <>{change.label}</>
  ) : (
    <>
      <div className={classes.title}>{change.label}</div>

      <div className={classes.line}>
        <span className={classes.lineLabel}>{t("revision.from")}</span>
        {change.from}
      </div>

      <div className={classes.line}>
        <span className={classes.lineLabel}>{t("revision.to")}</span>
        {change.to}
      </div>
    </>
  );
};

export default ListingRevisionChangeText;
