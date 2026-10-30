import {
  getMissingPublishCheckCount,
  type ListingPublishReadiness,
} from "../../lib/listings/listingPublishReadiness";
import { useT } from "../../lib/i18n/i18n";
const classes = {
  wrap: "space-y-3",
  readyBox:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800",
  notReadyBox:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800",
  checkList: "space-y-2",
  checkRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkPass:
    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700",
  checkFail:
    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700",
  checkText: "text-sm text-zinc-700",
} as const;

// The publish checklist, shared by the create page's side panel and the
// listing details page so both always show the same rules.
const ListingPublishChecklist = ({ readiness }: { readiness: ListingPublishReadiness }) => {
  const t = useT();
  const missing = getMissingPublishCheckCount(readiness);

  return (
    <div className={classes.wrap}>
      {readiness.isReady ? (
        <div className={classes.readyBox}>{t("publishCheck.ready")}</div>
      ) : (
        <div className={classes.notReadyBox}>
          {t("publishCheck.left", { count: missing })}
        </div>
      )}

      <ul className={classes.checkList}>
        {readiness.checks.map((check) => (
          <li key={check.key} className={classes.checkRow}>
            <span
              className={check.passed ? classes.checkPass : classes.checkFail}
              aria-hidden="true"
            >
              {check.passed ? "✓" : "!"}
            </span>

            <span className={classes.checkText}>
              <span className="sr-only">{t(check.passed ? "publishCheck.done" : "publishCheck.missing")} </span>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ListingPublishChecklist;
