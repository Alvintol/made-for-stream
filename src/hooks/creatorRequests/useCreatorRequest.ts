import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ListingRequestProfile,
  ListingRequestRow,
} from "./useMyCreatorRequests";

export type CreatorRequestDetails = {
  request: ListingRequestRow | null;
  buyer: ListingRequestProfile | null;
};

const emptyResult: CreatorRequestDetails = {
  request: null,
  buyer: null,
};

// Loads a single creator-owned request and joins buyer profile display data
const fetchCreatorRequest = async (
  userId: string,
  requestId: string
): Promise<CreatorRequestDetails> => {
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
    .eq("creator_user_id", userId)
    .maybeSingle();

  if (requestError) {
    throw requestError;
  }

  if (!request?.buyer_user_id) {
    return emptyResult;
  }

  const { data: buyer, error: buyerError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .eq("user_id", request.buyer_user_id)
    .maybeSingle();

  if (buyerError) {
    throw buyerError;
  }

  return {
    request: request as ListingRequestRow,
    buyer: (buyer ?? null) as ListingRequestProfile | null,
  };
};

export const useCreatorRequest = (requestId: string | null) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<CreatorRequestDetails>({
    queryKey: ["creatorRequest", userId, requestId],
    enabled: !loading && Boolean(userId && requestId),
    queryFn: () =>
      userId && requestId
        ? fetchCreatorRequest(userId, requestId)
        : Promise.resolve(emptyResult),
    staleTime: 15_000,
  });
};