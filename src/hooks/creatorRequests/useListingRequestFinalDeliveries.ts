import { useQuery } from "@tanstack/react-query";

import type { ListingRequestFinalDeliveryStatus } from "../../domain/listings/listingRequestFinalDeliveries";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestFinalDeliverySnapshot = Record<
  string,
  unknown
>;

export type ListingRequestFinalDeliveryRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  creator_user_id: string;
  buyer_user_id: string;
  version_number: number;
  status: ListingRequestFinalDeliveryStatus;
  title: string;
  summary: string;
  delivery_links: string[];
  // The creator's statement that the work was also sent outside the site
  // (20261013_162).
  off_site_delivery_methods?: string[];
  off_site_delivery_other?: string | null;
  // Uploaded files and when they were deleted (20261016_163).
  delivery_file_paths?: string[];
  delivery_files_deleted_at?: string | null;
  agreement_snapshot: ListingRequestFinalDeliverySnapshot;
  revision_request_reason: string | null;
  submitted_at: string | null;
  revision_requested_at: string | null;
  buyer_approved_at: string | null;
  cancelled_at: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
};

export const useListingRequestFinalDeliveries = (
  listingRequestId?: string | null
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      "listingRequestFinalDeliveries",
      listingRequestId,
    ],

    enabled: Boolean(user?.id && listingRequestId),

    queryFn: async (): Promise<
      ListingRequestFinalDeliveryRow[]
    > => {
      if (!user?.id || !listingRequestId) {
        return [];
      }

      const { data, error } = await supabase
        .from("listing_request_final_deliveries")
        .select(
          `
            id,
            listing_request_id,
            agreement_id,
            creator_user_id,
            buyer_user_id,
            version_number,
            status,
            title,
            summary,
            delivery_links,
            off_site_delivery_methods,
            off_site_delivery_other,
            delivery_file_paths,
            delivery_files_deleted_at,
            agreement_snapshot,
            revision_request_reason,
            submitted_at,
            revision_requested_at,
            buyer_approved_at,
            cancelled_at,
            superseded_at,
            created_at,
            updated_at
          `
        )
        .eq("listing_request_id", listingRequestId)
        .order("version_number", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (
        data as ListingRequestFinalDeliveryRow[] | null
      ) ?? [];
    },
  });
};