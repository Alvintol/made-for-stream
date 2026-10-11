import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { uploadMilestonePreviewImage } from "../../lib/listings/milestonePreviewImage";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type SubmitListingRequestMilestoneInput = {
  milestoneId: string;
  summary: string;
  deliveryLinks: string[];
  // Prepared, watermarked copies (the form makes them). Uploaded here,
  // just before the submission is saved.
  previewImages?: Blob[];
};

export type SubmittedListingRequestMilestoneRow = {
  submission_id: string;
  milestone_id: string;
  listing_request_id: string;
  agreement_id: string;
  status: "submitted";
  version_number: number;
  submitted_at: string;
};

const normalizeDeliveryLinks = (
  deliveryLinks: string[]
): string[] =>
  deliveryLinks
    .map((deliveryLink) => deliveryLink.trim())
    .filter(Boolean);

export const useSubmitListingRequestMilestone =
  () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (
        input: SubmitListingRequestMilestoneInput
      ): Promise<SubmittedListingRequestMilestoneRow> => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to submit a milestone."
          );
        }

        const previewImagePaths: string[] = [];

        for (const blob of input.previewImages ?? []) {
          previewImagePaths.push(
            await uploadMilestonePreviewImage({
              milestoneId: input.milestoneId,
              blob,
            })
          );
        }

        const { data, error } = await supabase.rpc(
          "submit_listing_request_milestone",
          {
            p_milestone_id: input.milestoneId,
            p_summary: input.summary.trim(),
            p_delivery_links:
              normalizeDeliveryLinks(
                input.deliveryLinks
              ),
            // Only named when there are images, so a submission without
            // any does not depend on migration 20261011_154.
            ...(previewImagePaths.length > 0
              ? { p_preview_image_paths: previewImagePaths }
              : {}),
          }
        );

        if (error) {
          throw error;
        }

        const submission = Array.isArray(data)
          ? (data[0] as
              | SubmittedListingRequestMilestoneRow
              | undefined)
          : undefined;

        if (
          !submission?.submission_id ||
          !submission.milestone_id ||
          !submission.listing_request_id
        ) {
          throw new Error(
            "The milestone submission could not be saved."
          );
        }

        return submission;
      },

      onSuccess: async (submission) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestMilestones",
              submission.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestMilestoneSubmissions",
              submission.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              submission.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              submission.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              submission.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              submission.listing_request_id,
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
        ]);
      },
    });
  };