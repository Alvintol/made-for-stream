import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestMilestoneSubmissionStatus =
  | "submitted"
  | "revision_requested"
  | "buyer_approved"
  | "superseded";

export type ListingRequestMilestoneSubmissionRow = {
  id: string;
  milestone_id: string;
  listing_request_id: string;
  agreement_id: string;
  creator_user_id: string;
  buyer_user_id: string;
  version_number: number;
  status: ListingRequestMilestoneSubmissionStatus;
  summary: string;
  delivery_links: string[];
  preview_image_paths: string[];
  revision_request_reason: string | null;
  submitted_at: string;
  revision_requested_at: string | null;
  buyer_approved_at: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
};

export const useListingRequestMilestoneSubmissions = (
  listingRequestId?: string | null
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      "listingRequestMilestoneSubmissions",
      listingRequestId,
    ],

    enabled: Boolean(user?.id && listingRequestId),

    queryFn: async (): Promise<
      ListingRequestMilestoneSubmissionRow[]
    > => {
      if (!user?.id || !listingRequestId) {
        return [];
      }

      const { data, error } = await supabase
        .from(
          "listing_request_milestone_submissions"
        )
        .select(
          `
            id,
            milestone_id,
            listing_request_id,
            agreement_id,
            creator_user_id,
            buyer_user_id,
            version_number,
            status,
            summary,
            delivery_links,
            preview_image_paths,
            revision_request_reason,
            submitted_at,
            revision_requested_at,
            buyer_approved_at,
            superseded_at,
            created_at,
            updated_at
          `
        )
        .eq("listing_request_id", listingRequestId)
        .order("submitted_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (
        data as
          | ListingRequestMilestoneSubmissionRow[]
          | null
      ) ?? [];
    },
  });
};