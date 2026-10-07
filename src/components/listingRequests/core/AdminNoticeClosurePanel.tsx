import { useState } from "react";

import { useListingRequestNotices } from "../../../hooks/creatorRequests/useListingRequestNotices";
import { useListingRequestEarlyReviewFlags } from "../../../hooks/creatorRequests/useListingRequestEarlyReviewFlags";
import { useAdminDecideListingRequestEarlyReview } from "../../../hooks/admin/useAdminDecideListingRequestEarlyReview";
import { useAdminCloseListingRequestForNonResponse } from "../../../hooks/admin/useAdminCloseListingRequestForNonResponse";
import { getListingRequestNoticeClockState } from "../../../domain/listings/listingRequestNotices";

type AdminNoticeClosurePanelProps = {
  requestId: string;
  buyerUserId: string;
  creatorUserId: string;
};

const classes = {
  card: "card p-6 space-y-4",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary: "btnPrimary btnSm",
  btnDanger: "btnDangerOutline btnSm",
  btnOutline: "btnOutline btnSm",
  textarea:
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none",
  select:
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none",
  hint: "text-xs text-zinc-500",
  list: "space-y-1 text-sm",
} as const;

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// Sprint 6 (launch-scope.md section 7): admin's view of the notice clock,
// early-review queue, and the closure action itself.
// admin_close_listing_request_for_non_response (20260922_133) re-verifies
// every precondition server-side -- this form just picks branch and reason;
// the RPC decides whether it's actually allowed.
const AdminNoticeClosurePanel = ({
  requestId,
  buyerUserId,
  creatorUserId,
}: AdminNoticeClosurePanelProps) => {
  const noticesQuery = useListingRequestNotices(requestId);
  const flagsQuery = useListingRequestEarlyReviewFlags(requestId);
  const decideEarlyReview = useAdminDecideListingRequestEarlyReview();
  const closeRequest = useAdminCloseListingRequestForNonResponse();

  const [branch, setBranch] = useState<"buyer_unresponsive" | "creator_unresponsive">(
    "creator_unresponsive"
  );
  const [reason, setReason] = useState("");
  const [earlyReviewFlagId, setEarlyReviewFlagId] = useState<string | null>(null);

  const notices = noticesQuery.data ?? [];
  const clock = getListingRequestNoticeClockState(notices);
  const flags = flagsQuery.data ?? [];
  const approvedFlag = flags.find((flag) => flag.status === "approved");

  const requestedByUserId =
    branch === "buyer_unresponsive" ? creatorUserId : buyerUserId;

  const closureEligible =
    clock.state === "final_notice_expired" || Boolean(approvedFlag);

  const handleClose = async () => {
    const trimmed = reason.trim();

    if (trimmed.length < 10) {
      return;
    }

    await closeRequest.mutateAsync({
      requestId,
      branch,
      requestedByUserId,
      reason: trimmed,
      earlyReviewFlagId,
    });

    setReason("");
  };

  return (
    <div className={classes.card}>
      <div className={classes.title}>Non-response notices &amp; closure</div>

      {notices.length === 0 ? (
        <p className={classes.text}>No notices have been sent on this commission.</p>
      ) : (
        <ul className={classes.list}>
          {notices.map((notice) => (
            <li key={notice.id}>
              <strong>{notice.notice_type === "final" ? "Final" : "First"} notice</strong>{" "}
              sent {new Date(notice.sent_at).toLocaleString()}, expires{" "}
              {new Date(notice.expires_at).toLocaleString()}
              {notice.answered_at
                ? `, answered ${new Date(notice.answered_at).toLocaleString()}`
                : ""}{" "}
              (email: {notice.email_status})
            </li>
          ))}
        </ul>
      )}

      {flags.length > 0 && (
        <div className="space-y-2">
          <div className={classes.title}>Early review requests</div>

          {decideEarlyReview.error && (
            <div className={classes.errorBox}>
              {getErrorMessage(
                decideEarlyReview.error,
                "This decision could not be recorded."
              )}
            </div>
          )}

          <ul className={classes.list}>
            {flags.map((flag) => (
              <li key={flag.id} className="space-y-1">
                <div>
                  <strong>{flag.category.replace(/_/g, " ")}</strong> ({flag.status}):{" "}
                  {flag.note}
                </div>

                {flag.status === "pending" && (
                  <div className={classes.row}>
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      disabled={decideEarlyReview.isPending}
                      onClick={() =>
                        void decideEarlyReview.mutateAsync({
                          flagId: flag.id,
                          decision: "approved",
                        })
                      }
                    >
                      Approve
                    </button>

                    <button
                      className={classes.btnOutline}
                      type="button"
                      disabled={decideEarlyReview.isPending}
                      onClick={() =>
                        void decideEarlyReview.mutateAsync({
                          flagId: flag.id,
                          decision: "declined",
                        })
                      }
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-zinc-100 pt-4 space-y-3">
        <div className={classes.title}>Administrative closure</div>

        <p className={classes.text}>
          Only possible once a final notice has expired unanswered, or an
          early review request is approved. Not a finding that the work
          delivered so far was satisfactory (Refund Policy §6).
        </p>

        {!closureEligible && (
          <p className={classes.hint}>Not yet eligible for closure.</p>
        )}

        {closeRequest.error && (
          <div className={classes.errorBox}>
            {getErrorMessage(closeRequest.error, "This commission could not be closed.")}
          </div>
        )}

        <label htmlFor="admin-closure-branch" className={classes.hint}>
          Who was unresponsive?
        </label>

        <select
          id="admin-closure-branch"
          className={classes.select}
          value={branch}
          disabled={closeRequest.isPending}
          onChange={(event) =>
            setBranch(event.target.value as "buyer_unresponsive" | "creator_unresponsive")
          }
        >
          <option value="creator_unresponsive">
            Creator unresponsive (cancels and refunds unearned amounts)
          </option>
          <option value="buyer_unresponsive">
            Buyer unresponsive (cancels unfinished work; refund available on
            commission)
          </option>
        </select>

        {approvedFlag && (
          <label className={classes.hint}>
            <input
              type="checkbox"
              checked={earlyReviewFlagId === approvedFlag.id}
              onChange={(event) =>
                setEarlyReviewFlagId(event.target.checked ? approvedFlag.id : null)
              }
            />{" "}
            Base this closure on the approved early review request instead of
            waiting for a final notice.
          </label>
        )}

        <label htmlFor="admin-closure-reason" className={classes.hint}>
          Closure reason (10-1000 characters, recorded on the commission)
        </label>

        <textarea
          id="admin-closure-reason"
          className={classes.textarea}
          rows={3}
          value={reason}
          disabled={closeRequest.isPending}
          onChange={(event) => setReason(event.target.value)}
        />

        <button
          className={classes.btnDanger}
          type="button"
          disabled={
            closeRequest.isPending ||
            reason.trim().length < 10 ||
            (!closureEligible && !earlyReviewFlagId)
          }
          onClick={() => void handleClose()}
        >
          {closeRequest.isPending ? "Closing…" : "Administratively close commission"}
        </button>
      </div>
    </div>
  );
};

export default AdminNoticeClosurePanel;
