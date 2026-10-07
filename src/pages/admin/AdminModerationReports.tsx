import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getModerationReportReasonLabel,
  getModerationReportStatusLabel,
  getModerationReportTargetTypeLabel,
  moderationReportReasonOptions,
  moderationReportStatusOptions,
  type ModerationReportReasonCode,
  type ModerationReportStatus,
  type ModerationReportTargetType,
} from "../../domain/moderation/moderationReports";
import {
  AdminModerationReportTriageFilter,
  useAdminModerationReports,
  type AdminModerationReportFilters,
  type AdminModerationReportItem,
} from "../../hooks/admin/useAdminModerationReports";
import { emptyAdminModerationReportSummary, useAdminModerationReportSummary } from '../../hooks/admin/useAdminModerationReportSummary';

const classes = {
  page: "space-y-6",
  backLink: "backLink",

  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "sectionHeading",
  text: "text-sm text-zinc-600",

  filtersGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-6",
  field: "space-y-2",
  label: "formLabel",
  input:
    "formControl",
  select:
    "formControl",

  grid: "grid gap-4 lg:grid-cols-2",
  reportCard: "card p-5",
  title: "font-display text-lg font-extrabold tracking-tight",
  textMuted: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "metaLabel",
  metaValue: "metaValue",

  row: "flex flex-wrap items-center gap-3",
  pagerText: "text-sm text-zinc-600",

  statusPill:
    "inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800",

  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",
  statusPillBase:
    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
  statusSubmitted:
    "border-orange-200 bg-orange-50 text-orange-800",
  statusUnderReview:
    "border-blue-200 bg-blue-50 text-blue-800",
  statusResolved:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  statusDismissed:
    "border-zinc-300 bg-zinc-100 text-zinc-700",
  statusNeedsChanges:
    "border-amber-200 bg-amber-50 text-amber-800",
  statusUnknown:
    "border-zinc-300 bg-zinc-100 text-zinc-700",

  summaryGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
  summaryCard: "card p-5",
  summaryLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  summaryValue: "mt-2 text-3xl font-extrabold tracking-tight text-zinc-900",
  summaryText: "mt-1 text-sm text-zinc-600",
  summaryError:
    "notice noticeWarning",
  summaryButton:
    "w-full text-left transition hover:-translate-y-[1px] hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] focus:outline-none focus:ring-2 focus:ring-zinc-300",
  summaryCardDisabled: "card p-5",
  summaryHint: "mt-3 text-xs font-semibold text-zinc-500",
} as const;

const pageSize = 20;

const initialFilters: AdminModerationReportFilters = {
  reporterHandle: "",
  reportedHandle: "",
  status: "all",
  reason: "all",
  targetType: "all",
  triage: "all",
};

const targetTypeOptions: Array<{
  value: ModerationReportTargetType;
  label: string;
}> = [
    { value: "conversation", label: "Conversation" },
    { value: "conversation_message", label: "Message" },
    { value: "listing", label: "Listing" },
    { value: "profile", label: "Profile" },
  ];

const triageOptions: Array<{
  value: AdminModerationReportTriageFilter;
  label: string;
}> = [
    { value: "all", label: "All triage" },
    { value: "active", label: "Active reports" },
    { value: "unread_reporter_updates", label: "Unread reporter updates" },
    { value: "profile_under_review", label: "Profiles under review" },
    { value: "hidden_listing", label: "Hidden listings" },
  ];

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

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId);

const conversationStateText = (status: string | null | undefined) =>
  status === "admin_locked"
    ? "Locked by admin"
    : status === "open"
      ? "Open"
      : status
        ? status
        : "Unknown";

const listingVisibilityText = (
  listing: { is_active: boolean; status: string } | null
) => {
  if (!listing) return "Unknown listing";

  return listing.is_active ? "Listing visible" : "Listing hidden";
};

const profileReviewText = (
  state: { is_under_review: boolean } | null
) => (state?.is_under_review ? "Profile under review" : "Not under review");

const reportTargetStateText = (item: AdminModerationReportItem) => {
  if (item.report.target_type === "conversation" || item.report.target_type === "conversation_message") {
    return conversationStateText(item.conversation?.status);
  }

  if (item.report.target_type === "listing") {
    return listingVisibilityText(item.listing);
  }

  if (item.report.target_type === "profile") {
    return profileReviewText(item.profileModerationState);
  }

  return "Unknown target state";
};

const reportTargetDisplayText = (item: AdminModerationReportItem) =>
  item.conversation?.subject ??
  item.listing?.title ??
  item.report.profile_user_id ??
  item.report.listing_id ??
  item.report.target_type;

const reportStatusPillClass = (status: string) => {
  const statusClasses: Record<string, string> = {
    submitted: classes.statusSubmitted,
    under_review: classes.statusUnderReview,
    resolved: classes.statusResolved,
    dismissed: classes.statusDismissed,
    rejected: classes.statusDismissed,
    needs_changes: classes.statusNeedsChanges,
  };

  return `${classes.statusPillBase} ${statusClasses[status] ?? classes.statusUnknown
    }`;
};

const AdminModerationReports = () => {
  const [filters, setFilters] = useState<AdminModerationReportFilters>(
    initialFilters
  );
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAdminModerationReports({
    filters,
    page,
    pageSize,
  });

  const {
    data: summary = emptyAdminModerationReportSummary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useAdminModerationReportSummary();

  const setField = <Key extends keyof AdminModerationReportFilters>(
    key: Key,
    value: AdminModerationReportFilters[Key]
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  };

  const applySummaryFilter = (patch: Partial<AdminModerationReportFilters>) => {
    setFilters((current) => ({
      ...current,
      status: "all",
      targetType: "all",
      triage: "all",
      ...patch,
    }));

    setPage(1);
  };

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;

  const summaryItems = [
    {
      label: "Submitted",
      value: summary.submitted_count,
      text: "Reports waiting for first review.",
      onClick: () => applySummaryFilter({ status: "submitted" }),
    },
    {
      label: "Active",
      value: summary.active_count,
      text: "Reports not resolved yet.",
      onClick: () => applySummaryFilter({ triage: "active" }),
    },
    {
      label: "Resolved",
      value: summary.resolved_count,
      text: "Reports with completed investigations.",
      onClick: () => applySummaryFilter({ status: "resolved" }),
    },
    {
      label: "Unread reporter updates",
      value: summary.unread_reporter_update_count,
      text: "Reporter-visible updates not seen yet.",
      onClick: () =>
        applySummaryFilter({ triage: "unread_reporter_updates" }),
    },
    {
      label: "Profiles under review",
      value: summary.profile_under_review_count,
      text: "Profiles currently flagged for admin review.",
      onClick: () => applySummaryFilter({ triage: "profile_under_review" }),
    },
    {
      label: "Hidden listings",
      value: summary.hidden_listing_count,
      text: "Published listings hidden from public view.",
      onClick: () => applySummaryFilter({ triage: "hidden_listing" }),
    },
  ];


  return (
    <div className={classes.page}>
      <Link to="/admin/dashboard" className={classes.backLink}>
        ← Back to admin dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Reports and moderation</h1>

        <p className={classes.sub}>
          Review reports across conversations, messages, listings, and profiles.
        </p>
      </div>

      <div className={classes.summaryGrid}>
        {summaryItems.map((item) => {
          const content = (
            <>
              <div className={classes.summaryLabel}>{item.label}</div>

              <div className={classes.summaryValue}>
                {isSummaryLoading ? "…" : item.value.toLocaleString()}
              </div>

              <p className={classes.summaryText}>{item.text}</p>

              <div className={classes.summaryHint}>Click to filter reports</div>
            </>
          );

          return (
            <button
              key={item.label}
              className={`${classes.summaryCard} ${classes.summaryButton}`}
              type="button"
              onClick={item.onClick}
            >
              {content}
            </button>
          );
        })}
      </div>

      {summaryError && (
        <div className={classes.summaryError}>
          Summary counts could not be loaded right now.
        </div>
      )}

      <div className={classes.card}>
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Filters</h2>

          <div className={classes.filtersGrid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="reporterHandle">
                Reporter username
              </label>

              <input
                id="reporterHandle"
                className={classes.input}
                value={filters.reporterHandle}
                onChange={(event) =>
                  setField("reporterHandle", event.target.value)
                }
                placeholder="@reporter"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reportedHandle">
                Reported username
              </label>

              <input
                id="reportedHandle"
                className={classes.input}
                value={filters.reportedHandle}
                onChange={(event) =>
                  setField("reportedHandle", event.target.value)
                }
                placeholder="@reported"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="targetType">
                Target type
              </label>

              <select
                id="targetType"
                className={classes.select}
                value={filters.targetType}
                onChange={(event) =>
                  setField(
                    "targetType",
                    event.target.value as "all" | ModerationReportTargetType
                  )
                }
              >
                <option value="all">All targets</option>

                {targetTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="triage">
                Triage
              </label>

              <select
                id="triage"
                className={classes.select}
                value={filters.triage}
                onChange={(event) =>
                  setField(
                    "triage",
                    event.target.value as AdminModerationReportTriageFilter
                  )
                }
              >
                {triageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="status">
                Status
              </label>

              <select
                id="status"
                className={classes.select}
                value={filters.status}
                onChange={(event) =>
                  setField(
                    "status",
                    event.target.value as "all" | ModerationReportStatus
                  )
                }
              >
                <option value="all">All statuses</option>

                {moderationReportStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reason">
                Reason
              </label>

              <select
                id="reason"
                className={classes.select}
                value={filters.reason}
                onChange={(event) =>
                  setField(
                    "reason",
                    event.target.value as "all" | ModerationReportReasonCode
                  )
                }
              >
                <option value="all">All reasons</option>

                {moderationReportReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => {
                setFilters(initialFilters);
                setPage(1);
              }}
            >
              Reset filters
            </button>

            <div className={classes.pagerText}>
              {isLoading ? "Loading…" : `${totalCount} report(s) found`}
            </div>

            {pageCount > 0 && (
              <div className={classes.pagerText}>
                Page {page} of {pageCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Reports could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading reports…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>No reports matched the current filters.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.report.id} className={classes.reportCard}>
                <h2 className={classes.title}>
                  {getModerationReportTargetTypeLabel(item.report.target_type)}
                </h2>

                <p className={classes.textMuted}>
                  Reporter:{" "}
                  {profileText(item.reporter, item.report.reporter_user_id)}
                </p>

                <p className={classes.textMuted}>
                  Reported user:{" "}
                  {profileText(item.reportedUser, item.report.reported_user_id)}
                </p>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Status</div>
                    <div className={reportStatusPillClass(item.report.status)}>
                      {getModerationReportStatusLabel(item.report.status)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Target state</div>
                    <div className={classes.statusPill}>
                      {reportTargetStateText(item)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Reason</div>
                    <div className={classes.metaValue}>
                      {getModerationReportReasonLabel(item.report.reason_code)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Reported</div>
                    <div className={classes.metaValue}>
                      {dateText(item.report.created_at)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Target</div>
                    <div className={classes.metaValue}>
                      {reportTargetDisplayText(item)}
                    </div>
                  </div>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/admin/reports/${item.report.id}`}
                  >
                    Review report
                  </Link>

                  {item.conversation?.listing_request_id && (
                    <Link
                      className={classes.btnOutline}
                      to={`/admin/requests/${item.conversation.listing_request_id}`}
                    >
                      View commission
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              className={classes.btnOutline}
              type="button"
              disabled={pageCount === 0 || page >= pageCount}
              onClick={() =>
                setPage((current) =>
                  pageCount > 0 ? Math.min(pageCount, current + 1) : current
                )
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminModerationReports;