import { formatMoney } from "../../../lib/formatMoney";
import { useId, useState } from "react";
import {
  getActiveListingRequestMilestone,
  getListingRequestMilestonesAreComplete,
  getListingRequestMilestoneStatusLabel,
  getListingRequestMilestoneStatusSummary,
  getListingRequestMilestoneStatusTone,
  getOrderedListingRequestMilestones,
  isListingRequestMilestoneTerminal,
} from "../../../domain/listings/listingRequestMilestones";
import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";
import type { ListingRequestMilestoneSubmissionRow } from "../../../hooks/creatorRequests/useListingRequestMilestoneSubmissions";
import { Disclosure } from "../../../lib/motion";

type ListingRequestMilestoneViewer = "buyer" | "creator" | "admin";

type ListingRequestMilestoneSummaryProps = {
  milestones: ListingRequestMilestoneRow[];
  submissions: ListingRequestMilestoneSubmissionRow[];
  viewer: ListingRequestMilestoneViewer;
  isLoading?: boolean;
  error?: unknown;
};

const classes = {
  section: "space-y-4",
  title: "font-display text-base font-bold tracking-tight",
  text: "text-sm text-zinc-600",
  loading: "notice noticeNeutral",
  empty: "notice noticeNeutral",
  error: "notice noticeError",
  stateCard: "notice noticeInfo",

  list: "divide-y divide-[var(--hairline)] overflow-hidden rounded-xl border border-[var(--hairline)]",
  item: "bg-[rgb(var(--surface))]",
  rowHeading: "text-sm",
  row: "flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[rgb(var(--ink)/0.03)] focus-visible:bg-[rgb(var(--accent-soft))] focus-visible:outline-none",
  marker: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
  markerDone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  markerActive: "border-[rgb(var(--brand))] bg-[rgb(var(--brand)/0.1)] text-[rgb(var(--brand-deep))]",
  markerIdle: "border-zinc-200 bg-zinc-50 text-zinc-500",
  rowText: "min-w-0 flex-1",
  rowIndex: "block text-[11px] font-medium text-zinc-500",
  rowTitle: "block truncate font-semibold text-zinc-900",
  rowTitleDone: "block truncate font-medium text-zinc-500",
  rowAside: "flex shrink-0 items-center gap-2",
  amount: "hidden text-sm font-semibold tabular-nums text-zinc-700 sm:inline",
  status: "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
  statusMuted: "border-zinc-200 bg-zinc-100 text-zinc-700",
  statusReview: "border-amber-200 bg-amber-50 text-amber-800",
  statusSuccess: "border-emerald-200 bg-emerald-50 text-emerald-800",
  statusDanger: "border-red-200 bg-red-50 text-red-700",
  chevron: "h-4 w-4 text-zinc-400 transition-transform duration-200",

  panel: "space-y-3 border-t border-[var(--hairline)] bg-[rgb(var(--ink)/0.015)] px-3 py-3 pl-12 text-sm",
  panelSummary: "text-zinc-600",
  body: "whitespace-pre-wrap text-zinc-700",
  facts: "flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500",
  factValue: "font-semibold text-zinc-800",
  links: "flex flex-wrap gap-2",
  link: "inline-flex items-center rounded-full border border-[var(--hairline-strong)] px-3 py-1 text-xs font-semibold text-[rgb(var(--accent-text))] transition hover:bg-[rgb(var(--accent-soft))]",
  noSubmission: "text-xs text-zinc-500",
  revision: "notice noticeError",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Milestones could not be loaded.";

const formatDate = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value))
    : "Not submitted";

const getStatusClass = (milestone: ListingRequestMilestoneRow): string => {
  const tone = getListingRequestMilestoneStatusTone(milestone.status);

  return tone === "review"
    ? `${classes.status} ${classes.statusReview}`
    : tone === "success"
      ? `${classes.status} ${classes.statusSuccess}`
      : tone === "danger"
        ? `${classes.status} ${classes.statusDanger}`
        : `${classes.status} ${classes.statusMuted}`;
};

const getLatestSubmissionByMilestoneId = (
  submissions: ListingRequestMilestoneSubmissionRow[]
): Map<string, ListingRequestMilestoneSubmissionRow> => {
  const latestByMilestoneId = new Map<string, ListingRequestMilestoneSubmissionRow>();

  submissions.forEach((submission) => {
    const current = latestByMilestoneId.get(submission.milestone_id);

    if (!current || submission.version_number > current.version_number) {
      latestByMilestoneId.set(submission.milestone_id, submission);
    }
  });

  return latestByMilestoneId;
};

const getEmptyMilestoneMessage = (viewer: ListingRequestMilestoneViewer): string =>
  viewer === "creator"
    ? "No milestones are available yet. They will appear here once the buyer accepts a milestone-based agreement."
    : viewer === "buyer"
      ? "No milestones are available yet. They will appear here once the agreement is ready for milestone work."
      : "No milestones are available for this commission yet.";

const getCompletedMilestoneMessage = (viewer: ListingRequestMilestoneViewer): string =>
  viewer === "creator"
    ? "All milestones are complete or closed. You can now prepare the final delivery when the project is ready."
    : viewer === "buyer"
      ? "All milestones are complete or closed. The creator can now prepare the final delivery."
      : "All milestones are complete or closed for this commission.";

type MilestoneRowProps = {
  milestone: ListingRequestMilestoneRow;
  submission: ListingRequestMilestoneSubmissionRow | undefined;
  isActive: boolean;
};

const MilestoneRow = ({ milestone, submission, isActive }: MilestoneRowProps) => {
  const panelId = useId();
  const isDone = isListingRequestMilestoneTerminal(milestone.status);
  const [open, setOpen] = useState(isActive || milestone.status === "revision_requested");

  const markerClass = isDone
    ? classes.markerDone
    : isActive
      ? classes.markerActive
      : classes.markerIdle;

  return (
    <article className={classes.item}>
      <h3 className={classes.rowHeading}>
        <button
          type="button"
          className={classes.row}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={`${classes.marker} ${markerClass}`} aria-hidden="true">
            {isDone ? "✓" : milestone.sort_order + 1}
          </span>

          <span className={classes.rowText}>
            <span className={classes.rowIndex}>Milestone {milestone.sort_order + 1}</span>
            <span className={isDone ? classes.rowTitleDone : classes.rowTitle}>
              {milestone.title}
            </span>
          </span>

          <span className={classes.rowAside}>
            <span className={classes.amount}>
              {formatMoney(milestone.amount, milestone.currency)}
            </span>
            <span className={getStatusClass(milestone)}>
              {getListingRequestMilestoneStatusLabel(milestone.status)}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`${classes.chevron} ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h3>

      <Disclosure open={open} id={panelId} className={classes.panel}>
        <p className={classes.panelSummary}>
          {getListingRequestMilestoneStatusSummary(milestone.status)}
        </p>

        {milestone.description && <p className={classes.body}>{milestone.description}</p>}

        <div className={classes.facts}>
          <span className="sm:hidden">
            {`Amount ${formatMoney(milestone.amount, milestone.currency)}`}
          </span>
          <span>
            Submitted <span className={classes.factValue}>{formatDate(milestone.latest_submitted_at)}</span>
          </span>
        </div>

        {submission ? (
          <>
            <p className={classes.body}>{submission.summary}</p>

            {submission.delivery_links.length > 0 && (
              <div className={classes.links}>
                {submission.delivery_links.map((deliveryLink, index) => (
                  <a
                    className={classes.link}
                    href={deliveryLink}
                    key={`${submission.id}-${index}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Milestone delivery link {index + 1}
                  </a>
                ))}
              </div>
            )}

            {submission.revision_request_reason && (
              <div className={classes.revision}>
                <strong>Revision requested:</strong> {submission.revision_request_reason}
              </div>
            )}
          </>
        ) : (
          <p className={classes.noSubmission}>
            No submission has been made for this milestone yet.
          </p>
        )}
      </Disclosure>
    </article>
  );
};

const ListingRequestMilestoneSummary = ({
  milestones,
  submissions,
  viewer,
  isLoading = false,
  error,
}: ListingRequestMilestoneSummaryProps) => {
  const hasError = Boolean(error);
  const sortedMilestones = getOrderedListingRequestMilestones(milestones);
  const latestSubmissions = getLatestSubmissionByMilestoneId(submissions);
  const activeMilestone = getActiveListingRequestMilestone(sortedMilestones);

  const content = (
    <div className={classes.section}>

      {isLoading && <div className={classes.loading}>Loading milestones…</div>}

      {!isLoading && hasError && <div className={classes.error}>{getErrorMessage(error)}</div>}

      {!isLoading && !hasError && sortedMilestones.length === 0 && (
        <div className={classes.empty}>
          <h3 className={classes.title}>No milestones yet</h3>
          <p className={classes.text}>{getEmptyMilestoneMessage(viewer)}</p>
        </div>
      )}

      {!isLoading && !hasError && sortedMilestones.length > 0 && (
        <>
          {getListingRequestMilestonesAreComplete(sortedMilestones) && (
            <div className={classes.stateCard}>{getCompletedMilestoneMessage(viewer)}</div>
          )}

          <div className={classes.list}>
            {sortedMilestones.map((milestone) => (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                submission={latestSubmissions.get(milestone.id)}
                isActive={milestone.id === activeMilestone?.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return content;
};

export default ListingRequestMilestoneSummary;
