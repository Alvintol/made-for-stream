import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";
import type { AdminRequestProfile } from "./useAdminRequests";

export type AdminRequestDetailsRow = {
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

export type AdminRequestDetails = {
  request: AdminRequestDetailsRow | null;
  buyer: AdminRequestProfile | null;
  creator: AdminRequestProfile | null;
};

const emptyResult: AdminRequestDetails = {
  request: null,
  buyer: null,
  creator: null,
};

const fetchAdminRequest = async (
  requestId: string
): Promise<AdminRequestDetails> => {
  const { data: request, error: requestError } = await supabase
    .from("listing_requests")
    .select(`
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
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    throw requestError;
  }

  if (!request?.buyer_user_id || !request?.creator_user_id) {
    return emptyResult;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", [request.buyer_user_id, request.creator_user_id]);

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
    request: request as AdminRequestDetailsRow,
    buyer: profileByUserId[request.buyer_user_id] ?? null,
    creator: profileByUserId[request.creator_user_id] ?? null,
  };
};

export const useAdminRequest = (requestId: string | null) =>
  useQuery<AdminRequestDetails>({
    queryKey: ["adminRequest", requestId],
    enabled: Boolean(requestId),
    queryFn: () =>
      requestId ? fetchAdminRequest(requestId) : Promise.resolve(emptyResult),
    staleTime: 15_000,
  });