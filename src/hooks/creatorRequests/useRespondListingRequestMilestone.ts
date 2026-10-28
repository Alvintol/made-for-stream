import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type RespondListingRequestMilestoneInput =
  | {
      milestoneId: string;
      response: "buyer_approved";
    }
  | {
      milestoneId: string;
      response: "revision_requested";
      revisionRequestReason: string;
    };

export type RespondedListingRequestMilestoneRow = {
  submission_id: string;
  milestone_id: string;
  listing_request_id: string;
  agreement_id: string;
  response_status:
    | "buyer_approved"
    | "revision_requested";
  milestone_status:
    | "revision_requested"
    | "payment_required";
  payment_status:
    | "pending"
    | "payment_required";
  responded_at: string;
};

const getRevisionRequestReason = (
  input: RespondListingRequestMilestoneInput
): string | null =>
  input.response === "revision_requested"
    ? input.revisionRequestReason.trim()
    : null;

const getErrorMessage = (
  error: unknown
): string => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message
    );
  }

  return "The milestone response could not be saved.";
};

export const useRespondListingRequestMilestone =
  () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (
        input: RespondListingRequestMilestoneInput
      ): Promise<RespondedListingRequestMilestoneRow> => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to respond to a milestone."
          );
        }

        const { data, error } = await supabase.rpc(
          "respond_listing_request_milestone",
          {
            p_milestone_id: input.milestoneId,
            p_response: input.response,
            p_revision_request_reason:
              getRevisionRequestReason(input),
          }
        );

        if (error) {
          throw new Error(getErrorMessage(error));
        }

        const responseRow = Array.isArray(data)
          ? (data[0] as
              | RespondedListingRequestMilestoneRow
              | undefined)
          : undefined;

        if (
          !responseRow?.submission_id ||
          !responseRow.milestone_id ||
          !responseRow.listing_request_id ||
          !responseRow.agreement_id
        ) {
          throw new Error(
            "The milestone response could not be saved."
          );
        }

        return responseRow;
      },

      onSuccess: async (responseRow) => {
        await Promise.all([
          // Accepting or approving makes the database create the payment
          // that is now due, so the pay button needs the fresh list.
          queryClient.invalidateQueries({
            queryKey: ["listingRequestPayments"],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestMilestones",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestMilestoneSubmissions",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestProgressUpdates",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              responseRow.listing_request_id,
            ],
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

          // Approving closes the milestone's off-site receipt
          // (20261028_169), so "Did the work arrive?" goes away.
          queryClient.invalidateQueries({
            queryKey: [
              "offSiteReceipts",
              responseRow.listing_request_id,
            ],
          }),
        ]);
      },
    });
  };