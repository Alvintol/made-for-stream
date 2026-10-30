import { hasErrorMessage } from "../../../lib/errorMessage";
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
import { useLanguage, useT } from "../../../lib/i18n/i18n";
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

const EARLY_REVIEW_CATEGORIES: ListingRequestEarlyReviewCategory[] = [
  "missed_essential_deadline",
  "credible_fraud",
  "creator_cannot_complete",
];

const getErrorMessage = (error: unknown, fallback: string): string =>
  hasErrorMessage(error) ? error.message : fallback;

// Sprint 6 (launch-scope.md section 7): the non-response notice clock and
// early-review request, in the workspace. Administrative closure itself is
// admin-only (admin_close_listing_request_for_non_response,
// 20260922_133) -- once the final notice has expired, this panel's action
// is a plain conversation message asking for it, not a self-service close.
const NoticeAndClosurePanel = ({
  requestId,
  currentUserId,
}: NoticeAndClosurePanelProps) => {
  const t = useT();
  const language = useLanguage();
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
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
      setClosureRequestError(t("notices.conversationMissing"));
      return;
    }

    // The message goes into the chat as written, so it stays English: the
    // admin reading the conversation recognises it.
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
      <div className={classes.title}>{t("notices.title")}</div>

      {clock.state === "no_notice" && !showNoticeForm && (
        <p className={classes.text}>{t("notices.intro")}</p>
      )}

      {clock.state === "first_notice_waiting" && (
        <div className={classes.infoBox}>
          <p>
            {t(isSenderOfLatestNotice ? "notices.firstSent" : "notices.firstReceived", {
              date: formatDateTime(clock.expiresAt),
            })}
          </p>
        </div>
      )}

      {clock.state === "first_notice_expired" && (
        <div className={classes.infoBox}>
          <p>
            {t("notices.firstExpired", { date: formatDateTime(clock.expiresAt) })}{" "}
            {t(isSenderOfLatestNotice ? "notices.youMayFinal" : "notices.otherMayFinal")}
          </p>

          {isSenderOfLatestNotice && latestNotice && (
            <div className={classes.row}>
              {sendFinalNotice.error && (
                <div className={classes.errorBox}>
                  {getErrorMessage(
                    sendFinalNotice.error,
                    t("notices.finalFailed")
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
                {t(sendFinalNotice.isPending ? "notices.sendingFinal" : "notices.sendFinal")}
              </button>
            </div>
          )}
        </div>
      )}

      {clock.state === "final_notice_waiting" && (
        <div className={classes.infoBox}>
          <p>
            {t(isSenderOfLatestNotice ? "notices.finalSent" : "notices.finalReceived", {
              date: formatDateTime(clock.expiresAt),
            })}
          </p>
        </div>
      )}

      {clock.state === "final_notice_expired" && (
        <div className={classes.infoBox}>
          <p>
            {t("notices.finalExpired", { date: formatDateTime(clock.expiresAt) })}
            {isSenderOfLatestNotice && ` ${t("notices.youMayClose")}`}
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
                {t(closureRequested ? "notices.closureRequested" : "notices.requestClosure")}
              </button>
            </div>
          )}
        </div>
      )}

      {clock.state === "answered" && (
        <p className={classes.text}>
          {t("notices.answered", { date: formatDateTime(clock.answeredAt) })}
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
                    t("notices.sendFailed")
                  )}
                </div>
              )}

              <label htmlFor="notice-requested-action" className={classes.hint}>
                {t("notices.needLabel")}
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
                  {t(sendFirstNotice.isPending ? "common.sending" : "notices.send")}
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
                  {t("common.cancel")}
                </button>
              </div>
            </FadeIn>
          ) : (
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => setShowNoticeForm(true)}
            >
              {t("notices.sendOne")}
            </button>
          )}
        </>
      )}

      <div className="border-t border-zinc-100 pt-4 space-y-2">
        <div className={classes.title}>{t("earlyReview.title")}</div>
        <p className={classes.text}>{t("earlyReview.text")}</p>

        {pendingEarlyReviewFlag && (
          <p className={classes.hint}>{t("earlyReview.pending")}</p>
        )}

        {approvedEarlyReviewFlag && (
          <p className={classes.hint}>
            {t("earlyReview.approved", {
              date: approvedEarlyReviewFlag.reviewed_at
                ? formatDateTime(approvedEarlyReviewFlag.reviewed_at)
                : "",
            })}
          </p>
        )}

        {!pendingEarlyReviewFlag &&
          (showEarlyReviewForm ? (
            <FadeIn className="space-y-3">
              {flagEarlyReview.error && (
                <div className={classes.errorBox}>
                  {getErrorMessage(
                    flagEarlyReview.error,
                    t("earlyReview.failed")
                  )}
                </div>
              )}

              <label htmlFor="early-review-category" className={classes.hint}>
                {t("earlyReview.reason")}
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
                {EARLY_REVIEW_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`earlyReview.${value}`)}
                  </option>
                ))}
              </select>

              <label htmlFor="early-review-note" className={classes.hint}>
                {t("earlyReview.explain")}
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
                  {t(flagEarlyReview.isPending ? "common.sending" : "earlyReview.request")}
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
                  {t("common.cancel")}
                </button>
              </div>
            </FadeIn>
          ) : (
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => setShowEarlyReviewForm(true)}
            >
              {t("earlyReview.request")}
            </button>
          ))}
      </div>
    </div>
  );
};

export default NoticeAndClosurePanel;
