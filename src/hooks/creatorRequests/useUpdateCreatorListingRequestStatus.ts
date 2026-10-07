import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";

type UpdateCreatorListingRequestStatusInput = {
  requestId: string;
  status: ListingRequestStatus;
  reason?: string | null;
};

const normaliseReason = (value?: string | null) => value?.trim() ?? "";

export const useUpdateCreatorListingRequestStatus = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateCreatorListingRequestStatusInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update commission status.");
      }

      const trimmedReason = normaliseReason(input.reason);

      if (input.status === "declined") {
        if (trimmedReason.length < 10 || trimmedReason.length > 1000) {
          throw new Error("Decline reason must be between 10 and 1000 characters.");
        }
      }

      const { data, error } = await supabase
        .from("listing_requests")
        .update({
          status: input.status,
          creator_status_reason: trimmedReason || null,
        })
        .eq("id", input.requestId)
        .eq("creator_user_id", user.id)
        .eq("status", "submitted")
        .select("id, status")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error(
          "This commission request is no longer under review and cannot be updated."
        );
      }


      return {
        id: data.id as string,
        status: data.status as ListingRequestStatus,
      };
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["creatorRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyerRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationMessages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["activeListingRequestForListing"],
        }),
      ]);
    },
  });
};