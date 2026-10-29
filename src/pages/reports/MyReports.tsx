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

const dateText = (value: string | null, withTime = false) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
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
    { value: "all", label: "All", count: reports.length },
    { value: "active", label: "Active", count: activeReports.length },
    { value: "updates", label: "Updates", count: reportsWithUpdates.length },
    { value: "resolved", label: "Resolved", count: resolvedReports.length },
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
          <h2 className={classes.title}>My reports</h2>
          <p className={classes.sub}>Reports you’ve submitted. Internal moderator notes stay private.</p>
        </div>

        {hasReports && (
          <div className={classes.filters} role="tablist" aria-label="Filter reports">
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

      {isLoading && <p className={classes.state}>Loading reports…</p>}

      {error && <div className={classes.error}>Your reports could not be loaded right now.</div>}

      {!isLoading && !error && reports.length === 0 && (
        <p className={classes.state}>You have not submitted any reports yet.</p>
      )}

      {hasReports && filteredReports.length === 0 && (
        <p className={classes.state}>No reports match this filter.</p>
      )}

      {hasReports && filteredReports.length > 0 && (
        <div className={classes.list}>
          {filteredReports.map((report) => {
            const isFresh = report.has_unread_update || freshUpdateIds.has(report.id);
            const statusLabel = getModerationReportStatusLabel(report.status);

            return (
              <CollapsibleSection
                key={report.id}
                headingLevel="h3"
                title={report.target_label}
                summary={`${getModerationReportTargetTypeLabel(report.target_type)} · ${dateText(report.created_at)}`}
                defaultOpen={isFresh}
                badge={
                  <span className={classes.badges}>
                    {isFresh && (
                      <span className={classes.newUpdate}>
                        <span className="sm:hidden">New</span>
                        <span className="hidden sm:inline">New moderator update</span>
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
                    <dt className={classes.factLabel}>Status</dt>
                    <dd className={classes.factValue}>{statusLabel}</dd>
                  </div>
                  <div>
                    <dt className={classes.factLabel}>Reason</dt>
                    <dd className={classes.factValue}>{getModerationReportReasonLabel(report.reason_code)}</dd>
                  </div>
                  <div>
                    <dt className={classes.factLabel}>Resolution</dt>
                    <dd className={classes.factValue}>
                      {getModerationReportResolutionLabel(report.resolution_code)}
                    </dd>
                  </div>
                  <div>
                    <dt className={classes.factLabel}>Resolved</dt>
                    <dd className={classes.factValue}>{dateText(report.resolved_at)}</dd>
                  </div>
                </dl>

                {report.reason_details && (
                  <p className={classes.details}>
                    <span className={classes.detailsLabel}>Your details:</span> {report.reason_details}
                  </p>
                )}

                {report.reporter_status_message && (
                  <div className={classes.update}>
                    <strong>Moderator update:</strong> {report.reporter_status_message}
                    {report.reporter_status_updated_at && (
                      <> <span>Updated {dateText(report.reporter_status_updated_at, true)}.</span></>
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
