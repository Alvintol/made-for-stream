import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  canSendConversationMessage,
  conversationCloseReasonOptions,
  getBuyerImageUploadStatusLabel,
  getConversationCloseReasonLabel,
  isConversationReadOnly,
  type ConversationCloseReasonCode,
} from "../../domain/conversations/conversations";
import {
  conversationModerationReportReasonOptions,
  getModerationReportStatusLabel,
  getModerationReportStatusSummary,
  type ModerationReportReasonCode,
} from "../../domain/moderation/moderationReports";
import { useCloseConversation } from "../../hooks/conversations/useCloseConversation";
import {
  useApproveBuyerImageUpload,
  useRequestBuyerImageUpload,
  useRevokeBuyerImageUpload,
} from "../../hooks/conversations/useConversationImagePermissions";
import { useConversationMessages } from "../../hooks/conversations/useConversationMessages";
import { useConversationParticipants } from "../../hooks/conversations/useConversationParticipants";
import { useMarkConversationRead } from "../../hooks/conversations/useMarkConversationRead";
import type { RequestConversationRow } from "../../hooks/conversations/useRequestConversation";
import {
  useMyModerationReports,
  type MyModerationReport,
} from "../../hooks/moderation/useMyModerationReports";
import { useSubmitModerationReport } from "../../hooks/moderation/useSubmitModerationReport";
import { Collapse, FadeIn, prefersReducedMotion, useStaggerIn } from "../../lib/motion";
import ActionMenu, { actionMenuItemClasses } from "../ui/ActionMenu";

export type ConversationThreadConversation = Pick<
  RequestConversationRow,
  | "id"
  | "buyer_user_id"
  | "creator_user_id"
  | "status"
  | "closed_at"
  | "closed_reason_code"
  | "closed_reason_details"
  | "buyer_image_upload_status"
  | "buyer_image_upload_request_note"
  | "last_message_at"
  | "last_message_sender_user_id"
>;

export type ConversationViewer = "buyer" | "creator" | "admin" | null;

type ConversationThreadProps = {
  conversation: ConversationThreadConversation;
  viewer: ConversationViewer;
  buyerLabel: string;
  creatorLabel: string;
  header: ReactNode;
  // A set notice makes the thread read-only (e.g. the parent request is closed) even while the conversation is open.
  readOnlyNotice?: string | null;
  emptyText?: string;
  composerPlaceholder?: string;
};

const ghostButton =
  "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";

const classes = {
  card: "card overflow-hidden",
  header:
    "flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6",
  headerContent: "min-w-0 flex-1 space-y-0.5",
  // Safety actions sit behind a small overflow menu so they aren't tapped by accident.
  optionsTrigger:
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800",
  // Clears the sticky site header (and the mobile tab bar) when a form scrolls into view.
  panelAnchor: "scroll-mt-36 lg:scroll-mt-24",
  body: "space-y-4 p-5 sm:p-6",

  statusNotice: "notice noticeNeutral",
  warningNotice: "notice noticeWarning",
  errorNotice: "notice noticeError",
  successNotice: "notice noticeSuccess",

  closedStatusTitle: "font-display text-sm font-bold text-zinc-900",
  closedStatusList: "mt-2 grid gap-1 text-sm text-zinc-600",
  closedStatusLabel: "font-semibold text-zinc-800",

  thread:
    "max-h-[34rem] min-h-[12rem] space-y-5 overflow-y-auto rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-inset ring-zinc-100 sm:p-5",
  empty:
    "flex min-h-[12rem] items-center justify-center rounded-2xl bg-zinc-50/80 px-4 text-center text-sm text-zinc-500 ring-1 ring-inset ring-zinc-100",
  adminNote:
    "rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-center text-sm text-zinc-500",

  messageRow: "group flex flex-col",
  messageRowOwn: "items-end",
  messageRowOther: "items-start",
  messageRowSystem: "items-center",
  messageMeta: "mb-1 flex flex-wrap items-center gap-1.5 px-1 text-xs text-zinc-500",
  messageMetaOwn: "justify-end",
  messageName: "font-semibold text-zinc-800",
  messageRole:
    "rounded-full bg-zinc-200/70 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-zinc-600",
  messageBubble:
    "max-w-[min(100%,36rem)] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6",
  messageBubbleOwn:
    "rounded-br-md bg-gradient-to-b from-[rgb(var(--primary-strong))] to-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow-[0_6px_16px_-8px_rgb(var(--primary)/0.5)]",
  messageBubbleOther:
    "rounded-bl-md border border-zinc-200 bg-white text-zinc-800 shadow-sm",
  systemMessage:
    "max-w-[min(100%,32rem)] rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-center text-xs text-zinc-600",
  systemMeta: "mb-1 text-[11px] text-zinc-500",
  readReceipt: "mt-1 px-1 text-[11px] font-medium text-zinc-500",
  messageActions: "mt-1 px-1",
  messageActionsHidden:
    "mt-1 px-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus-within:opacity-100",
  reportLink:
    "text-[11px] font-medium text-zinc-500 underline-offset-2 transition hover:text-red-600 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:hover:text-zinc-500",

  reportStatusBox:
    "rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900",
  messageReportStatusBox:
    "mt-2 max-w-[min(100%,36rem)] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900",
  reportStatusTitle: "font-semibold",
  reportStatusText: "mt-0.5 text-rose-800/90",

  panel: "space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5",
  dangerPanel: "space-y-4 rounded-2xl border border-red-200 bg-red-50/40 p-4 sm:p-5",
  panelTitle: "font-display text-sm font-bold text-zinc-900",
  field: "space-y-1.5",
  label: "formLabel",
  hint: "formHint",
  select: "formControl",
  textarea: "formControl min-h-[100px]",
  row: "flex flex-wrap items-center gap-2",

  composer:
    "rounded-2xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-[rgb(var(--brand)/0.45)] focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.12)]",
  composerTextarea:
    "block min-h-[96px] w-full resize-y rounded-t-2xl border-0 bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60",
  composerFooter:
    "flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2.5",
  composerTools: "flex min-w-0 flex-wrap items-center gap-2",
  composerSend: "flex items-center gap-3",
  counter: "text-xs tabular-nums text-zinc-500",
  imageStatus:
    "inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600",
  imageStatusLabel: "font-semibold text-zinc-800",
  imageNote: "px-1 text-xs text-zinc-500",
  utilityButton: `${ghostButton} py-1 text-zinc-700`,

  btnPrimary: "btnPrimary",
  btnSend: "btnPrimary px-4 py-2",
  btnOutline: "btnOutline",
  btnDanger: "btnDanger",
} as const;

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

// Scrolls a newly opened form into view and moves focus to its first field.
const revealPanel = (panel: HTMLDivElement | null, fieldId: string) => {
  const frame = requestAnimationFrame(() => {
    panel?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    panel?.querySelector<HTMLElement>(`#${fieldId}`)?.focus({ preventScroll: true });
  });

  return () => cancelAnimationFrame(frame);
};

type ReportStatusProps = {
  report: MyModerationReport;
  title: string;
  className: string;
};

const ReportStatus = ({ report, title, className }: ReportStatusProps) => (
  <div className={className}>
    <div className={classes.reportStatusTitle}>{title}</div>

    <div className={classes.reportStatusText}>
      Status: {getModerationReportStatusLabel(report.status)}
    </div>

    <div className={classes.reportStatusText}>
      {report.reporter_status_message ||
        getModerationReportStatusSummary(report.status)}
    </div>

    {report.reporter_status_updated_at && (
      <div className={classes.reportStatusText}>
        Last update: {dateText(report.reporter_status_updated_at)}
      </div>
    )}
  </div>
);

const ConversationThread = ({
  conversation,
  viewer,
  buyerLabel,
  creatorLabel,
  header,
  readOnlyNotice = null,
  emptyText = "No messages yet.",
  composerPlaceholder = "Write a message…",
}: ConversationThreadProps) => {
  const [body, setBody] = useState("");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeReasonCode, setCloseReasonCode] =
    useState<ConversationCloseReasonCode | "">("");
  const [closeReasonDetails, setCloseReasonDetails] = useState("");
  const [showImageRequestForm, setShowImageRequestForm] = useState(false);
  const [imageRequestNote, setImageRequestNote] = useState("");
  const [reportTarget, setReportTarget] = useState<{
    type: "conversation" | "message";
    messageId: string | null;
  } | null>(null);
  const [reportPanelType, setReportPanelType] =
    useState<"conversation" | "message">("conversation");
  const [reportReasonCode, setReportReasonCode] =
    useState<ModerationReportReasonCode | "">("");
  const [reportReasonDetails, setReportReasonDetails] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const reportPanelRef = useRef<HTMLDivElement>(null);
  const closePanelRef = useRef<HTMLDivElement>(null);
  const lastMarkedReadMessageAtRef = useRef<string | null>(null);

  const {
    messages,
    isLoading: areMessagesLoading,
    error: messagesError,
    currentUserId,
    sendMessageMutation,
  } = useConversationMessages(conversation.id);

  const closeConversationMutation = useCloseConversation();
  const requestBuyerImageUploadMutation = useRequestBuyerImageUpload();
  const approveBuyerImageUploadMutation = useApproveBuyerImageUpload();
  const revokeBuyerImageUploadMutation = useRevokeBuyerImageUpload();
  const reportConversationMutation = useSubmitModerationReport();
  const markConversationReadMutation = useMarkConversationRead();
  const { data: myReports = [] } = useMyModerationReports();
  const { data: participants = [] } = useConversationParticipants(conversation.id);

  useStaggerIn(threadRef, messages.length, {
    resetKey: conversation.id,
    scrollToEnd: true,
  });

  const isAdmin = viewer === "admin";
  const isRestrictedByParent = Boolean(readOnlyNotice);
  const readOnly =
    isAdmin || isRestrictedByParent || isConversationReadOnly(conversation.status);

  const trimmedBody = body.trim();
  const closeReasonDetailsTrimmed = closeReasonDetails.trim();
  const isOtherCloseReason = closeReasonCode === "other";
  const reportReasonDetailsTrimmed = reportReasonDetails.trim();
  const isOtherReportReason = reportReasonCode === "other";
  const imageRequestNoteTrimmed = imageRequestNote.trim();

  const closeReasonDetailsError =
    isOtherCloseReason && closeReasonDetailsTrimmed.length < 10
      ? "Please give more detail."
      : closeReasonDetailsTrimmed.length > 1000
        ? "Additional details must be 1000 characters or less."
        : null;

  const reportReasonDetailsError =
    isOtherReportReason && reportReasonDetailsTrimmed.length < 10
      ? "Please provide a reason for the report."
      : reportReasonDetailsTrimmed.length > 1000
        ? "Additional details must be 1000 characters or less."
        : null;

  const imageRequestNoteError =
    imageRequestNoteTrimmed.length > 1000
      ? "Request note must be 1000 characters or less."
      : null;

  const conversationReport =
    myReports.find(
      (report) =>
        report.target_type === "conversation" &&
        report.conversation_id === conversation.id
    ) ?? null;

  const getMessageReport = (messageId: string) =>
    myReports.find(
      (report) =>
        report.target_type === "conversation_message" &&
        report.conversation_id === conversation.id &&
        report.message_id === messageId
    ) ?? null;

  const hasReportedConversation = Boolean(conversationReport);
  const hasReportedMessage = (messageId: string) => Boolean(getMessageReport(messageId));

  const reportConversationButtonText = conversationReport
    ? `Conversation reported · ${getModerationReportStatusLabel(conversationReport.status)}`
    : "Report conversation";

  const getReportMessageButtonText = (messageId: string) => {
    const report = getMessageReport(messageId);

    return report
      ? `Message reported · ${getModerationReportStatusLabel(report.status)}`
      : "Report message";
  };

  const senderRoleText = (senderUserId: string) =>
    senderUserId === conversation.buyer_user_id
      ? "Client"
      : senderUserId === conversation.creator_user_id
        ? "Creator"
        : "System";

  const senderLabelText = (senderUserId: string) =>
    senderUserId === conversation.buyer_user_id
      ? buyerLabel
      : senderUserId === conversation.creator_user_id
        ? creatorLabel
        : "Made for Stream";

  const otherParticipantUserId =
    viewer === "buyer"
      ? conversation.creator_user_id
      : viewer === "creator"
        ? conversation.buyer_user_id
        : null;

  const otherParticipantLabel =
    viewer === "buyer" ? "Creator" : viewer === "creator" ? "Client" : null;

  const otherParticipantLastReadAt = otherParticipantUserId
    ? participants.find((participant) => participant.user_id === otherParticipantUserId)
      ?.last_read_at ?? null
    : null;

  const hasOtherParticipantReadMessage = (messageCreatedAt: string) => {
    if (!otherParticipantLastReadAt) return false;

    const readAtTime = new Date(otherParticipantLastReadAt).getTime();
    const messageTime = new Date(messageCreatedAt).getTime();

    if (Number.isNaN(readAtTime) || Number.isNaN(messageTime)) return false;

    return readAtTime >= messageTime;
  };

  const latestReadOwnMessageId =
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.message_type !== "system" &&
          message.sender_user_id === currentUserId &&
          hasOtherParticipantReadMessage(message.created_at)
      )?.id ?? null;

  const canSubmit =
    !readOnly &&
    canSendConversationMessage(conversation.status) &&
    trimmedBody.length >= 1 &&
    trimmedBody.length <= 2000 &&
    !sendMessageMutation.isPending;

  const canCloseConversation =
    !isAdmin && !isRestrictedByParent && conversation.status === "open";

  const canConfirmCloseConversation =
    Boolean(closeReasonCode) &&
    !closeReasonDetailsError &&
    !closeConversationMutation.isPending;

  const canSubmitReport =
    Boolean(reportTarget) &&
    Boolean(reportReasonCode) &&
    !reportReasonDetailsError &&
    !reportConversationMutation.isPending;

  const buyerImageUploadStatus = conversation.buyer_image_upload_status ?? "blocked";

  const canRequestImageUpload =
    viewer === "buyer" &&
    !readOnly &&
    (buyerImageUploadStatus === "blocked" || buyerImageUploadStatus === "revoked");

  const canApproveImageUpload =
    viewer === "creator" && !readOnly && buyerImageUploadStatus !== "approved";

  const canRevokeImageUpload =
    viewer === "creator" && !readOnly && buyerImageUploadStatus === "approved";

  const isImageActionPending =
    requestBuyerImageUploadMutation.isPending ||
    approveBuyerImageUploadMutation.isPending ||
    revokeBuyerImageUploadMutation.isPending;

  const approveImageUploadButtonText =
    buyerImageUploadStatus === "requested"
      ? "Allow client images"
      : "Enable client images";

  useEffect(() => {
    if (!reportTarget) return undefined;
    return revealPanel(reportPanelRef.current, "reportReason");
  }, [reportTarget]);

  useEffect(() => {
    if (!showCloseForm) return undefined;
    return revealPanel(closePanelRef.current, "closeReason");
  }, [showCloseForm]);

  useEffect(() => {
    if (isAdmin || !currentUserId) return;

    const latestMessageAt = conversation.last_message_at;
    const latestSenderUserId = conversation.last_message_sender_user_id;

    if (!latestMessageAt || !latestSenderUserId) return;
    if (latestSenderUserId === currentUserId) return;
    if (lastMarkedReadMessageAtRef.current === latestMessageAt) return;
    if (markConversationReadMutation.isPending) return;

    lastMarkedReadMessageAtRef.current = latestMessageAt;

    void markConversationReadMutation.mutateAsync({
      conversationId: conversation.id,
    });
  }, [
    conversation.id,
    conversation.last_message_at,
    conversation.last_message_sender_user_id,
    currentUserId,
    isAdmin,
    markConversationReadMutation,
  ]);

  const handleSubmitMessage = async () => {
    if (!canSubmit) return;

    try {
      await sendMessageMutation.mutateAsync(trimmedBody);
      setBody("");
    } catch {
      // Error is surfaced below
    }
  };

  const handleCloseConversation = async () => {
    if (!closeReasonCode || closeReasonDetailsError) return;

    try {
      await closeConversationMutation.mutateAsync({
        conversationId: conversation.id,
        reasonCode: closeReasonCode,
        reasonDetails: closeReasonDetailsTrimmed,
      });

      setShowCloseForm(false);
      setCloseReasonCode("");
      setCloseReasonDetails("");
    } catch {
      // Error is surfaced below
    }
  };

  const handleRequestImageUpload = async () => {
    if (imageRequestNoteError) return;

    try {
      await requestBuyerImageUploadMutation.mutateAsync({
        conversationId: conversation.id,
        requestNote: imageRequestNoteTrimmed,
      });

      setShowImageRequestForm(false);
      setImageRequestNote("");
    } catch {
      // Error is surfaced below
    }
  };

  const handleApproveImageUpload = async () => {
    try {
      await approveBuyerImageUploadMutation.mutateAsync({
        conversationId: conversation.id,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleRevokeImageUpload = async () => {
    try {
      await revokeBuyerImageUploadMutation.mutateAsync({
        conversationId: conversation.id,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const openReport = (type: "conversation" | "message", messageId: string | null) => {
    setReportSubmitted(false);
    setReportPanelType(type);
    setReportTarget({ type, messageId });
    setReportReasonCode("");
    setReportReasonDetails("");
  };

  const openConversationReport = () => {
    if (hasReportedConversation) return;
    openReport("conversation", null);
  };

  const openMessageReport = (messageId: string) => {
    if (hasReportedMessage(messageId)) return;
    openReport("message", messageId);
  };

  const closeReportForm = () => {
    setReportTarget(null);
    setReportReasonCode("");
    setReportReasonDetails("");
  };

  const handleSubmitReport = async () => {
    if (!reportTarget || !reportReasonCode || reportReasonDetailsError) return;

    try {
      await reportConversationMutation.mutateAsync({
        targetType:
          reportTarget.type === "message" ? "conversation_message" : "conversation",
        conversationId: conversation.id,
        messageId: reportTarget.messageId,
        reasonCode: reportReasonCode,
        reasonDetails: reportReasonDetailsTrimmed,
      });

      setReportSubmitted(true);
      closeReportForm();
    } catch {
      // Error is surfaced below
    }
  };

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <div className={classes.headerContent}>{header}</div>

        {!isAdmin && (
          <ActionMenu
            label={<span aria-hidden="true">⋯</span>}
            ariaLabel="Conversation options"
            showCaret={false}
            triggerClassName={classes.optionsTrigger}
            panelClassName={actionMenuItemClasses.list}
          >
            {(closeMenu) => (
              <>
                <button
                  className={actionMenuItemClasses.item}
                  type="button"
                  onClick={() => {
                    closeMenu();
                    openConversationReport();
                  }}
                  disabled={hasReportedConversation || reportConversationMutation.isPending}
                >
                  {reportConversationButtonText}
                </button>

                {canCloseConversation && (
                  <button
                    className={actionMenuItemClasses.danger}
                    type="button"
                    onClick={() => {
                      closeMenu();
                      setShowCloseForm((current) => !current);
                    }}
                  >
                    {showCloseForm ? "Cancel ending conversation" : "End conversation"}
                  </button>
                )}
              </>
            )}
          </ActionMenu>
        )}
      </div>

      <div className={classes.body}>
        {conversation.status === "closed" && (
          <div className={classes.statusNotice}>
            <div className={classes.closedStatusTitle}>Conversation ended</div>

            <div className={classes.closedStatusList}>
              <div>
                <span className={classes.closedStatusLabel}>Status:</span> This
                conversation has been ended and is now read-only for both parties.
              </div>

              <div>
                <span className={classes.closedStatusLabel}>Reason:</span>{" "}
                {getConversationCloseReasonLabel(conversation.closed_reason_code)}
              </div>

              <div>
                <span className={classes.closedStatusLabel}>Additional details:</span>{" "}
                {conversation.closed_reason_details || "No additional details provided."}
              </div>

              {conversation.closed_at && (
                <div>
                  <span className={classes.closedStatusLabel}>Ended on:</span>{" "}
                  {dateText(conversation.closed_at)}
                </div>
              )}
            </div>
          </div>
        )}

        {conversation.status === "admin_locked" && (
          <div className={classes.warningNotice}>
            This conversation has been locked by an admin and is read-only.
          </div>
        )}

        {readOnlyNotice && conversation.status === "open" && (
          <div className={classes.warningNotice}>{readOnlyNotice}</div>
        )}

        <div ref={closePanelRef} className={classes.panelAnchor}>
          <Collapse open={canCloseConversation && showCloseForm}>
            <div className={classes.dangerPanel}>
              <div className={classes.panelTitle}>End conversation</div>

              <div className={classes.warningNotice}>
                Ending this conversation will make the thread read-only for both
                parties. The message history and reason will remain visible.
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="closeReason">
                  Reason for ending conversation
                </label>

                <select
                  id="closeReason"
                  className={classes.select}
                  value={closeReasonCode}
                  onChange={(event) =>
                    setCloseReasonCode(event.target.value as ConversationCloseReasonCode | "")
                  }
                >
                  <option value="">Choose a reason</option>

                  {conversationCloseReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="closeDetails">
                  Additional details{isOtherCloseReason ? " *" : ""}
                </label>

                <textarea
                  id="closeDetails"
                  className={classes.textarea}
                  value={closeReasonDetails}
                  onChange={(event) => setCloseReasonDetails(event.target.value)}
                  placeholder={
                    isOtherCloseReason
                      ? "Required. Explain why this conversation is being ended."
                      : "Optional. Add context for both parties and admins."
                  }
                  maxLength={1000}
                />

                <div className={classes.hint}>
                  {closeReasonDetailsTrimmed.length}/1000 characters.
                  {isOtherCloseReason
                    ? " Mandatory. Please explain why this conversation is being ended."
                    : " Optional, but helpful for both parties and admins."}
                </div>

                {closeReasonDetailsError && (
                  <div className={classes.errorNotice}>{closeReasonDetailsError}</div>
                )}
              </div>

              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  onClick={() => void handleCloseConversation()}
                  disabled={!canConfirmCloseConversation}
                >
                  {closeConversationMutation.isPending
                    ? "Ending conversation…"
                    : "Confirm end conversation"}
                </button>
              </div>
            </div>
          </Collapse>
        </div>

        {closeConversationMutation.error && (
          <FadeIn className={classes.errorNotice}>
            Conversation could not be ended right now.
          </FadeIn>
        )}

        <div ref={reportPanelRef} className={classes.panelAnchor}>
          <Collapse open={Boolean(reportTarget)}>
            <div className={classes.dangerPanel}>
              <div className={classes.panelTitle}>
                {reportPanelType === "message" ? "Report message" : "Report conversation"}
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="reportReason">
                  Reason
                </label>

                <select
                  id="reportReason"
                  className={classes.select}
                  value={reportReasonCode}
                  onChange={(event) =>
                    setReportReasonCode(event.target.value as ModerationReportReasonCode | "")
                  }
                >
                  <option value="">Choose a reason</option>

                  {conversationModerationReportReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="reportDetails">
                  Additional details{isOtherReportReason ? " *" : ""}
                </label>

                <textarea
                  id="reportDetails"
                  className={classes.textarea}
                  value={reportReasonDetails}
                  onChange={(event) => setReportReasonDetails(event.target.value)}
                  placeholder={
                    isOtherReportReason
                      ? "Required. Explain why this should be reviewed."
                      : "Optional. Add context for the admin reviewing this report."
                  }
                  maxLength={1000}
                />

                <div className={classes.hint}>
                  {reportReasonDetailsTrimmed.length}/1000 characters.
                  {isOtherReportReason
                    ? " Please provide a reason for the report."
                    : " Optional unless you choose Other."}
                </div>

                {reportReasonDetailsError && (
                  <div className={classes.errorNotice}>{reportReasonDetailsError}</div>
                )}
              </div>

              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={!canSubmitReport}
                >
                  {reportConversationMutation.isPending ? "Submitting report…" : "Submit report"}
                </button>

                <button
                  className={classes.btnOutline}
                  type="button"
                  onClick={closeReportForm}
                  disabled={reportConversationMutation.isPending}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Collapse>
        </div>

        {reportSubmitted && (
          <FadeIn className={classes.successNotice}>
            Report submitted. An admin can review it.
          </FadeIn>
        )}

        {reportConversationMutation.error && (
          <FadeIn className={classes.errorNotice}>
            Report could not be submitted right now.
          </FadeIn>
        )}

        {conversationReport && !isAdmin && (
          <ReportStatus
            report={conversationReport}
            title="Conversation report status"
            className={classes.reportStatusBox}
          />
        )}

        {areMessagesLoading ? (
          <div className={classes.empty}>Loading messages…</div>
        ) : messagesError ? (
          <div className={classes.errorNotice}>Messages could not be loaded right now.</div>
        ) : messages.length > 0 ? (
          <div ref={threadRef} className={classes.thread}>
            {messages.map((message) => {
              if (message.message_type === "system") {
                return (
                  <div
                    key={message.id}
                    className={`${classes.messageRow} ${classes.messageRowSystem}`}
                  >
                    <div className={classes.systemMeta}>
                      System · {dateText(message.created_at)}
                    </div>
                    <div className={classes.systemMessage}>{message.body}</div>
                  </div>
                );
              }

              const isOwnMessage = message.sender_user_id === currentUserId;
              const messageReport = getMessageReport(message.id);
              const canReportMessage = !isAdmin && !isOwnMessage;

              return (
                <div
                  key={message.id}
                  className={`${classes.messageRow} ${isOwnMessage ? classes.messageRowOwn : classes.messageRowOther}`}
                >
                  <div
                    className={`${classes.messageMeta} ${isOwnMessage ? classes.messageMetaOwn : ""}`}
                  >
                    <span className={classes.messageName}>
                      {senderLabelText(message.sender_user_id)}
                    </span>

                    <span className={classes.messageRole}>
                      {senderRoleText(message.sender_user_id)}
                    </span>

                    <span aria-hidden="true">·</span>

                    <span>{dateText(message.created_at)}</span>
                  </div>

                  <div
                    className={`${classes.messageBubble} ${isOwnMessage ? classes.messageBubbleOwn : classes.messageBubbleOther}`}
                  >
                    {message.body}
                  </div>

                  {message.id === latestReadOwnMessageId &&
                    otherParticipantLabel &&
                    otherParticipantLastReadAt && (
                      <div className={classes.readReceipt}>
                        Read by {otherParticipantLabel} · {dateText(otherParticipantLastReadAt)}
                      </div>
                    )}

                  {canReportMessage && (
                    <div
                      className={
                        messageReport ? classes.messageActions : classes.messageActionsHidden
                      }
                    >
                      <button
                        className={classes.reportLink}
                        type="button"
                        onClick={() => openMessageReport(message.id)}
                        disabled={
                          hasReportedMessage(message.id) ||
                          reportConversationMutation.isPending
                        }
                      >
                        {getReportMessageButtonText(message.id)}
                      </button>
                    </div>
                  )}

                  {messageReport && !isAdmin && (
                    <ReportStatus
                      report={messageReport}
                      title="Message report status"
                      className={classes.messageReportStatusBox}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={classes.empty}>{emptyText}</div>
        )}

        {sendMessageMutation.error && (
          <FadeIn className={classes.errorNotice}>
            Message could not be sent. Please check the conversation status and try
            again.
          </FadeIn>
        )}

        {!readOnly && (
          <>
            {(requestBuyerImageUploadMutation.error ||
              approveBuyerImageUploadMutation.error ||
              revokeBuyerImageUploadMutation.error) && (
                <FadeIn className={classes.errorNotice}>
                  Image sharing permissions could not be updated right now.
                </FadeIn>
              )}

            <Collapse open={showImageRequestForm && canRequestImageUpload}>
              <div className={classes.panel}>
                <div className={classes.field}>
                  <label className={classes.label} htmlFor="imageRequestNote">
                    Why do you need to send images?
                  </label>

                  <textarea
                    id="imageRequestNote"
                    className={classes.textarea}
                    value={imageRequestNote}
                    onChange={(event) => setImageRequestNote(event.target.value)}
                    placeholder="Optional. Explain what kind of reference images you want to send."
                    maxLength={1000}
                  />

                  <div className={classes.hint}>
                    {imageRequestNoteTrimmed.length}/1000 characters.
                  </div>

                  {imageRequestNoteError && (
                    <div className={classes.errorNotice}>{imageRequestNoteError}</div>
                  )}
                </div>

                <div className={classes.row}>
                  <button
                    className={classes.btnPrimary}
                    type="button"
                    onClick={() => void handleRequestImageUpload()}
                    disabled={Boolean(imageRequestNoteError) || isImageActionPending}
                  >
                    {requestBuyerImageUploadMutation.isPending
                      ? "Sending request…"
                      : "Send image request"}
                  </button>
                </div>
              </div>
            </Collapse>

            {conversation.buyer_image_upload_status === "requested" &&
              conversation.buyer_image_upload_request_note && (
                <div className={classes.imageNote}>
                  Client note: {conversation.buyer_image_upload_request_note}
                </div>
              )}

            <div className={classes.composer}>
              <textarea
                aria-label="Message"
                className={classes.composerTextarea}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={composerPlaceholder}
                maxLength={2000}
                disabled={sendMessageMutation.isPending}
              />

              <div className={classes.composerFooter}>
                <div className={classes.composerTools}>
                  <span className={classes.imageStatus}>
                    <span className={classes.imageStatusLabel}>Image sharing</span>
                    {getBuyerImageUploadStatusLabel(buyerImageUploadStatus)}
                  </span>

                  {canRequestImageUpload && (
                    <button
                      className={classes.utilityButton}
                      type="button"
                      onClick={() => setShowImageRequestForm((current) => !current)}
                      disabled={isImageActionPending}
                    >
                      {showImageRequestForm ? "Cancel image request" : "Request images"}
                    </button>
                  )}

                  {canApproveImageUpload && (
                    <button
                      className={classes.utilityButton}
                      type="button"
                      onClick={() => void handleApproveImageUpload()}
                      disabled={isImageActionPending}
                    >
                      {approveBuyerImageUploadMutation.isPending
                        ? "Allowing…"
                        : approveImageUploadButtonText}
                    </button>
                  )}

                  {canRevokeImageUpload && (
                    <button
                      className={classes.utilityButton}
                      type="button"
                      onClick={() => void handleRevokeImageUpload()}
                      disabled={isImageActionPending}
                    >
                      {revokeBuyerImageUploadMutation.isPending
                        ? "Disabling…"
                        : "Disable images"}
                    </button>
                  )}
                </div>

                <div className={classes.composerSend}>
                  <span className={classes.counter}>{trimmedBody.length}/2000 characters</span>

                  <button
                    className={classes.btnSend}
                    type="button"
                    onClick={() => void handleSubmitMessage()}
                    disabled={!canSubmit}
                  >
                    {sendMessageMutation.isPending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {isAdmin && (
          <div className={classes.adminNote}>
            Admins can review commission messages, but cannot send replies.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationThread;
