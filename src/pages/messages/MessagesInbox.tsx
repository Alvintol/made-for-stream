import { useRef } from "react";
import { Link } from "react-router-dom";
import { useMessagesInbox } from "../../hooks/conversations/useMessagesInbox";
import { useMyModerationReports } from '../../hooks/moderation/useMyModerationReports';
import { getConversationDisplayContext, getConversationDisplayTitle } from '../../domain/conversations/conversationDisplay';
import { useStaggerIn } from "../../lib/motion";

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

const classes = {
  page: "space-y-6",
  header: "flex flex-wrap items-end justify-between gap-4",
  headerText: "space-y-1",
  h1: "font-display text-3xl font-bold tracking-tight text-zinc-900",
  sub: "pageSub",

  summaryBox: "text-sm text-zinc-500",
  summaryStrong: "font-semibold text-zinc-900",

  moderationNav:
    "card flex flex-wrap items-center justify-between gap-4 px-5 py-4",
  moderationNavTextWrap: "space-y-0.5",
  moderationNavTitle: "font-display text-sm font-bold text-zinc-900",
  moderationNavText: "text-sm text-zinc-500",
  row: "flex flex-wrap items-center gap-2",
  reportCountPill: `${pill} bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200`,
  reportCountPillEmpty: `${pill} bg-zinc-100 text-zinc-600`,
  reportUpdatePill: `${pill} bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))]`,
  btnOutline: "btnOutline px-4 py-2",

  list: "space-y-3",
  item:
    "card group flex flex-col gap-4 p-5 sm:flex-row sm:items-center",
  itemUnread: "ring-1 ring-[rgb(var(--brand)/0.25)]",
  avatar:
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--primary-strong))] to-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-display text-sm font-bold uppercase",
  itemMain: "min-w-0 flex-1 space-y-1.5",
  titleRow: "flex flex-wrap items-center gap-2",
  title: "truncate font-display text-base font-bold tracking-tight text-zinc-900",
  unreadPill: `${pill} bg-[rgb(var(--brand-deep))] text-white`,
  metaLine: "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500",
  metaDot: "text-zinc-300",
  text: "text-sm text-zinc-500",
  preview:
    "line-clamp-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-100",
  previewFrom: "font-semibold text-zinc-900",
  itemSide:
    "flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end",
  statusPill: `${pill} bg-zinc-100 text-zinc-700`,
  updated: "text-xs text-zinc-500",
  btnPrimary: "btnPrimary px-4 py-2",

  loadingText: "text-sm text-zinc-500",
  errorCard:
    "notice noticeError",
  emptyCard: "card px-6 py-12 text-center",
} as const;

const dateTimeText = (value: string | null) => {
  if (!value) return "No activity yet";

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

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallback = "Unknown user"
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallback);

const conversationTypeText = (value: string) =>
  value === "listing_request"
    ? "Commission conversation"
    : value === "listing_inquiry"
      ? "Listing inquiry"
      : "Creator inquiry";

const conversationStatusText = (status: string) =>
  status === "open" ? "Open" : status === "closed" ? "Ended" : "Admin locked";

const latestSenderText = (
  senderUserId: string | null,
  buyerUserId: string,
  creatorUserId: string
) =>
  !senderUserId
    ? "No messages yet"
    : senderUserId === buyerUserId
      ? "Client"
      : senderUserId === creatorUserId
        ? "Creator"
        : "System";

const getConversationHref = (item: {
  viewerRole: "buyer" | "creator";
  conversation: {
    id: string;
    conversation_type: string;
    listing_request_id: string | null;
  };
}) =>
  item.conversation.conversation_type === "listing_request" &&
    item.conversation.listing_request_id
    ? item.viewerRole === "creator"
      ? `/creator/requests/${item.conversation.listing_request_id}`
      : `/requests/${item.conversation.listing_request_id}`
    : `/messages/${item.conversation.id}`;

const MessagesInbox = () => {
  const { data, isLoading, error } = useMessagesInbox();

  const {
    data: myReports = [],
    isLoading: isLoadingMyReports,
  } = useMyModerationReports();

  const items = data?.items ?? [];
  const totalUnreadCount = data?.totalUnreadCount ?? 0;

  const activeReportCount = myReports.filter(
    (report) => !report.resolved_at
  ).length;

  const activeReportText =
    activeReportCount === 1
      ? "1 active report"
      : `${activeReportCount} active reports`;

  const unreadReportUpdateCount = myReports.filter(
    (report) => report.has_unread_update
  ).length;

  const unreadReportUpdateText =
    unreadReportUpdateCount === 1
      ? "1 new report update"
      : `${unreadReportUpdateCount} new report updates`;


  const listRef = useRef<HTMLDivElement>(null);
  useStaggerIn(listRef, items.length);

  const hasItems = !isLoading && !error && items.length > 0;

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div className={classes.headerText}>
          <h1 className={classes.h1}>Messages</h1>

          <p className={classes.sub}>
            Messages, listing inquiries, creator inquiries, and commission conversations.
          </p>
        </div>

        {!isLoading && !error && (
          <div className={classes.summaryBox}>
            <span className={classes.summaryStrong}>
              {totalUnreadCount}
            </span>{" "}
            unread {totalUnreadCount === 1 ? "message" : "messages"} across{" "}
            <span className={classes.summaryStrong}>{items.length}</span>{" "}
            {items.length === 1 ? "conversation" : "conversations"}.
          </div>
        )}
      </div>

      <div className={classes.moderationNav}>
        <div className={classes.moderationNavTextWrap}>
          <div className={classes.moderationNavTitle}>Moderation reports</div>

          <p className={classes.moderationNavText}>
            Track reports you have submitted and check review updates from admins.
          </p>
        </div>

        <div className={classes.row}>
          {unreadReportUpdateCount > 0 && (
            <span className={classes.reportUpdatePill}>
              {unreadReportUpdateText}
            </span>
          )}

          <span
            className={
              activeReportCount > 0
                ? classes.reportCountPill
                : classes.reportCountPillEmpty
            }
          >
            {isLoadingMyReports ? "Checking reports…" : activeReportText}
          </span>

          <Link className={classes.btnOutline} to="/settings/reports">
            My reports
          </Link>
        </div>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Messages could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading messages…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.emptyCard}>
          <p className={classes.text}>You do not have any inquiry messages yet.</p>
        </div>
      )}

      {hasItems && (
        <div ref={listRef} className={classes.list}>
          {items.map((item) => {
            const otherParticipantText = profileText(
              item.otherParticipant,
              item.otherParticipantUserId
            );
            const displayContext = getConversationDisplayContext(item);

            return (
              <div
                key={item.conversation.id}
                className={`${classes.item} ${item.hasUnread ? classes.itemUnread : ""}`}
              >
                <div className={classes.avatar} aria-hidden="true">
                  {otherParticipantText.replace(/^@/, "").charAt(0) || "?"}
                </div>

                <div className={classes.itemMain}>
                  <div className={classes.titleRow}>
                    <h2 className={classes.title}>{getConversationDisplayTitle(item)}</h2>

                    {item.hasUnread && (
                      <span className={classes.unreadPill}>
                        {item.unreadCount} new {item.unreadCount === 1 ? "message" : "messages"}
                      </span>
                    )}
                  </div>

                  <div className={classes.metaLine}>
                    <span>With: {otherParticipantText}</span>
                    <span className={classes.metaDot} aria-hidden="true">•</span>
                    <span>{conversationTypeText(item.conversation.conversation_type)}</span>
                  </div>

                  {displayContext && (
                    <p className={classes.text}>{displayContext}</p>
                  )}

                  <div className={classes.preview}>
                    <span className={classes.previewFrom}>
                      {latestSenderText(
                        item.conversation.last_message_sender_user_id,
                        item.conversation.buyer_user_id,
                        item.conversation.creator_user_id
                      )}
                      :
                    </span>{" "}
                    {item.hasUnread ? "Unread: " : ""}
                    {item.conversation.last_message_preview || "No messages yet."}
                  </div>
                </div>

                <div className={classes.itemSide}>
                  <div className={classes.row}>
                    <span className={classes.statusPill}>
                      {conversationStatusText(item.conversation.status)}
                    </span>

                    <span className={classes.updated}>
                      {dateTimeText(item.conversation.updated_at)}
                    </span>
                  </div>

                  <Link
                    className={classes.btnPrimary}
                    to={getConversationHref(item)}
                  >
                    Open conversation
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesInbox;
