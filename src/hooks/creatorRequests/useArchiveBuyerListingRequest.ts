import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type ArchiveBuyerListingRequestInput = {
  requestId: string;
};

export const useArchiveBuyerListingRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId }: ArchiveBuyerListingRequestInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to archive this commission.");
      }

      const { data, error } = await supabase.rpc(
        "archive_my_listing_request",
        {
          p_request_id: requestId,
        }
      );

      if (error) {
        throw new Error(
          error.message || "This commission could not be archived."
        );
      }

      const archivedRequest = Array.isArray(data) ? data[0] : null;

      if (!archivedRequest?.id) {
        throw new Error("This commission could not be archived.");
      }

      return archivedRequest.id as string;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyerRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["creatorRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationMessages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["activeListingRequestForListing"],
        }),
      ]);
    },
  });
};