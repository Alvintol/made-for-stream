import ConversationThread from "../../conversations/ConversationThread";
import { useRequestConversation } from "../../../hooks/conversations/useRequestConversation";

type RequestConversationThreadProps = {
  requestId: string;
  buyerLabel: string;
  creatorLabel: string;
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
  viewer,
  requestReadOnly = false,
  requestReadOnlyMessage = "This commission is read-only.",
}: RequestConversationThreadProps) => {
  const {
    data: conversation,
    isLoading,
    error,
  } = useRequestConversation(requestId);

  if (isLoading) {
    return (
      <div className={classes.stateCard}>
        <div className={classes.loadingText}>Loading conversation…</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className={classes.stateCard}>
        <h2 className={classes.title}>Messages</h2>
        <div className={classes.errorNotice}>
          Conversation could not be loaded right now.
        </div>
      </div>
    );
  }

  return (
    <ConversationThread
      conversation={conversation}
      viewer={viewer}
      buyerLabel={buyerLabel}
      creatorLabel={creatorLabel}
      readOnlyNotice={requestReadOnly ? requestReadOnlyMessage : null}
      emptyText="No follow-up messages yet."
      composerPlaceholder="Write a follow-up message…"
      header={
        <>
          <h2 className={classes.title}>Messages</h2>
          <p className={classes.sub}>Follow-up messages linked to this commission.</p>
        </>
      }
    />
  );
};

// Remount per request so drafts and open forms never carry over to a different chat.
const KeyedRequestConversationThread = (props: RequestConversationThreadProps) => (
  <RequestConversationThread key={props.requestId} {...props} />
);

export default KeyedRequestConversationThread;
