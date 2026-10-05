import { useEffect, useMemo, useState } from "react";
import { useAdminSellerApplications } from "../../hooks/admin/useAdminSellerApplications";
import {
  useAdminSellerApplicationSamples,
  type SellerApplicationSampleRow,
} from "../../hooks/admin/useAdminSellerApplicationSamples";
import { useReviewSellerApplication } from "../../hooks/creatorApplication/useReviewSellerApplication";
import type { SellerApplicationRow } from "../../hooks/creatorApplication/useMySellerApplication";
import { useCreatorApplicationQueueState } from "../../hooks/creatorApplication/useCreatorApplicationQueueState";
import { useAdminApplicantProfile } from "../../hooks/admin/useAdminApplicantProfile";
import { useAdminApplicantPlatformAccounts } from "../../hooks/admin/useAdminApplicantAccounts";
import {
  assessExternalLink,
  getExternalLinkConfirmMessage,
} from "../../domain/links/externalLinks";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  grid: "grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]",
  card: "card p-6",
  title: "font-display text-base font-extrabold tracking-tight",
  help: "mt-1 text-sm text-zinc-600",

  queueList: "mt-4 space-y-3",
  queueItem:
    "rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50",
  queueItemActive:
    "rounded-2xl border border-[rgb(var(--brand))] bg-white p-4 text-left ring-2 ring-[rgba(244,92,44,0.16)]",
  queueItemTitle: "text-sm font-extrabold text-zinc-900",
  queueItemMeta: "mt-1 text-xs text-zinc-500",

  section: "space-y-4",
  row: "mt-5 flex flex-wrap items-center gap-3",

  statusPills: "flex flex-wrap gap-2",
  pill: "chip",

  field: "space-y-2",
  label: "formLabel",
  textarea:
    "w-full rounded-xl bg-white px-4 py-3 text-sm outline-none transition ring-1 ring-zinc-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70",
  fieldHelp: "text-xs text-zinc-500",

  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  btnDanger:
    "btnDangerOutline",

  sampleList: "space-y-3",
  sampleCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  sampleTitle: "text-sm font-extrabold text-zinc-900",
  sampleMeta: "mt-1 text-xs text-zinc-500",
  sampleDescription: "mt-2 text-sm text-zinc-700",
  sampleLink: "mt-2 inline-flex text-sm font-semibold text-[rgb(var(--accent-text))] underline underline-offset-2 hover:opacity-80",

  sampleUrlBlock: "mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3",
  sampleUrlLabel: "text-[11px] font-bold uppercase tracking-wide text-zinc-500",
  sampleUrlValue: "mt-1 break-all text-xs text-zinc-700",
  sampleKnown: "ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800",
  sampleCaution: "ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900",
  sampleWarnings: "mt-2 list-disc space-y-1 pl-4 text-xs text-amber-900",

  bannerOk: "card border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  bannerErr: "card border border-rose-200 bg-rose-50 p-4 text-rose-900",
  bannerTitle: "text-sm font-extrabold",
  bannerText: "mt-1 text-sm",

  loadingText: "text-sm text-zinc-600",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const getStatusLabel = (application: SellerApplicationRow | null): string =>
  !application
    ? "No application selected"
    : application.status === "approved"
      ? "Approved creator"
      : application.status === "under_review"
        ? "Under review"
        : application.status === "submitted"
          ? "Submitted"
          : application.status === "needs_changes"
            ? "Needs changes"
            : application.status === "rejected"
              ? "Rejected"
              : application.status === "suspended"
                ? "Suspended"
                : "Draft";

const getSampleTypeLabel = (sample: SellerApplicationSampleRow): string =>
  sample.sample_type === "link"
    ? "Link"
    : sample.sample_type === "image"
      ? "Image"
      : "Video";

// A sample link is whatever the applicant typed. It is only made clickable
// when it is an ordinary web link, and an unfamiliar one asks first, showing
// where it really goes (src/domain/links/externalLinks.ts).
const SampleLink = ({ url }: { url: string }) => {
  const link = assessExternalLink(url);

  return (
    <>
      <div className={classes.sampleUrlBlock}>
        <div className={classes.sampleUrlLabel}>Goes to</div>
        <div className={classes.sampleUrlValue}>
          <strong>{link.host ?? "Not a web link"}</strong>{" "}
          <span className={link.level === "known" ? classes.sampleKnown : classes.sampleCaution}>
            {link.level === "known"
              ? "Known site"
              : link.level === "blocked"
                ? "Blocked"
                : "Check before opening"}
          </span>
        </div>

        <div className={classes.sampleUrlLabel}>Full URL</div>
        <div className={classes.sampleUrlValue}>{url.trim()}</div>

        {link.warnings.length > 0 && (
          <ul className={classes.sampleWarnings}>
            {link.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      {link.href && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer"
          className={classes.sampleLink}
          onClick={(event) => {
            if (
              link.level !== "known" &&
              !window.confirm(getExternalLinkConfirmMessage(link))
            ) {
              event.preventDefault();
            }
          }}
        >
          Open sample in a new tab
        </a>
      )}
    </>
  );
};

const AdminCreatorApplications = () => {
  const {
    data: applications = [],
    isLoading: isApplicationsLoading,
    error: applicationsError,
  } = useAdminSellerApplications();

  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(
    null
  );

  const selectedApplication = useMemo(
    () =>
      applications.find((application) => application.id === selectedApplicationId) ??
      applications[0] ??
      null,
    [applications, selectedApplicationId]
  );

  const {
    data: samples = [],
    isLoading: isSamplesLoading,
    error: samplesError,
  } = useAdminSellerApplicationSamples(selectedApplication?.id ?? null);

  const {
    data: queueState,
    isLoading: isQueueStateLoading,
    error: queueStateError,
  } = useCreatorApplicationQueueState();

  const {
    data: applicantProfile,
    isLoading: isApplicantProfileLoading,
    error: applicantProfileError,
  } = useAdminApplicantProfile(selectedApplication?.profile_user_id ?? null);

  const {
    data: applicantPlatformAccounts = [],
    isLoading: isApplicantPlatformsLoading,
    error: applicantPlatformsError,
  } = useAdminApplicantPlatformAccounts(
    selectedApplication?.profile_user_id ?? null
  );

  const reviewMutation = useReviewSellerApplication();

  const [reviewerNotes, setReviewerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedApplicationId && applications[0]?.id) {
      setSelectedApplicationId(applications[0].id);
    }
  }, [applications, selectedApplicationId]);

  useEffect(() => {
    setReviewerNotes(selectedApplication?.reviewer_notes ?? "");
    setRejectionReason(selectedApplication?.rejection_reason ?? "");
  }, [selectedApplication]);

  const combinedErrorText = useMemo(() => {
    const messages = [
      applicationsError ? getErrorMessage(applicationsError) : null,
      samplesError ? getErrorMessage(samplesError) : null,
    ].filter(Boolean);

    return messages.length ? messages.join(" ") : null;
  }, [applicationsError, samplesError]);

  const queueMessage = useMemo(() => {
    if (!queueState) return "Checking review queue capacity…";

    return queueState.isFull
      ? `Queue full: ${queueState.openCount}/${queueState.maxOpen} open applications.`
      : `Queue open: ${queueState.openCount}/${queueState.maxOpen} open, ${queueState.remaining} slot${queueState.remaining === 1 ? "" : "s"} left.`;
  }, [queueState]);

  const onReview = async (
    status: "under_review" | "approved" | "rejected" | "needs_changes" | "suspended"
  ) => {
    setOkMsg(null);
    setErrMsg(null);

    if (!selectedApplication?.id) {
      setErrMsg("Select an application first.");
      return;
    }

    if (status === "rejected" && !rejectionReason.trim()) {
      setErrMsg("Add a rejection reason before rejecting an application.");
      return;
    }

    try {
      await reviewMutation.mutateAsync({
        applicationId: selectedApplication.id,
        status,
        reviewerNotes,
        rejectionReason,
      });

      setOkMsg("Application review updated.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Creator application review</h1>

        <p className={classes.sub}>
          Review submitted creator applications and decide which accounts should
          gain creator access.
        </p>
      </div>

      {okMsg && (
        <div className={classes.bannerOk}>
          <div className={classes.bannerTitle}>Success</div>
          <div className={classes.bannerText}>{okMsg}</div>
        </div>
      )}

      {(errMsg || combinedErrorText) && (
        <div className={classes.bannerErr}>
          <div className={classes.bannerTitle}>Action needed</div>
          <div className={classes.bannerText}>{errMsg ?? combinedErrorText}</div>
        </div>
      )}

      <div className={classes.card}>
        <div className={classes.title}>Queue capacity</div>
        <p className={classes.help}>{queueMessage}</p>
      </div>

      <div className={classes.grid}>
        <div className={classes.card}>
          <div className={classes.title}>Review queue</div>

          <p className={classes.help}>
            Submitted, in-review, and needs-changes applications appear here.
          </p>

          <div className={classes.queueList}>
            {applications.map((application) => {
              const isActive = application.id === selectedApplication?.id;

              return (
                <button
                  key={application.id}
                  className={isActive ? classes.queueItemActive : classes.queueItem}
                  type="button"
                  onClick={() => setSelectedApplicationId(application.id)}
                >
                  <div className={classes.queueItemTitle}>
                    {application.profile_user_id}
                  </div>

                  <div className={classes.queueItemMeta}>
                    Status: {getStatusLabel(application)}
                  </div>

                  <div className={classes.queueItemMeta}>
                    Submitted: {application.submitted_at ?? "Not submitted"}
                  </div>
                </button>
              );
            })}

            {!isApplicationsLoading && applications.length === 0 && (
              <div className={classes.help}>No applications are currently in the queue.</div>
            )}
          </div>
        </div>

        <div className={classes.section}>
          <div className={classes.card}>
            <div className={classes.title}>Selected application</div>

            {!selectedApplication ? (
              <p className={classes.help}>Select an application from the queue.</p>
            ) : (
              <>
                <p className={classes.help}>
                  Review the samples and decide whether this account should receive
                  creator access.
                </p>

                <div className={classes.statusPills}>
                  <span className={classes.pill}>
                    {getStatusLabel(selectedApplication)}
                  </span>

                  <span className={classes.pill}>
                    {applicantProfile?.display_name?.trim() || "Unnamed applicant"}
                  </span>

                  {applicantProfile?.handle && (
                    <span className={classes.pill}>
                      @{applicantProfile.handle}
                    </span>
                  )}
                </div>

                <div className={classes.help}>
                  Applicant ID: {selectedApplication.profile_user_id}
                </div>

                {applicantPlatformAccounts.length > 0 && (
                  <div className={classes.statusPills}>
                    {applicantPlatformAccounts.map((platformAccount) => (
                      <span key={platformAccount.id} className={classes.pill}>
                        {platformAccount.platform}
                        {platformAccount.platform_login
                          ? ` · @${platformAccount.platform_login}`
                          : ""}
                      </span>
                    ))}
                  </div>
                )}

                <div className={classes.row}>
                  <button
                    className={classes.btnOutline}
                    type="button"
                    onClick={() => void onReview("under_review")}
                    disabled={reviewMutation.isPending}
                  >
                    Mark under review
                  </button>

                  <button
                    className={classes.btnPrimary}
                    type="button"
                    onClick={() => void onReview("approved")}
                    disabled={reviewMutation.isPending}
                  >
                    Approve creator
                  </button>

                  <button
                    className={classes.btnOutline}
                    type="button"
                    onClick={() => void onReview("needs_changes")}
                    disabled={reviewMutation.isPending}
                  >
                    Request changes
                  </button>

                  <button
                    className={classes.btnDanger}
                    type="button"
                    onClick={() => void onReview("rejected")}
                    disabled={reviewMutation.isPending}
                  >
                    Reject
                  </button>

                  <button
                    className={classes.btnDanger}
                    type="button"
                    onClick={() => void onReview("suspended")}
                    disabled={reviewMutation.isPending}
                  >
                    Suspend
                  </button>
                </div>
              </>
            )}
          </div>

          <div className={classes.card}>
            <div className={classes.title}>Reviewer notes</div>

            <div className={classes.field}>
              <div className={classes.label}>Notes</div>

              <textarea
                className={classes.textarea}
                rows={5}
                value={reviewerNotes}
                onChange={(event) => setReviewerNotes(event.currentTarget.value)}
                placeholder="Internal notes for why this application should be approved, changed, rejected, or suspended."
                disabled={!selectedApplication || reviewMutation.isPending}
              />
            </div>

            <div className={classes.field}>
              <div className={classes.label}>Rejection reason</div>

              <textarea
                className={classes.textarea}
                rows={4}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.currentTarget.value)}
                placeholder="Optional for changes requests, required when rejecting."
                disabled={!selectedApplication || reviewMutation.isPending}
              />

              <div className={classes.fieldHelp}>
                Rejection reason is shown back to the applicant when relevant.
              </div>
            </div>
          </div>

          <div className={classes.card}>
            <div className={classes.title}>Work samples</div>

            <p className={classes.help}>
              Review sample quality, clarity, and whether the work looks authentic.
            </p>

            <div className={classes.sampleList}>
              {samples.map((sample) => (
                <div key={sample.id} className={classes.sampleCard}>
                  <div className={classes.sampleTitle}>{sample.title}</div>

                  <div className={classes.sampleMeta}>
                    {getSampleTypeLabel(sample)}
                  </div>

                  {sample.description && (
                    <div className={classes.sampleDescription}>
                      {sample.description}
                    </div>
                  )}

                  {sample.url && <SampleLink url={sample.url} />}
                </div>
              ))}

              {!isSamplesLoading && selectedApplication && samples.length === 0 && (
                <div className={classes.help}>No samples found for this application.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(isApplicationsLoading || isSamplesLoading) && (
        <div className={classes.loadingText}>Loading…</div>
      )}
    </div>
  );
};

export default AdminCreatorApplications;