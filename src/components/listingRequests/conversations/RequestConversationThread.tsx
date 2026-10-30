import ConversationThread from "../../conversations/ConversationThread";
import OffSiteReceiptPanel from "./OffSiteReceiptPanel";
import { useRequestConversation } from "../../../hooks/conversations/useRequestConversation";
import { useT } from "../../../lib/i18n/i18n";
type RequestConversationThreadProps = {
  requestId: string;
  buyerLabel: string;
  creatorLabel: string;
  // For automatic lines, when a label above is "You".
  buyerName?: string;
  creatorName?: string;
  viewer: "buyer" | "creator" | "admin";
  requestReadOnly?: boolean;
  requestReadOnlyMessage?: string;
};

const classes = {
  stateCard: "card space-y-3 p-6",
  title: "font-display text-lg font-bold tracking-tight text-zinc-900",
  sub: "pageSub",
  loadingText: "text-sm text-zinc-500",
  errorNotice: "notice noticeError",
} as const;

const RequestConversationThread = ({
  requestId,
  buyerLabel,
  creatorLabel,
  buyerName,
  creatorName,
  viewer,
  requestReadOnly = false,
  requestReadOnlyMessage,
}: RequestConversationThreadProps) => {
  const t = useT();
  const {
    data: conversation,
    isLoading,
    error,
  } = useRequestConversation(requestId);

  if (isLoading) {
    return (
      <div className={classes.stateCard}>
        <div className={classes.loadingText}>{t("requestChat.loading")}</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className={classes.stateCard}>
        <h2 className={classes.title}>{t("requestChat.title")}</h2>
        <div className={classes.errorNotice}>
          {t("requestChat.loadFailed")}
        </div>
      </div>
    );
  }

  return (
    <>
    <OffSiteReceiptPanel
      buyerName={buyerName ?? buyerLabel}
      creatorName={creatorName ?? creatorLabel}
      requestId={requestId}
      viewer={viewer}
    />

    <ConversationThread
      conversation={conversation}
      viewer={viewer}
      buyerLabel={buyerLabel}
      creatorLabel={creatorLabel}
      buyerName={buyerName}
      creatorName={creatorName}
      readOnlyNotice={requestReadOnly ? requestReadOnlyMessage ?? t("requestChat.readOnly") : null}
      emptyText={t("requestChat.empty")}
      composerPlaceholder={t("requestChat.placeholder")}
      header={
        <>
          <h2 className={classes.title}>{t("requestChat.title")}</h2>
          <p className={classes.sub}>{t("requestChat.sub")}</p>
        </>
      }
    />
    </>
  );
};

// Remount per request so drafts and open forms never carry over to a different chat.
const KeyedRequestConversationThread = (props: RequestConversationThreadProps) => (
  <RequestConversationThread key={props.requestId} {...props} />
);

export default KeyedRequestConversationThread;
