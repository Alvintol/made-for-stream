import { useEffect, useMemo, useRef, useState } from "react";
import {
  getModerationReportReasonLabel,
  getModerationReportResolutionLabel,
  getModerationReportStatusLabel,
  getModerationReportTargetTypeLabel,
  type ModerationReportStatus,
} from "../../domain/moderation/moderationReports";
import {
  useMarkMyModerationReportsSeen,
  useMyModerationReports,
} from "../../hooks/moderation/useMyModerationReports";
import CollapsibleSection from "../../components/ui/CollapsibleSection";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
const classes = {
  card: "card overflow-hidden hover:shadow-[var(--shadow-md)]",
  toolbar:
    "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3 sm:px-5",
  title: "font-display text-base font-bold tracking-tight text-zinc-900",
  sub: "text-xs text-zinc-500",

  filters:
    "grid w-full grid-cols-4 gap-0.5 rounded-full border border-[var(--hairline-strong)] p-0.5 sm:inline-flex sm:w-auto",
  filter:
    "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold transition sm:gap-1.5 sm:px-3",
  filterActive: "bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  filterIdle: "text-zinc-600 hover:text-zinc-900",
  count: "rounded-full bg-[rgb(var(--ink)/0.06)] px-1.5 text-[10px] font-bold tabular-nums",

  list: "divide-y divide-[var(--hairline)]",
  state: "px-4 py-6 text-center text-sm text-zinc-600 sm:px-5",
  error: "m-4 notice noticeError",

  badges: "flex items-center gap-1.5",
  status: "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
  statusSubmitted: "border-orange-200 bg-orange-50 text-orange-800",
  statusReviewing: "border-blue-200 bg-blue-50 text-blue-800",
  statusResolved: "border-green-200 bg-green-50 text-green-800",
  statusMuted: "border-zinc-300 bg-zinc-100 text-zinc-700",
  statusNeedsInfo: "border-amber-200 bg-amber-50 text-amber-800",
  newUpdate:
    "inline-flex rounded-full bg-[rgb(var(--brand))] px-2 py-0.5 text-[11px] font-semibold text-white",

  facts: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4",
  factLabel: "metaLabel",
  factValue: "break-words text-zinc-900",
  details: "text-sm text-zinc-700",
  detailsLabel: "font-semibold text-zinc-900",
  update: "notice noticeInfo",
} as const;

type ReportsFilter = "all" | "active" | "updates" | "resolved";

const dateText = (value: string | null, locale: string | undefined, withTime = false) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
};

const statusClass: Record<ModerationReportStatus, string> = {
  submitted: classes.statusSubmitted,
  reviewing: classes.statusReviewing,
  needs_more_info: classes.statusNeedsInfo,
  action_taken: classes.statusResolved,
  resolved: classes.statusResolved,
  dismissed: classes.statusMuted,
};

const MyReports = () => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const { data: reports = [], isLoading, error } = useMyModerationReports();
  const markReportsSeen = useMarkMyModerationReportsSeen();

  const [reportsFilter, setReportsFilter] = useState<ReportsFilter>("all");
  // Marking updates as seen clears the flag on refetch; keep them highlighted for this visit.
  const [freshUpdateIds, setFreshUpdateIds] = useState<ReadonlySet<string>>(() => new Set());

  const activeReports = useMemo(() => reports.filter((report) => !report.resolved_at), [reports]);
  const reportsWithUpdates = useMemo(
    () => reports.filter((report) => report.has_unread_update || freshUpdateIds.has(report.id)),
    [reports, freshUpdateIds]
  );
  const resolvedReports = useMemo(
    () => reports.filter((report) => Boolean(report.resolved_at)),
    [reports]
  );

  const filteredReports =
    reportsFilter === "active"
      ? activeReports
      : reportsFilter === "updates"
        ? reportsWithUpdates
        : reportsFilter === "resolved"
          ? resolvedReports
          : reports;

  const reportFilters: Array<{ value: ReportsFilter; label: string; count: number }> = [
    { value: "all", label: t("inbox.folder.all"), count: reports.length },
    { value: "active", label: t("myReports.filterActive"), count: activeReports.length },
    { value: "updates", label: t("myReports.filterUpdates"), count: reportsWithUpdates.length },
    { value: "resolved", label: t("myReports.filterResolved"), count: resolvedReports.length },
  ];

  const unreadIds = reports.filter((report) => report.has_unread_update).map((report) => report.id);
  const unreadKey = unreadIds.join(",");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const markedKeyRef = useRef<string | null>(null);

  // New updates stay highlighted after they are marked seen (recorded while
  // rendering, not in an effect); the effect tells the server once per set.
  if (!isLoading && !error && unreadKey && freshKey !== unreadKey) {
    setFreshKey(unreadKey);
    setFreshUpdateIds((current) => new Set([...current, ...unreadKey.split(",")]));
  }

  useEffect(() => {
    if (!freshKey || markedKeyRef.current === freshKey) return;

    markedKeyRef.current = freshKey;
    markReportsSeen.mutate();
  }, [freshKey, markReportsSeen]);

  const hasReports = !isLoading && !error && reports.length > 0;

  return (
    <div className={classes.card}>
      <div className={classes.toolbar}>
        <div>
          <h2 className={classes.title}>{t("myReports.title")}</h2>
          <p className={classes.sub}>{t("myReports.sub")}</p>
        </div>

        {hasReports && (
          <div className={classes.filters} role="tablist" aria-label={t("myReports.filter")}>
            {reportFilters.map((filter) => {
              const isActive = reportsFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${classes.filter} ${isActive ? classes.filterActive : classes.filterIdle}`}
                  onClick={() => setReportsFilter(filter.value)}
                >
                  {filter.label}
                  <span className={classes.count}>{filter.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading && <p className={classes.state}>{t("myReports.loading")}</p>}

      {error && <div className={classes.error}>{t("myReports.loadFailed")}</div>}

      {!isLoading && !error && reports.length === 0 && (
        <p className={classes.state}>{t("myReports.none")}</p>
      )}

      {hasReports && filteredReports.length === 0 && (
        <p className={classes.state}>{t("myReports.noMatch")}</p>
      )}

      {hasReports && filteredReports.length > 0 && (
        <div className={classes.list}>
          {filteredReports.map((report) => {
            const isFresh = report.has_unread_update || freshUpdateIds.has(report.id);
            const statusLabel = getModerationReportStatusLabel(report.status, t);

            return (
              <CollapsibleSection
                key={report.id}
                headingLevel="h3"
                title={report.target_label}
                summary={`${getModerationReportTargetTypeLabel(report.target_type, t)} · ${dateText(report.created_at, locale)}`}
                defaultOpen={isFresh}
                badge={
                  <span className={classes.badges}>
                    {isFresh && (
                      <span className={classes.newUpdate}>
                        <span className="sm:hidden">{t("myReports.new")}</span>
                        <span className="hidden sm:inline">{t("myReports.newUpdate")}</span>
                      </span>
                    )}
                    <span className={`${classes.status} ${statusClass[report.status as ModerationReportStatus] ?? classes.statusMuted}`}>
                      {statusLabel}
                    </span>
                  </span>
                }
              >
                <dl className={classes.facts}>
                  <div>
                    <dt className={classes.factLabel}>{t("buyerRequests.status")}</dt>
                    <dd className={classes.factValue}>{statusLabel}</dd>
                  </div>
                  <div>
                    <dt className={classes.factLabel}>{t("report.reason")}</dt>
                    <dd className={classes.factValue}>{getModerationReportReasonLabel(report.reason_code, t)}</dd>
                  </div>
                  <div>
                    <dt className={classes.factLabel}>{t("myReports.resolution")}</dt>
                    <dd className={classes.factValue}>
                      {getModerationReportResolutionLabel(report.resolution_code, t)}
                    </dd>
                  </div>
                  <div>
                    <dt className={classes.factLabel}>{t("myReports.resolved")}</dt>
                    <dd className={classes.factValue}>{dateText(report.resolved_at, locale)}</dd>
                  </div>
                </dl>

                {report.reason_details && (
                  <p className={classes.details}>
                    <span className={classes.detailsLabel}>{t("myReports.yourDetails")}</span> {report.reason_details}
                  </p>
                )}

                {report.reporter_status_message && (
                  <div className={classes.update}>
                    <strong>{t("myReports.moderatorUpdate")}</strong> {report.reporter_status_message}
                    {report.reporter_status_updated_at && (
                      <> <span>{t("myReports.updated", { date: dateText(report.reporter_status_updated_at, locale, true) })}</span></>
                    )}
                  </div>
                )}
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyReports;
