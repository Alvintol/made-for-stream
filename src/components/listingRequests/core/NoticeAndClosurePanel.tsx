import { useState } from "react";

import { FadeIn } from "../../../lib/motion";
import { supabase } from "../../../lib/supabaseClient";
import { useListingRequestNotices } from "../../../hooks/creatorRequests/useListingRequestNotices";
import {
  useSendListingRequestFinalNotice,
  useSendListingRequestFirstNotice,
} from "../../../hooks/creatorRequests/useSendListingRequestNotice";
import {
  useFlagListingRequestForEarlyReview,
  type ListingRequestEarlyReviewCategory,
} from "../../../hooks/creatorRequests/useFlagListingRequestForEarlyReview";
import { useListingRequestEarlyReviewFlags } from "../../../hooks/creatorRequests/useListingRequestEarlyReviewFlags";
import {
  canRequestClosure,
  canSendFinalNotice,
  getListingRequestNoticeClockState,
} from "../../../domain/listings/listingRequestNotices";

type NoticeAndClosurePanelProps = {
  requestId: string;
  currentUserId: string;
};

const classes = {
  card: "card p-6 space-y-4",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  infoBox: "notice noticeWarning space-y-2",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary: "btnPrimary btnSm",
  btnDanger: "btnDangerOutline btnSm",
  btnOutline: "btnOutline btnSm",
  textarea:
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none",
  select:
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none",
  hint: "text-xs text-zinc-500",
} as const;

const EARLY_REVIEW_LABELS: Record<ListingRequestEarlyReviewCategory, string> = {
  missed_essential_deadline: "A promised essential deadline was missed",
  credible_fraud: "There is credible fraud",
  creator_cannot_complete: "The creator says they cannot complete the project",
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// Sprint 6 (launch-scope.md section 7): the non-response notice clock and
// early-review request, in the workspace. Administrative closure itself is
// admin-only (admin_close_listing_request_for_non_response,
// 20260922_133) -- once the final notice has expired, this panel's action
// is a plain conversation message asking for it, not a self-service close.
const NoticeAndClosurePanel = ({
  requestId,
  currentUserId,
}: NoticeAndClosurePanelProps) => {
  const noticesQuery = useListingRequestNotices(requestId);
  const flagsQuery = useListingRequestEarlyReviewFlags(requestId);

  const sendFirstNotice = useSendListingRequestFirstNotice();
  const sendFinalNotice = useSendListingRequestFinalNotice();
  const flagEarlyReview = useFlagListingRequestForEarlyReview();

  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [requestedAction, setRequestedAction] = useState("");
  const [showEarlyReviewForm, setShowEarlyReviewForm] = useState(false);
  const [category, setCategory] =
    useState<ListingRequestEarlyReviewCategory>("missed_essential_deadline");
  const [note, setNote] = useState("");
  const [closureRequested, setClosureRequested] = useState(false);
  const [closureRequestError, setClosureRequestError] = useState<string | null>(null);

  const notices = noticesQuery.data ?? [];
  const clock = getListingRequestNoticeClockState(notices);
  const latestNotice = notices[notices.length - 1] ?? null;
  const pendingEarlyReviewFlag = (flagsQuery.data ?? []).find(
    (flag) => flag.status === "pending"
  );
  const approvedEarlyReviewFlag = (flagsQuery.data ?? []).find(
    (flag) => flag.status === "approved"
  );

  const isSenderOfLatestNotice = latestNotice?.sender_user_id === currentUserId;

  const handleSendFirstNotice = async () => {
    const trimmed = requestedAction.trim();

    if (trimmed.length < 10) {
      return;
    }

    await sendFirstNotice.mutateAsync({ requestId, requestedAction: trimmed });
    setShowNoticeForm(false);
    setRequestedAction("");
  };

  const handleSendFinalNotice = async () => {
    await sendFinalNotice.mutateAsync({ requestId });
  };

  const handleFlagEarlyReview = async () => {
    const trimmed = note.trim();

    if (trimmed.length < 10) {
      return;
    }

    await flagEarlyReview.mutateAsync({ requestId, category, note: trimmed });
    setShowEarlyReviewForm(false);
    setNote("");
  };

  // No dedicated RPC -- a closure request just needs to be visible to
  // admins, and every admin already reads the conversation for a request
  // they're looking into. RLS (20260429_036) already lets a participant
  // insert a plain 'text' message directly.
  const handleRequestClosure = async () => {
    setClosureRequestError(null);

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_request_id", requestId)
      .maybeSingle();

    if (conversationError || !conversation) {
      setClosureRequestError("This commission's conversation could not be found.");
      return;
    }

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: conversation.id,
      sender_user_id: currentUserId,
      message_type: "text",
      body:
        "I am requesting administrative closure of this project due to non-response, per the final notice above.",
    });

    if (error) {
      setClosureRequestError(error.message);
      return;
    }

    setClosureRequested(true);
  };

  if (noticesQuery.isLoading) {
    return null;
  }

  return (
    <div className={classes.card}>
      <div className={classes.title}>Non-response notices</div>

      {clock.state === "no_notice" && !showNoticeForm && (
        <p className={classes.text}>
          If the other party has stopped responding, send a notice stating
          what you need. They'll have 7 days to reply before a final notice
          can follow.
        </p>
      )}

      {clock.state === "first_notice_waiting" && (
        <div className={classes.infoBox}>
          <p>
            {isSenderOfLatestNotice ? "You sent" : "You received"} a first
            notice. A reply is needed by{" "}
            {new Date(clock.expiresAt).toLocaleString()}.
          </p>
        </div>
      )}

      {clock.state === "first_notice_expired" && (
        <div className={classes.infoBox}>
          <p>
            The first notice expired on{" "}
            {new Date(clock.expiresAt).toLocaleString()} with no reply.
            {isSenderOfLatestNotice
              ? " You may send a final notice."
              : " The other party may send a final notice."}
          </p>

          {isSenderOfLatestNotice && latestNotice && (
            <div className={classes.row}>
              {sendFinalNotice.error && (
                <div className={classes.errorBox}>
                  {getErrorMessage(
                    sendFinalNotice.error,
                    "The final notice could not be sent."
                  )}
                </div>
              )}

              <button
                className={classes.btnDanger}
                type="button"
                disabled={
                  sendFinalNotice.isPending ||
                  !canSendFinalNotice(latestNotice)
                }
                onClick={() => void handleSendFinalNotice()}
              >
                {sendFinalNotice.isPending
                  ? "Sending final notice…"
                  : "Send final notice"}
              </button>
            </div>
          )}
        </div>
      )}

      {clock.state === "final_notice_waiting" && (
        <div className={classes.infoBox}>
          <p>
            {isSenderOfLatestNotice ? "You sent" : "You received"} a final
            notice, granting until{" "}
            {new Date(clock.expiresAt).toLocaleString()}. After that,{" "}
            {isSenderOfLatestNotice ? "you" : "the other party"} may commission
            administrative closure.
          </p>
        </div>
      )}

      {clock.state === "final_notice_expired" && (
        <div className={classes.infoBox}>
          <p>
            The final notice expired on{" "}
            {new Date(clock.expiresAt).toLocaleString()} with no reply.
            {isSenderOfLatestNotice
              ? " You may request administrative closure. An admin decides -- this is not automatic."
              : ""}
          </p>

          {isSenderOfLatestNotice && latestNotice && (
            <div className={classes.row}>
              {closureRequestError && (
                <div className={classes.errorBox}>{closureRequestError}</div>
              )}

              <button
                className={classes.btnDanger}
                type="button"
                disabled={
                  closureRequested || !canRequestClosure(latestNotice)
                }
                onClick={() => void handleRequestClosure()}
              >
                {closureRequested
                  ? "Closure requested"
                  : "Request administrative closure"}
              </button>
            </div>
          )}
        </div>
      )}

      {clock.state === "answered" && (
        <p className={classes.text}>
          The last notice was answered on{" "}
          {new Date(clock.answeredAt).toLocaleString()}.
        </p>
      )}

      {(clock.state === "no_notice" || clock.state === "answered") && (
        <>
          {showNoticeForm ? (
            <FadeIn className="space-y-3">
              {sendFirstNotice.error && (
                <div className={classes.errorBox}>
                  {getErrorMessage(
                    sendFirstNotice.error,
                    "The notice could not be sent."
                  )}
                </div>
              )}

              <label htmlFor="notice-requested-action" className={classes.hint}>
                What do you need from the other party? (10-1000 characters)
              </label>

              <textarea
                id="notice-requested-action"
                className={classes.textarea}
                rows={3}
                value={requestedAction}
                disabled={sendFirstNotice.isPending}
                onChange={(event) => setRequestedAction(event.target.value)}
              />

              <div className={classes.row}>
                <button
                  className={classes.btnPrimary}
                  type="button"
                  disabled={
                    sendFirstNotice.isPending ||
                    requestedAction.trim().length < 10
                  }
                  onClick={() => void handleSendFirstNotice()}
                >
                  {sendFirstNotice.isPending ? "Sending…" : "Send notice"}
                </button>

                <button
                  className={classes.btnOutline}
                  type="button"
                  disabled={sendFirstNotice.isPending}
                  onClick={() => {
                    setShowNoticeForm(false);
                    setRequestedAction("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </FadeIn>
          ) : (
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => setShowNoticeForm(true)}
            >
              Send a notice
            </button>
          )}
        </>
      )}

      <div className="border-t border-zinc-100 pt-4 space-y-2">
        <div className={classes.title}>Early review</div>
        <p className={classes.text}>
          Skip the waiting period if an essential deadline was missed, there
          is credible fraud, or the creator says they cannot complete. An
          admin reviews and decides -- this does not close anything by
          itself.
        </p>

        {pendingEarlyReviewFlag && (
          <p className={classes.hint}>
            An early review request is pending admin decision.
          </p>
        )}

        {approvedEarlyReviewFlag && (
          <p className={classes.hint}>
            An early review request was approved on{" "}
            {approvedEarlyReviewFlag.reviewed_at &&
              new Date(approvedEarlyReviewFlag.reviewed_at).toLocaleString()}
            .
          </p>
        )}

        {!pendingEarlyReviewFlag &&
          (showEarlyReviewForm ? (
            <FadeIn className="space-y-3">
              {flagEarlyReview.error && (
                <div className={classes.errorBox}>
                  {getErrorMessage(
                    flagEarlyReview.error,
                    "The early review request could not be sent."
                  )}
                </div>
              )}

              <label htmlFor="early-review-category" className={classes.hint}>
                Reason
              </label>

              <select
                id="early-review-category"
                className={classes.select}
                value={category}
                disabled={flagEarlyReview.isPending}
                onChange={(event) =>
                  setCategory(
                    event.target.value as ListingRequestEarlyReviewCategory
                  )
                }
              >
                {Object.entries(EARLY_REVIEW_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label htmlFor="early-review-note" className={classes.hint}>
                Explain what happened (10-2000 characters)
              </label>

              <textarea
                id="early-review-note"
                className={classes.textarea}
                rows={3}
                value={note}
                disabled={flagEarlyReview.isPending}
                onChange={(event) => setNote(event.target.value)}
              />

              <div className={classes.row}>
                <button
                  className={classes.btnPrimary}
                  type="button"
                  disabled={flagEarlyReview.isPending || note.trim().length < 10}
                  onClick={() => void handleFlagEarlyReview()}
                >
                  {flagEarlyReview.isPending ? "Sending…" : "Request early review"}
                </button>

                <button
                  className={classes.btnOutline}
                  type="button"
                  disabled={flagEarlyReview.isPending}
                  onClick={() => {
                    setShowEarlyReviewForm(false);
                    setNote("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </FadeIn>
          ) : (
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => setShowEarlyReviewForm(true)}
            >
              Request early review
            </button>
          ))}
      </div>
    </div>
  );
};

export default NoticeAndClosurePanel;
