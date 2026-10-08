import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ConversationInitiationReasonCode,
  ConversationStatus,
  ConversationType,
} from "../../domain/conversations/conversations";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";

export type MessagesInboxViewerRole = "buyer" | "creator";


export type MessagesInboxProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type MessagesInboxListing = {
  id: string;
  title: string;
  preview_url: string | null;
};

export type MessagesInboxConversation = {
  id: string;
  conversation_type: ConversationType;
  buyer_user_id: string;
  creator_user_id: string;
  listing_id: string | null;
  listing_request_id: string | null;
  subject: string | null;
  initiation_reason_code: ConversationInitiationReasonCode | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  updated_at: string;
  created_at: string;
};

export type MessagesInboxItem = {
  conversation: MessagesInboxConversation;
  viewerRole: MessagesInboxViewerRole;
  otherParticipantUserId: string;
  otherParticipant: MessagesInboxProfile | null;
  listing: MessagesInboxListing | null;
  // The commission's status, for a commission conversation: the inbox files
  // it under active, completed or ended by this.
  requestStatus: ListingRequestStatus | null;
  participantLastReadAt: string | null;
  unreadCount: number;
  hasUnread: boolean;
};

export type MessagesInboxResult = {
  items: MessagesInboxItem[];
  // Unread messages in the conversations on this page.
  totalUnreadCount: number;
  // Every conversation the person has, loaded or not.
  totalCount: number;
};

// The inbox loads this many conversations, newest first. Anything older is
// loaded only when the person opens "Older conversations".
export const INBOX_PAGE_SIZE = 50;

type UnreadMessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  created_at: string;
};

const emptyResult: MessagesInboxResult = {
  items: [],
  totalUnreadCount: 0,
  totalCount: 0,
};

// Loads one page of the person's communication threads, newest first.
// Request conversations are included because Inbox is now the primary nav entry.
// This runs on every page (the top bar's unread count) and every 15 seconds,
// so it reads one page of conversations and only the messages that can be
// unread, never a whole history.
const fetchMessagesInbox = async (
  userId: string,
  offset = 0
): Promise<MessagesInboxResult> => {
  const { data: conversations, error: conversationsError, count } = await supabase
    .from("conversations")
    .select(`
      id,
      conversation_type,
      buyer_user_id,
      creator_user_id,
      listing_id,
      listing_request_id,
      subject,
      initiation_reason_code,
      status,
      last_message_at,
      last_message_sender_user_id,
      last_message_preview,
      updated_at,
      created_at
    `, { count: "exact" })
    .in("conversation_type", [
      "creator_inquiry",
      "listing_inquiry",
      "listing_request",
    ])
    .or(`buyer_user_id.eq.${userId},creator_user_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .range(offset, offset + INBOX_PAGE_SIZE - 1);

  if (conversationsError) {
    throw conversationsError;
  }

  const conversationRows = (conversations ?? []) as MessagesInboxConversation[];
  const totalCount = count ?? conversationRows.length;

  if (conversationRows.length === 0) {
    return { ...emptyResult, totalCount };
  }

  const conversationIds = conversationRows.map((conversation) => conversation.id);

  const otherUserIds = Array.from(
    new Set(
      conversationRows.map((conversation) =>
        conversation.buyer_user_id === userId
          ? conversation.creator_user_id
          : conversation.buyer_user_id
      )
    )
  );

  const listingIds = Array.from(
    new Set(
      conversationRows
        .map((conversation) => conversation.listing_id)
        .filter((listingId): listingId is string => Boolean(listingId))
    )
  );

  const requestIds = conversationRows
    .map((conversation) => conversation.listing_request_id)
    .filter((requestId): requestId is string => Boolean(requestId));

  const [
    { data: profiles, error: profilesError },
    { data: listings, error: listingsError },
    { data: requests, error: requestsError },
    { data: participants, error: participantsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, handle, display_name, avatar_url")
      .in("user_id", otherUserIds),

    listingIds.length > 0
      ? supabase
        .from("listings")
        .select("id, title, preview_url")
        .in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),

    requestIds.length > 0
      ? supabase.from("listing_requests").select("id, status").in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds),
  ]);

  if (profilesError) {
    throw profilesError;
  }

  if (listingsError) {
    throw listingsError;
  }

  if (requestsError) {
    throw requestsError;
  }

  if (participantsError) {
    throw participantsError;
  }


  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as MessagesInboxProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, MessagesInboxProfile>;

  const listingById = Object.fromEntries(
    ((listings ?? []) as MessagesInboxListing[]).map((listing) => [
      listing.id,
      listing,
    ])
  ) as Record<string, MessagesInboxListing>;

  const requestStatusById = Object.fromEntries(
    ((requests ?? []) as Array<{ id: string; status: ListingRequestStatus }>).map(
      (request) => [request.id, request.status]
    )
  ) as Record<string, ListingRequestStatus>;

  const participantByConversationId = Object.fromEntries(
    ((participants ?? []) as Array<{
      conversation_id: string;
      last_read_at: string | null;
    }>).map((participant) => [
      participant.conversation_id,
      participant,
    ])
  );

  // Only a conversation whose latest message is newer than the person's last
  // read can hold unread messages, so only those are asked about, and only
  // for messages after the oldest of those reads.
  const lastReadAt = (conversationId: string): string | null =>
    participantByConversationId[conversationId]?.last_read_at ?? null;

  const possiblyUnread = conversationRows.filter((conversation) => {
    const readAt = lastReadAt(conversation.id);

    return Boolean(
      conversation.last_message_at && (!readAt || conversation.last_message_at > readAt)
    );
  });

  let unreadMessages: UnreadMessageRow[] = [];

  if (possiblyUnread.length > 0) {
    const reads = possiblyUnread.map((conversation) => lastReadAt(conversation.id));
    const oldestRead = reads.every(Boolean) ? (reads as string[]).sort()[0] : null;

    let unreadQuery = supabase
      .from("conversation_messages")
      .select("id, conversation_id, sender_user_id, created_at")
      .in("conversation_id", possiblyUnread.map((conversation) => conversation.id))
      .neq("sender_user_id", userId);

    if (oldestRead) {
      unreadQuery = unreadQuery.gt("created_at", oldestRead);
    }

    const { data, error: unreadMessagesError } = await unreadQuery;

    if (unreadMessagesError) {
      throw unreadMessagesError;
    }

    unreadMessages = (data ?? []) as UnreadMessageRow[];
  }

  // Groups unread candidate messages by conversation to allow efficient lookup when calculating unread counts
  const unreadMessagesByConversationId = unreadMessages.reduce<Record<string, UnreadMessageRow[]>>((acc, message) => {
    const currentMessages = acc[message.conversation_id] ?? [];

    return {
      ...acc,
      [message.conversation_id]: [...currentMessages, message],
    };
  }, {});

  const getUnreadCount = (
    conversationId: string,
    lastReadAt: string | null
  ): number => {
    const messagesForConversation =
      unreadMessagesByConversationId[conversationId] ?? [];

    return messagesForConversation.filter((message) =>
      !lastReadAt ? true : message.created_at > lastReadAt
    ).length;
  };

  const items = conversationRows.map((conversation) => {
    const viewerRole: MessagesInboxViewerRole =
      conversation.buyer_user_id === userId ? "buyer" : "creator";

    const otherParticipantUserId =
      viewerRole === "buyer"
        ? conversation.creator_user_id
        : conversation.buyer_user_id;

    const participant = participantByConversationId[conversation.id] ?? null;
    const participantLastReadAt = participant?.last_read_at ?? null;
    const unreadCount = getUnreadCount(conversation.id, participantLastReadAt);

    return {
      conversation,
      viewerRole,
      otherParticipantUserId,
      otherParticipant: profileByUserId[otherParticipantUserId] ?? null,
      listing: conversation.listing_id
        ? listingById[conversation.listing_id] ?? null
        : null,
      requestStatus: conversation.listing_request_id
        ? requestStatusById[conversation.listing_request_id] ?? null
        : null,
      participantLastReadAt,
      unreadCount,
      hasUnread: unreadCount > 0,
    };
  });

  return {
    items,
    totalUnreadCount: items.reduce(
      (total, item) => total + item.unreadCount,
      0
    ),
    totalCount,
  };
};

// Conversations older than the first page, fetched a page at a time and only
// once `enabled` (the person opened "Older conversations").
export const useOlderMessagesInbox = (enabled: boolean) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useInfiniteQuery({
    queryKey: ["messagesInboxOlder", userId],
    enabled: enabled && !loading && Boolean(userId),
    initialPageParam: INBOX_PAGE_SIZE,
    queryFn: ({ pageParam }) =>
      userId ? fetchMessagesInbox(userId, pageParam) : Promise.resolve(emptyResult),
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastOffset + INBOX_PAGE_SIZE < lastPage.totalCount ? lastOffset + INBOX_PAGE_SIZE : undefined,
    staleTime: 60_000,
  });
};

export const useMessagesInbox = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<MessagesInboxResult>({
    queryKey: ["messagesInbox", userId],
    enabled: !loading && Boolean(userId),
    queryFn: () =>
      userId ? fetchMessagesInbox(userId) : Promise.resolve(emptyResult),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
};
// The conversations in which some message contains the text typed into the
// inbox search. Asked of the database only once three or more characters are
// typed; the caller waits for typing to pause before changing `text`.
// ponytail: a plain "contains" scan of the person's own messages, fine at
// today's volumes. Move to a full-text index if inboxes grow large.
export const useInboxMessageSearch = (text: string) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const query = text.trim();

  return useQuery<string[]>({
    queryKey: ["inboxMessageSearch", userId, query],
    enabled: !loading && Boolean(userId) && query.length >= 3,
    staleTime: 30_000,
    queryFn: async () => {
      // Row level security limits this to conversations the person is in.
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("conversation_id")
        .ilike("body", `%${query.replace(/[\\%_]/g, "\\$&")}%`)
        .limit(500);

      if (error) throw error;

      return Array.from(
        new Set(((data ?? []) as Array<{ conversation_id: string }>).map((row) => row.conversation_id))
      );
    },
  });
};
