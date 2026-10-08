import { useQuery } from "@tanstack/react-query";

import type {
  BuyerImageUploadStatus,
  ConversationStatus,
} from "../../domain/conversations/conversations";
import {
  getListingRequestStatusesForView,
  type ListingRequestListView,
  type ListingRequestStatus,
} from "../../domain/listings/listingRequests";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestRow = {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  creator_user_id: string;
  status: ListingRequestStatus;
  message: string;
  creator_status_reason: string | null;
  listing_snapshot: ListingRequestSnapshot;
  created_at: string;
  updated_at: string;
  request_title: string | null;
  request_details: string | null;
  requested_timeline: string | null;
  budget_amount: number | null;
  budget_amount_max: number | null;
  reference_links: string[];
  archived_at: string | null;
  archived_by_user_id: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
};

export type ListingRequestProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CreatorListingRequestConversation = {
  id: string;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  buyer_image_upload_status: BuyerImageUploadStatus;
  updated_at: string;
  participant_last_read_at: string | null;
  has_unread: boolean;
};

type CreatorListingRequestConversationRow =
  CreatorListingRequestConversation & {
    listing_requests:
    | ListingRequestRow
    | ListingRequestRow[]
    | null;
  };

type CreatorListingRequestConversationItem = {
  conversation: CreatorListingRequestConversationRow;
  request: ListingRequestRow;
};

export type CreatorListingRequestItem = {
  request: ListingRequestRow;
  buyer: ListingRequestProfile | null;
  conversation: CreatorListingRequestConversation;
};

export type CreatorListingRequestsResult = {
  items: CreatorListingRequestItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  view: ListingRequestListView;
};

type UseMyCreatorRequestsInput = {
  view: ListingRequestListView;
  page: number;
  pageSize?: number;
};

const emptyResult: CreatorListingRequestsResult = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 12,
  pageCount: 0,
  view: "active",
};

const getConversationRequest = (
  conversation: CreatorListingRequestConversationRow
): ListingRequestRow | null =>
  Array.isArray(conversation.listing_requests)
    ? conversation.listing_requests[0] ?? null
    : conversation.listing_requests;

// Loads a paginated creator request inbox from request-linked conversations.
// Conversation.updated_at drives inbox ordering, so new activity moves cards up.
const fetchMyCreatorRequests = async (
  userId: string,
  input: UseMyCreatorRequestsInput
): Promise<CreatorListingRequestsResult> => {
  const {
    view,
    page,
    pageSize = 12,
  } = input;

  let query = supabase
    .from("conversations")
    .select(
      `
        id,
        status,
        last_message_at,
        last_message_sender_user_id,
        last_message_preview,
        buyer_image_upload_status,
        updated_at,
        listing_requests!inner (
          id,
          listing_id,
          buyer_user_id,
          creator_user_id,
          status,
          message,
          creator_status_reason,
          listing_snapshot,
          created_at,
          updated_at,
          request_title,
          request_details,
          requested_timeline,
          budget_amount,
          budget_amount_max,
          reference_links,
          archived_at,
          archived_by_user_id,
          completed_at,
          completed_by_user_id,
          cancelled_at,
          cancelled_by_user_id,
          cancellation_reason
        )
      `,
      {
        count: "exact",
      }
    )
    .eq(
      "conversation_type",
      "listing_request"
    )
    .eq("creator_user_id", userId)
    .order("updated_at", {
      ascending: false,
    });

  query = query.in(
    "listing_requests.status",
    getListingRequestStatusesForView(view)
  );

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: conversations,
    error: conversationsError,
    count,
  } = await query.range(from, to);

  if (conversationsError) {
    throw conversationsError;
  }

  const conversationRows =
    (conversations ?? []) as unknown as CreatorListingRequestConversationRow[];

  const conversationItems = conversationRows
    .map((conversation) => ({
      conversation,
      request:
        getConversationRequest(conversation),
    }))
    .filter(
      (
        item
      ): item is CreatorListingRequestConversationItem =>
        Boolean(item.request)
    );

  const totalCount = count ?? 0;

  const pageCount =
    totalCount > 0
      ? Math.ceil(totalCount / pageSize)
      : 0;

  if (conversationItems.length === 0) {
    return {
      items: [],
      totalCount,
      page,
      pageSize,
      pageCount,
      view,
    };
  }

  const conversationIds =
    conversationItems.map(
      (item) => item.conversation.id
    );

  const {
    data: participants,
    error: participantsError,
  } = await supabase
    .from("conversation_participants")
    .select(
      "conversation_id, last_read_at"
    )
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  if (participantsError) {
    throw participantsError;
  }

  const participantByConversationId =
    Object.fromEntries(
      (
        (participants ?? []) as Array<{
          conversation_id: string;
          last_read_at: string | null;
        }>
      ).map((participant) => [
        participant.conversation_id,
        participant,
      ])
    );

  const buyerIds = Array.from(
    new Set(
      conversationItems.map(
        (item) =>
          item.request.buyer_user_id
      )
    )
  );

  const {
    data: profiles,
    error: profilesError,
  } = await supabase
    .from("profiles")
    .select(
      "user_id, handle, display_name, avatar_url"
    )
    .in("user_id", buyerIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileByUserId =
    Object.fromEntries(
      (
        (profiles ??
          []) as ListingRequestProfile[]
      ).map((profile) => [
        profile.user_id,
        profile,
      ])
    ) as Record<
      string,
      ListingRequestProfile
    >;

  return {
    items: conversationItems.map((item) => {
      const participant =
        participantByConversationId[
        item.conversation.id
        ] ?? null;

      const lastReadAt =
        participant?.last_read_at ?? null;

      const latestMessageAt =
        item.conversation.last_message_at;

      const latestSenderUserId =
        item.conversation
          .last_message_sender_user_id;

      const hasUnread =
        Boolean(latestMessageAt) &&
        latestSenderUserId !== userId &&
        (
          !lastReadAt ||
          latestMessageAt! > lastReadAt
        );

      return {
        request: item.request,

        buyer:
          profileByUserId[
          item.request.buyer_user_id
          ] ?? null,

        conversation: {
          id: item.conversation.id,
          status: item.conversation.status,
          last_message_at:
            item.conversation
              .last_message_at,
          last_message_sender_user_id:
            item.conversation
              .last_message_sender_user_id,
          last_message_preview:
            item.conversation
              .last_message_preview,
          buyer_image_upload_status:
            item.conversation
              .buyer_image_upload_status,
          updated_at:
            item.conversation.updated_at,
          participant_last_read_at:
            lastReadAt,
          has_unread: hasUnread,
        },
      };
    }),

    totalCount,
    page,
    pageSize,
    pageCount,
    view,
  };
};

export const useMyCreatorRequests = (
  input: UseMyCreatorRequestsInput
) => {
  const {
    user,
    loading,
  } = useAuth();

  const userId = user?.id ?? null;

  return useQuery({
    queryKey: [
      "myCreatorRequests",
      userId,
      input,
    ],

    enabled:
      !loading && Boolean(userId),

    queryFn: () =>
      userId
        ? fetchMyCreatorRequests(
          userId,
          input
        )
        : Promise.resolve({
          ...emptyResult,
          view: input.view,
          page: input.page,
          pageSize:
            input.pageSize ??
            emptyResult.pageSize,
        }),

    staleTime: 15_000,
  });
};