import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";
import type {
  BuyerImageUploadStatus,
  ConversationStatus,
} from "../../domain/conversations/conversations";

export type AdminRequestProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type AdminRequestRow = {
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

export type AdminRequestConversation = {
  id: string;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  buyer_image_upload_status: BuyerImageUploadStatus;
  updated_at: string;
};

type AdminRequestConversationRow = AdminRequestConversation & {
  listing_requests: AdminRequestRow | AdminRequestRow[] | null;
};

type AdminRequestConversationItem = {
  conversation: AdminRequestConversationRow;
  request: AdminRequestRow;
};


export type AdminRequestItem = {
  request: AdminRequestRow;
  buyer: AdminRequestProfile | null;
  creator: AdminRequestProfile | null;
  conversation: AdminRequestConversation;
};

export type AdminRequestsFilters = {
  creatorHandle: string;
  buyerHandle: string;
  createdFrom: string;
  createdTo: string;
  status: "all" | ListingRequestStatus;
};

export type AdminRequestsResult = {
  items: AdminRequestItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type UseAdminRequestsInput = {
  filters: AdminRequestsFilters;
  page: number;
  pageSize?: number;
};

const emptyResult: AdminRequestsResult = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  pageCount: 0,
};

const getConversationRequest = (
  conversation: AdminRequestConversationRow
): AdminRequestRow | null =>
  Array.isArray(conversation.listing_requests)
    ? conversation.listing_requests[0] ?? null
    : conversation.listing_requests;

// Normalises a handle search so admins can search with or without @
const normaliseHandle = (value: string) => value.trim().replace(/^@+/, "");

// Converts a YYYY-MM-DD input into the local start-of-day ISO timestamp
const toStartOfDayIso = (value: string) => {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// Converts a YYYY-MM-DD input into the local end-of-day ISO timestamp
const toEndOfDayIso = (value: string) => {
  if (!value) return null;

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const fetchMatchingProfileIds = async (
  fieldValue: string
): Promise<string[] | null> => {
  const handle = normaliseHandle(fieldValue);
  if (!handle) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("handle", `%${handle}%`);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((profile) => profile.user_id as string)
    .filter(Boolean);
};

// Loads admin request review rows from request-linked conversations.
// This makes the admin request page sort by latest conversation activity.
const fetchAdminRequests = async (
  input: UseAdminRequestsInput
): Promise<AdminRequestsResult> => {
  const { filters, page, pageSize = 20 } = input;

  const [creatorUserIds, buyerUserIds] = await Promise.all([
    fetchMatchingProfileIds(filters.creatorHandle),
    fetchMatchingProfileIds(filters.buyerHandle),
  ]);

  if (creatorUserIds && creatorUserIds.length === 0) {
    return {
      ...emptyResult,
      page,
      pageSize,
    };
  }

  if (buyerUserIds && buyerUserIds.length === 0) {
    return {
      ...emptyResult,
      page,
      pageSize,
    };
  }

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
      { count: "exact" }
    )
    .eq("conversation_type", "listing_request")
    .order("updated_at", { ascending: false });

  const createdFrom = toStartOfDayIso(filters.createdFrom);
  const createdTo = toEndOfDayIso(filters.createdTo);

  if (creatorUserIds) {
    query = query.in("listing_requests.creator_user_id", creatorUserIds);
  }

  if (buyerUserIds) {
    query = query.in("listing_requests.buyer_user_id", buyerUserIds);
  }

  if (createdFrom) {
    query = query.gte("listing_requests.created_at", createdFrom);
  }

  if (createdTo) {
    query = query.lte("listing_requests.created_at", createdTo);
  }

  if (filters.status !== "all") {
    query = query.eq("listing_requests.status", filters.status);
  }

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
    (conversations ?? []) as unknown as AdminRequestConversationRow[];

  const conversationItems = conversationRows
    .map((conversation) => ({
      conversation,
      request: getConversationRequest(conversation),
    }))
    .filter(
      (item): item is AdminRequestConversationItem => Boolean(item.request)
    );

  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (conversationItems.length === 0) {
    return {
      items: [],
      totalCount,
      page,
      pageSize,
      pageCount,
    };
  }

  const userIds = Array.from(
    new Set(
      conversationItems.flatMap((item) => [
        item.request.buyer_user_id,
        item.request.creator_user_id,
      ])
    )
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as AdminRequestProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminRequestProfile>;

  return {
    items: conversationItems.map((item) => ({
      request: item.request,
      buyer: profileByUserId[item.request.buyer_user_id] ?? null,
      creator: profileByUserId[item.request.creator_user_id] ?? null,
      conversation: {
        id: item.conversation.id,
        status: item.conversation.status,
        last_message_at: item.conversation.last_message_at,
        last_message_sender_user_id: item.conversation.last_message_sender_user_id,
        last_message_preview: item.conversation.last_message_preview,
        buyer_image_upload_status: item.conversation.buyer_image_upload_status,
        updated_at: item.conversation.updated_at,
      },
    })),
    totalCount,
    page,
    pageSize,
    pageCount,
  };
};

export const useAdminRequests = (input: UseAdminRequestsInput) =>
  useQuery<AdminRequestsResult>({
    queryKey: ["adminRequests", input],
    queryFn: () => fetchAdminRequests(input),
    staleTime: 15_000,
  });