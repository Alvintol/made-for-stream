import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ListingRequestFinalDeliveryStatus,
} from "../../domain/listings/listingRequestFinalDeliveries";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type ListingRequestFinalDeliveryResponse = Extract<
  ListingRequestFinalDeliveryStatus,
  "revision_requested" | "buyer_approved"
>;

export type RespondListingRequestFinalDeliveryInput = {
  finalDeliveryId: string;
  response: ListingRequestFinalDeliveryResponse;
  revisionRequestReason?: string | null;
};

export type RespondedListingRequestFinalDeliveryRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: ListingRequestFinalDeliveryResponse;
  revision_request_reason: string | null;
  revision_requested_at: string | null;
  buyer_approved_at: string | null;
};

export const useRespondListingRequestFinalDelivery =
  () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (
        input: RespondListingRequestFinalDeliveryInput
      ): Promise<RespondedListingRequestFinalDeliveryRow> => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to respond to this final delivery."
          );
        }

        const { data, error } = await supabase.rpc(
          "respond_listing_request_final_delivery",
          {
            p_final_delivery_id:
              input.finalDeliveryId,

            p_response: input.response,

            p_revision_request_reason:
              input.response ===
                "revision_requested"
                ? input.revisionRequestReason?.trim() ||
                null
                : null,
          }
        );

        if (error) {
          throw error;
        }

        const finalDelivery = Array.isArray(data)
          ? (data[0] as
            | RespondedListingRequestFinalDeliveryRow
            | undefined)
          : undefined;

        if (!finalDelivery?.id) {
          throw new Error(
            "The final delivery response could not be saved."
          );
        }

        return finalDelivery;
      },

      onSuccess: async (finalDelivery) => {
        await Promise.all([
          // Accepting or approving makes the database create the payment
          // that is now due, so the pay button needs the fresh list.
          queryClient.invalidateQueries({
            queryKey: ["listingRequestPayments"],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestFinalDeliveries",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestProgressUpdates",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: ["myBuyerRequests"],
          }),

          queryClient.invalidateQueries({
            queryKey: ["myCreatorRequests"],
          }),

          queryClient.invalidateQueries({
            queryKey: ["adminRequests"],
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
        ]);
      },
    });
  };