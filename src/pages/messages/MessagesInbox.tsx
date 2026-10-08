import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getConversationDisplayContext,
  getConversationDisplayTitle,
} from "../../domain/conversations/conversationDisplay";
import {
  getInboxFolder,
  inboxFolders,
  isInboxFolder,
  matchesInboxSearch,
  type InboxFolder,
} from "../../domain/conversations/inboxFolders";
import { getListingRequestStatusLabel } from "../../domain/listings/listingRequests";
import {
  INBOX_PAGE_SIZE,
  useInboxMessageSearch,
  useMessagesInbox,
  useOlderMessagesInbox,
  type MessagesInboxItem,
} from "../../hooks/conversations/useMessagesInbox";
import { useMyModerationReports } from "../../hooks/moderation/useMyModerationReports";
import { useStaggerIn } from "../../lib/motion";

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

const classes = {
  page: "space-y-4",
  header: "flex flex-wrap items-end justify-between gap-3",
  h1: "font-display text-2xl font-bold tracking-tight text-zinc-900",
  summaryBox: "text-sm text-zinc-500",
  summaryStrong: "font-semibold text-zinc-900",

  // Folders beside the list on wide screens, a scrolling row above it on
  // narrow ones (the same shape as Settings).
  body: "grid items-start gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]",
  folders:
    "card flex gap-1 overflow-x-auto p-1.5 hover:shadow-[var(--shadow-md)] lg:sticky lg:top-24 lg:flex-col",
  folder:
    "inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
  folderActive: "bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  folderIdle: "text-zinc-600 hover:bg-[rgb(var(--ink)/0.04)] hover:text-zinc-900",
  folderCount: "text-xs font-medium tabular-nums text-zinc-500",
  folderNew:
    "rounded-full bg-[rgb(var(--brand-deep))] px-1.5 py-px text-[10px] font-bold text-white",

  content: "min-w-0 space-y-3",
  toolbar: "card flex flex-wrap items-center gap-3 p-3 hover:shadow-[var(--shadow-md)]",
  search: "formControl min-w-0 flex-1 basis-56",
  filter: "formControl w-auto",
  unreadOnly: "inline-flex items-center gap-2 whitespace-nowrap text-sm text-zinc-700",

  list: "space-y-2",
  item: "card flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
  itemUnread: "ring-1 ring-[rgb(var(--brand)/0.25)]",
  avatar:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--primary-strong))] to-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-display text-sm font-bold uppercase",
  itemMain: "min-w-0 flex-1 space-y-1",
  titleRow: "flex flex-wrap items-center gap-2",
  title: "truncate font-display text-base font-bold tracking-tight text-zinc-900",
  unreadPill: `${pill} bg-[rgb(var(--brand-deep))] text-white`,
  metaLine: "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500",
  metaDot: "text-zinc-300",
  text: "text-sm text-zinc-500",
  preview: "line-clamp-1 text-sm text-zinc-700",
  previewFrom: "font-semibold text-zinc-900",
  itemSide: "flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end",
  statusPill: `${pill} bg-zinc-100 text-zinc-700`,
  updated: "text-xs text-zinc-500",
  open: "btnOutline btnSm",

  loadingText: "text-sm text-zinc-500",
  errorCard: "notice noticeError",
  emptyCard: "card px-6 py-10 text-center",
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
    ? "Commission"
    : value === "listing_inquiry"
      ? "Listing inquiry"
      : "Creator inquiry";

// A commission shows where the commission stands; an inquiry shows whether
// the chat is still open.
const statusText = (item: MessagesInboxItem) =>
  item.requestStatus
    ? getListingRequestStatusLabel(item.requestStatus)
    : item.conversation.status === "open"
      ? "Open"
      : item.conversation.status === "closed"
        ? "Ended"
        : "Admin locked";

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

type RoleFilter = "any" | "buyer" | "creator";

const OLDER = "older";

const MessagesInbox = () => {
  const { data, isLoading, error } = useMessagesInbox();
  const { data: myReports = [] } = useMyModerationReports();

  // The folder lives in the address (/messages?folder=ended), so it survives
  // a reload and other pages can link straight to one.
  const [searchParams, setSearchParams] = useSearchParams();
  const folderParam = searchParams.get("folder");
  const folder: InboxFolder = isInboxFolder(folderParam) ? folderParam : "all";

  // The inbox loads the newest conversations only. Anything older sits
  // behind "Older conversations" and is fetched when that is opened, a page
  // at a time.
  const olderOpen = folderParam === OLDER;
  const older = useOlderMessagesInbox(olderOpen);
  const olderItems = useMemo(
    () => older.data?.pages.flatMap((page) => page.items) ?? [],
    [older.data]
  );

  const [searchText, setSearchText] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [role, setRole] = useState<RoleFilter>("any");

  // Message text is searched in the database, so wait for typing to pause.
  const [pausedSearchText, setPausedSearchText] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setPausedSearchText(searchText), 300);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  const messageSearch = useInboxMessageSearch(pausedSearchText);

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalUnreadCount = data?.totalUnreadCount ?? 0;
  const totalCount = data?.totalCount ?? items.length;
  const olderCount = Math.max(0, totalCount - INBOX_PAGE_SIZE);

  const folderCounts = useMemo(() => {
    const counts: Record<InboxFolder, number> = {
      all: items.length,
      messages: 0,
      active_commissions: 0,
      completed_commissions: 0,
      ended: 0,
    };

    items.forEach((item) => {
      counts[getInboxFolder(item)] += 1;
    });

    return counts;
  }, [items]);

  const visibleItems = useMemo(() => {
    const messageMatches = new Set(searchText.trim().length >= 3 ? (messageSearch.data ?? []) : []);

    return (olderOpen ? olderItems : items).filter(
      (item) =>
        (olderOpen || folder === "all" || getInboxFolder(item) === folder) &&
        (!unreadOnly || item.hasUnread) &&
        (role === "any" || item.viewerRole === role) &&
        (matchesInboxSearch(item, searchText) || messageMatches.has(item.conversation.id))
    );
  }, [items, olderItems, olderOpen, folder, unreadOnly, role, searchText, messageSearch.data]);

  const activeReportCount = myReports.filter((report) => !report.resolved_at).length;
  const unreadReportUpdateCount = myReports.filter((report) => report.has_unread_update).length;

  const listRef = useRef<HTMLDivElement>(null);
  useStaggerIn(listRef, visibleItems.length);

  const isFiltered =
    olderOpen || folder !== "all" || unreadOnly || role !== "any" || searchText.trim() !== "";
  const listLoading = isLoading || (olderOpen && older.isLoading);

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Inbox</h1>

        {!isLoading && !error && (
          <div className={classes.summaryBox}>
            <span className={classes.summaryStrong}>{totalUnreadCount}</span> unread{" "}
            {totalUnreadCount === 1 ? "message" : "messages"} across{" "}
            <span className={classes.summaryStrong}>{totalCount}</span>{" "}
            {totalCount === 1 ? "conversation" : "conversations"}.
          </div>
        )}
      </div>

      <div className={classes.body}>
        <nav className={classes.folders} aria-label="Inbox folders">
          {inboxFolders.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-current={!olderOpen && folder === entry.key ? "page" : undefined}
              className={`${classes.folder} ${!olderOpen && folder === entry.key ? classes.folderActive : classes.folderIdle}`}
              onClick={() =>
                setSearchParams(entry.key === "all" ? {} : { folder: entry.key }, { replace: true })
              }
            >
              {entry.label}
              <span className={classes.folderCount}>{folderCounts[entry.key]}</span>
            </button>
          ))}

          {olderCount > 0 && (
            <button
              type="button"
              aria-current={olderOpen ? "page" : undefined}
              className={`${classes.folder} ${olderOpen ? classes.folderActive : classes.folderIdle}`}
              onClick={() => setSearchParams({ folder: OLDER }, { replace: true })}
            >
              Older conversations
              <span className={classes.folderCount}>{olderCount}</span>
            </button>
          )}

          {/* Reports are not conversations; they have their own page. */}
          <Link
            className={`${classes.folder} ${classes.folderIdle}`}
            to="/settings/reports"
            aria-label={`Reports, ${activeReportCount} active${unreadReportUpdateCount > 0 ? `, ${unreadReportUpdateCount} with new updates` : ""}`}
          >
            Reports
            {unreadReportUpdateCount > 0 ? (
              <span className={classes.folderNew}>{unreadReportUpdateCount} new</span>
            ) : (
              <span className={classes.folderCount}>{activeReportCount}</span>
            )}
          </Link>
        </nav>

        <div className={classes.content}>
          <div className={classes.toolbar}>
            <input
              type="search"
              className={classes.search}
              aria-label="Search conversations and messages"
              placeholder="Search people, commissions and message text…"
              value={searchText}
              onChange={(event) => setSearchText(event.currentTarget.value)}
            />

            <select
              className={classes.filter}
              aria-label="Show conversations where I am"
              value={role}
              onChange={(event) => setRole(event.currentTarget.value as RoleFilter)}
            >
              <option value="any">Buying and selling</option>
              <option value="buyer">Buying</option>
              <option value="creator">Selling</option>
            </select>

            <label className={classes.unreadOnly}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.currentTarget.checked)}
              />
              Unread only
            </label>
          </div>

          {error && <div className={classes.errorCard}>Messages could not be loaded right now.</div>}

          {listLoading && <div className={classes.loadingText}>Loading messages…</div>}

          {!listLoading && !error && olderCount > 0 && !olderOpen && (
            <p className={classes.text}>
              Showing your {INBOX_PAGE_SIZE} most recent conversations. The rest are under
              Older conversations.
            </p>
          )}

          {!listLoading && !error && visibleItems.length === 0 && (
            <div className={classes.emptyCard}>
              <p className={classes.text}>
                {isFiltered
                  ? "Nothing matches. Try another folder, or clear the search and filters."
                  : "You do not have any conversations yet."}
              </p>
            </div>
          )}

          {!listLoading && !error && visibleItems.length > 0 && (
            <div ref={listRef} className={classes.list}>
              {visibleItems.map((item) => {
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
                        {displayContext && (
                          <>
                            <span className={classes.metaDot} aria-hidden="true">•</span>
                            <span>{displayContext}</span>
                          </>
                        )}
                      </div>

                      <div className={classes.preview}>
                        <span className={classes.previewFrom}>
                          {latestSenderText(
                            item.conversation.last_message_sender_user_id,
                            item.conversation.buyer_user_id,
                            item.conversation.creator_user_id
                          )}
                          :
                        </span>{" "}
                        {item.conversation.last_message_preview || "No messages yet."}
                      </div>
                    </div>

                    <div className={classes.itemSide}>
                      <span className={classes.statusPill}>{statusText(item)}</span>
                      <span className={classes.updated}>
                        {dateTimeText(item.conversation.updated_at)}
                      </span>
                      <Link className={classes.open} to={getConversationHref(item)}>
                        Open<span className="sr-only"> conversation</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {olderOpen && older.hasNextPage && (
            <button
              type="button"
              className="btnOutline btnSm"
              disabled={older.isFetchingNextPage}
              onClick={() => void older.fetchNextPage()}
            >
              {older.isFetchingNextPage ? "Loading…" : `Load ${INBOX_PAGE_SIZE} more`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesInbox;
