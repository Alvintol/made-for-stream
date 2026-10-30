import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  canSendConversationMessage,
  conversationCloseReasonOptions,
  getBuyerImageUploadStatusLabel,
  getConversationCloseReasonLabel,
  getConversationMessageSide,
  isConversationReadOnly,
  nameSystemMessagePeople,
  startsNewConversationDay,
  type ConversationCloseReasonCode,
} from "../../domain/conversations/conversations";
import {
  conversationModerationReportReasonOptions,
  getModerationReportStatusLabel,
  getModerationReportStatusSummary,
  type ModerationReportReasonCode,
} from "../../domain/moderation/moderationReports";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
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
import KeptPlaceholder from "../ui/KeptPlaceholder";

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
  // Names used in automatic lines ("@meowington sent a change order"). The
  // labels above can be "You"; these never are. Default to the labels.
  buyerName?: string;
  creatorName?: string;
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
  // One per day, above that day's first line. Stretches across the thread
  // whichever side the line itself sits on.
  daySeparator:
    "mb-4 flex items-center gap-3 self-stretch text-[11px] font-semibold uppercase tracking-wider text-zinc-500 before:h-px before:flex-1 before:bg-zinc-200 after:h-px after:flex-1 after:bg-zinc-200",
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
  // Rounded rather than a pill, so a line that wraps keeps its padding.
  systemMessage:
    "max-w-[min(100%,32rem)] rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs leading-5 text-zinc-600",
  systemMessageNeutral: "text-center",
  systemMeta: "mb-1 px-1 text-[11px] text-zinc-500",
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

const dateText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

// Inside the thread a line shows only its time; the day is shown once, above
// the first line of that day.
const timeText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
};

const dayText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
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

const ReportStatus = ({ report, title, className }: ReportStatusProps) => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  return (
    <div className={className}>
      <div className={classes.reportStatusTitle}>{title}</div>

      <div className={classes.reportStatusText}>
        {t("chat.reportStatus", { status: getModerationReportStatusLabel(report.status, t) })}
      </div>

      <div className={classes.reportStatusText}>
        {report.reporter_status_message ||
          getModerationReportStatusSummary(report.status, t)}
      </div>

      {report.reporter_status_updated_at && (
        <div className={classes.reportStatusText}>
          {t("chat.lastUpdate", { date: dateText(report.reporter_status_updated_at, locale) })}
        </div>
      )}
    </div>
  );
};

const ConversationThread = ({
  conversation,
  viewer,
  buyerLabel,
  creatorLabel,
  buyerName = buyerLabel,
  creatorName = creatorLabel,
  header,
  readOnlyNotice = null,
  emptyText,
  composerPlaceholder,
}: ConversationThreadProps) => {
  const t = useT();
  const locale = dateLocale(useLanguage());
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
      ? t("chat.moreDetail")
      : closeReasonDetailsTrimmed.length > 1000
        ? t("chat.detailsTooLong")
        : null;

  const reportReasonDetailsError =
    isOtherReportReason && reportReasonDetailsTrimmed.length < 10
      ? t("chat.reportReasonNeeded")
      : reportReasonDetailsTrimmed.length > 1000
        ? t("chat.detailsTooLong")
        : null;

  const imageRequestNoteError =
    imageRequestNoteTrimmed.length > 1000
      ? t("chat.noteTooLong")
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
    ? t("chat.conversationReported", { status: getModerationReportStatusLabel(conversationReport.status, t) })
    : t("chat.reportConversation");

  const getReportMessageButtonText = (messageId: string) => {
    const report = getMessageReport(messageId);

    return report
      ? t("chat.messageReported", { status: getModerationReportStatusLabel(report.status, t) })
      : t("chat.reportMessage");
  };

  const senderRoleText = (senderUserId: string) =>
    senderUserId === conversation.buyer_user_id
      ? t("chat.roleClient")
      : senderUserId === conversation.creator_user_id
        ? t("common.creator")
        : t("chat.roleSystem");

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
    viewer === "buyer" ? t("common.creator") : viewer === "creator" ? t("chat.roleClient") : null;

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
      ? t("chat.allowImages")
      : t("chat.enableImages");

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
            ariaLabel={t("chat.options")}
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
                    {t(showCloseForm ? "chat.cancelEnd" : "chat.end")}
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
            <div className={classes.closedStatusTitle}>{t("chat.ended")}</div>

            <div className={classes.closedStatusList}>
              <div>
                <span className={classes.closedStatusLabel}>{t("chat.statusLabel")}</span>{" "}
                {t("chat.endedStatus")}
              </div>

              <div>
                <span className={classes.closedStatusLabel}>{t("chat.reasonLabel")}</span>{" "}
                {getConversationCloseReasonLabel(conversation.closed_reason_code, t)}
              </div>

              <div>
                <span className={classes.closedStatusLabel}>{t("chat.detailsLabel")}</span>{" "}
                {conversation.closed_reason_details || t("chat.noDetails")}
              </div>

              {conversation.closed_at && (
                <div>
                  <span className={classes.closedStatusLabel}>{t("chat.endedOn")}</span>{" "}
                  {dateText(conversation.closed_at, locale)}
                </div>
              )}
            </div>
          </div>
        )}

        {conversation.status === "admin_locked" && (
          <div className={classes.warningNotice}>
            {t("chat.locked")}
          </div>
        )}

        {readOnlyNotice && conversation.status === "open" && (
          <div className={classes.warningNotice}>{readOnlyNotice}</div>
        )}

        <div ref={closePanelRef} className={classes.panelAnchor}>
          <Collapse open={canCloseConversation && showCloseForm}>
            <div className={classes.dangerPanel}>
              <div className={classes.panelTitle}>{t("chat.end")}</div>

              <div className={classes.warningNotice}>
                {t("chat.endWarning")}
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="closeReason">
                  {t("chat.endReason")}
                </label>

                <select
                  id="closeReason"
                  className={classes.select}
                  value={closeReasonCode}
                  onChange={(event) =>
                    setCloseReasonCode(event.target.value as ConversationCloseReasonCode | "")
                  }
                >
                  <option value="">{t("chat.chooseReason")}</option>

                  {conversationCloseReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {getConversationCloseReasonLabel(option.value, t)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="closeDetails">
                  {t("chat.additionalDetails")}{isOtherCloseReason ? " *" : ""}
                </label>

                <KeptPlaceholder>
                <textarea
                  id="closeDetails"
                  className={classes.textarea}
                  value={closeReasonDetails}
                  onChange={(event) => setCloseReasonDetails(event.target.value)}
                  placeholder={
                    isOtherCloseReason
                      ? t("chat.endRequiredPlaceholder")
                      : t("chat.endOptionalPlaceholder")
                  }
                  maxLength={1000}
                />
                </KeptPlaceholder>

                <div className={classes.hint}>
                  {t("report.characters", { count: closeReasonDetailsTrimmed.length, max: 1000 })}{" "}
                  {t(isOtherCloseReason ? "chat.endRequiredHint" : "chat.endOptionalHint")}
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
                  {t(closeConversationMutation.isPending ? "chat.ending" : "chat.confirmEnd")}
                </button>
              </div>
            </div>
          </Collapse>
        </div>

        {closeConversationMutation.error && (
          <FadeIn className={classes.errorNotice}>
            {t("chat.endFailed")}
          </FadeIn>
        )}

        <div ref={reportPanelRef} className={classes.panelAnchor}>
          <Collapse open={Boolean(reportTarget)}>
            <div className={classes.dangerPanel}>
              <div className={classes.panelTitle}>
                {t(reportPanelType === "message" ? "chat.reportMessage" : "chat.reportConversation")}
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="reportReason">
                  {t("report.reason")}
                </label>

                <select
                  id="reportReason"
                  className={classes.select}
                  value={reportReasonCode}
                  onChange={(event) =>
                    setReportReasonCode(event.target.value as ModerationReportReasonCode | "")
                  }
                >
                  <option value="">{t("chat.chooseReason")}</option>

                  {conversationModerationReportReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(`report.reason.${option.value}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="reportDetails">
                  {t("chat.additionalDetails")}{isOtherReportReason ? " *" : ""}
                </label>

                <KeptPlaceholder>
                <textarea
                  id="reportDetails"
                  className={classes.textarea}
                  value={reportReasonDetails}
                  onChange={(event) => setReportReasonDetails(event.target.value)}
                  placeholder={
                    isOtherReportReason
                      ? t("chat.reportRequiredPlaceholder")
                      : t("chat.reportOptionalPlaceholder")
                  }
                  maxLength={1000}
                />
                </KeptPlaceholder>

                <div className={classes.hint}>
                  {t("report.characters", { count: reportReasonDetailsTrimmed.length, max: 1000 })}{" "}
                  {t(isOtherReportReason ? "chat.reportReasonNeeded" : "chat.reportOptionalHint")}
                </div>

                {reportReasonDetailsError && (
                  <div className={classes.errorNotice}>{reportReasonDetailsError}</div>
                )}
              </div>

              <p className={classes.hint}>{t("report.submitNote")}</p>

              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={!canSubmitReport}
                >
                  {t(reportConversationMutation.isPending ? "chat.submittingReport" : "report.submit")}
                </button>

                <button
                  className={classes.btnOutline}
                  type="button"
                  onClick={closeReportForm}
                  disabled={reportConversationMutation.isPending}
                >
                  {t("report.cancel")}
                </button>
              </div>
            </div>
          </Collapse>
        </div>

        {reportSubmitted && (
          <FadeIn className={classes.successNotice}>
            {t("chat.reportSent")}
          </FadeIn>
        )}

        {reportConversationMutation.error && (
          <FadeIn className={classes.errorNotice}>
            {t("chat.reportFailed")}
          </FadeIn>
        )}

        {conversationReport && !isAdmin && (
          <ReportStatus
            report={conversationReport}
            title={t("chat.conversationReportStatus")}
            className={classes.reportStatusBox}
          />
        )}

        {areMessagesLoading ? (
          <div className={classes.empty}>{t("chat.loading")}</div>
        ) : messagesError ? (
          <div className={classes.errorNotice}>{t("chat.loadFailed")}</div>
        ) : messages.length > 0 ? (
          <div ref={threadRef} className={classes.thread}>
            {messages.map((message, index) => {
              const daySeparator = startsNewConversationDay(
                messages[index - 1]?.created_at ?? null,
                message.created_at
              ) && (
                <div className={classes.daySeparator}>
                  {dayText(message.created_at, locale)}
                </div>
              );

              if (message.message_type === "system") {
                // An automatic line sits on the side of whoever caused it,
                // like their own messages; one nobody in the conversation
                // caused stays in the middle.
                const side = getConversationMessageSide({
                  senderUserId: message.sender_user_id,
                  viewerUserId: currentUserId,
                  buyerUserId: conversation.buyer_user_id,
                  creatorUserId: conversation.creator_user_id,
                });

                const sideClass =
                  side === "own"
                    ? classes.messageRowOwn
                    : side === "other"
                      ? classes.messageRowOther
                      : classes.messageRowSystem;

                return (
                  <div
                    key={message.id}
                    className={`${classes.messageRow} ${sideClass}`}
                    data-side={side}
                  >
                    {daySeparator}

                    <div className={classes.systemMeta}>
                      {t("chat.systemMeta", { time: timeText(message.created_at, locale) })}
                    </div>
                    <div
                      className={`${classes.systemMessage} ${side === "neutral" ? classes.systemMessageNeutral : ""}`}
                    >
                      {nameSystemMessagePeople(message.body ?? "", {
                        buyerName,
                        creatorName,
                      })}
                    </div>
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
                  {daySeparator}

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

                    <span>{timeText(message.created_at, locale)}</span>
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
                        {t("chat.readBy", {
                          name: otherParticipantLabel,
                          date: dateText(otherParticipantLastReadAt, locale),
                        })}
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
                      title={t("chat.messageReportStatus")}
                      className={classes.messageReportStatusBox}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={classes.empty}>{emptyText ?? t("chat.empty")}</div>
        )}

        {sendMessageMutation.error && (
          <FadeIn className={classes.errorNotice}>
            {t("chat.sendFailed")}
          </FadeIn>
        )}

        {!readOnly && (
          <>
            {(requestBuyerImageUploadMutation.error ||
              approveBuyerImageUploadMutation.error ||
              revokeBuyerImageUploadMutation.error) && (
                <FadeIn className={classes.errorNotice}>
                  {t("chat.imagesFailed")}
                </FadeIn>
              )}

            <Collapse open={showImageRequestForm && canRequestImageUpload}>
              <div className={classes.panel}>
                <div className={classes.field}>
                  <label className={classes.label} htmlFor="imageRequestNote">
                    {t("chat.whyImages")}
                  </label>

                  <KeptPlaceholder>
                  <textarea
                    id="imageRequestNote"
                    className={classes.textarea}
                    value={imageRequestNote}
                    onChange={(event) => setImageRequestNote(event.target.value)}
                    placeholder={t("chat.imagesPlaceholder")}
                    maxLength={1000}
                  />
                  </KeptPlaceholder>

                  <div className={classes.hint}>
                    {t("report.characters", { count: imageRequestNoteTrimmed.length, max: 1000 })}
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
                    {t(requestBuyerImageUploadMutation.isPending ? "chat.sendingRequest" : "chat.sendImageRequest")}
                  </button>
                </div>
              </div>
            </Collapse>

            {conversation.buyer_image_upload_status === "requested" &&
              conversation.buyer_image_upload_request_note && (
                <div className={classes.imageNote}>
                  {t("chat.clientNote", { note: conversation.buyer_image_upload_request_note })}
                </div>
              )}

            <div className={classes.composer}>
              <textarea
                aria-label={t("chat.message")}
                className={classes.composerTextarea}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={composerPlaceholder ?? t("chat.placeholder")}
                maxLength={2000}
                disabled={sendMessageMutation.isPending}
              />

              <div className={classes.composerFooter}>
                <div className={classes.composerTools}>
                  <span className={classes.imageStatus}>
                    <span className={classes.imageStatusLabel}>{t("chat.imageSharing")}</span>
                    {getBuyerImageUploadStatusLabel(buyerImageUploadStatus, t)}
                  </span>

                  {canRequestImageUpload && (
                    <button
                      className={classes.utilityButton}
                      type="button"
                      onClick={() => setShowImageRequestForm((current) => !current)}
                      disabled={isImageActionPending}
                    >
                      {t(showImageRequestForm ? "chat.cancelImageRequest" : "chat.requestImages")}
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
                        ? t("chat.allowing")
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
                      {t(revokeBuyerImageUploadMutation.isPending ? "chat.disabling" : "chat.disableImages")}
                    </button>
                  )}
                </div>

                <div className={classes.composerSend}>
                  <span className={classes.counter}>
                    {t("chat.counter", { count: trimmedBody.length })}
                  </span>

                  <button
                    className={classes.btnSend}
                    type="button"
                    onClick={() => void handleSubmitMessage()}
                    disabled={!canSubmit}
                  >
                    {t(sendMessageMutation.isPending ? "common.sending" : "chat.send")}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {isAdmin && (
          <div className={classes.adminNote}>
            {t("chat.adminNote")}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationThread;
