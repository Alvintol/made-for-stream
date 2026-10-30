import { Link, useParams } from "react-router-dom";
import ConversationThread, {
  type ConversationViewer,
} from "../../components/conversations/ConversationThread";
import { getConversationInitiationReasonLabel } from "../../domain/conversations/conversations";
import {
  useConversationDetails,
  type ConversationDetailsProfile,
} from "../../hooks/conversations/useConversationDetails";
import { useT } from "../../lib/i18n/i18n";
import { useAuth } from "../../providers/AuthProvider";
const classes = {
  page: "space-y-5",
  backLink: "backLink",
  stateCard: "card space-y-3 p-6",
  h1: "pageTitle",
  sub: "pageSub",
  loadingText: "text-sm text-zinc-500",
  errorNotice: "notice noticeError",
} as const;

const profileText = (
  profile: ConversationDetailsProfile | null,
  fallbackUserId: string
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId);

const MessageDetails = () => {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, error } = useConversationDetails(id ?? null);

  const conversation = data?.conversation ?? null;

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
        <h1 className={classes.h1}>{t("messages.conversation")}</h1>
        <div className={classes.errorNotice}>
          {t("requestChat.loadFailed")}
        </div>
      </div>
    );
  }

  const viewer: ConversationViewer =
    user?.id === conversation.buyer_user_id
      ? "buyer"
      : user?.id === conversation.creator_user_id
        ? "creator"
        : null;

  const buyerLabel = profileText(data?.buyer ?? null, conversation.buyer_user_id);
  const creatorLabel = profileText(data?.creator ?? null, conversation.creator_user_id);

  return (
    <div className={classes.page}>
      <Link to="/messages" className={classes.backLink}>
        ← {t("messages.back")}
      </Link>

      <ConversationThread
        conversation={conversation}
        viewer={viewer}
        buyerLabel={buyerLabel}
        creatorLabel={creatorLabel}
        header={
          <>
            <h1 className={classes.h1}>
              {data?.listing?.title ?? conversation.subject ?? t("messages.conversation")}
            </h1>

            <p className={classes.sub}>
              {t("messages.topic", {
                topic: getConversationInitiationReasonLabel(conversation.initiation_reason_code, t),
              })}
            </p>

            <p className={classes.sub}>
              {t("messages.people", { buyer: buyerLabel, creator: creatorLabel })}
            </p>
          </>
        }
      />
    </div>
  );
};

// Remount per conversation so drafts and open forms never carry over to a different chat.
const MessageDetailsPage = () => {
  const { id } = useParams<{ id: string }>();

  return <MessageDetails key={id} />;
};

export default MessageDetailsPage;
