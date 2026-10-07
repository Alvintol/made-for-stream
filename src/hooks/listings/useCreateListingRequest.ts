import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import { getCreateListingRequestErrorMessage } from '../../domain/listings/listingRequestErrors';

export type CreateListingRequestInput = {
  listingId: string;
  creatorUserId: string;
  requestTitle: string;
  requestDetails: string;
  requestedTimeline?: string;
  budgetAmount?: number | null;
  referenceLinks?: string[];
  listingSnapshot: ListingRequestSnapshot;
};

const cleanOptionalText = (value?: string): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed ? trimmed : null;
};

const cleanReferenceLinks = (links?: string[]): string[] =>
  (links ?? [])
    .map((link) => link.trim())
    .filter(Boolean)
    .slice(0, 5);

export const useCreateListingRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateListingRequestInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to send a commission request.");
      }

      const requestTitle = input.requestTitle.trim();
      const requestDetails = input.requestDetails.trim();

      const { data, error } = await supabase
        .from("listing_requests")
        .insert({
          listing_id: input.listingId,
          buyer_user_id: user.id,
          creator_user_id: input.creatorUserId,
          status: "submitted",

          // Keep the original message populated for existing inbox/detail UI.
          message: requestDetails,

          // Structured request fields for the new buyer submission flow.
          request_title: requestTitle,
          request_details: requestDetails,
          requested_timeline: cleanOptionalText(input.requestedTimeline),
          budget_amount: input.budgetAmount ?? null,
          reference_links: cleanReferenceLinks(input.referenceLinks),

          // Frozen listing state for disputes/admin review.
          listing_snapshot: input.listingSnapshot,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(getCreateListingRequestErrorMessage(error));
      }

      if (!data?.id) {
        throw new Error("The commission request could not be sent.");
      }

      return data.id as string;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["activeListingRequestForListing", user?.id ?? null],
        }),
      ]);
    },
  });
};