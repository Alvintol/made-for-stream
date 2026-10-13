import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

// The "in dispute" hold on a commission's images (migration 20261012_160,
// playbook MIL-006). Admins only: the database refuses everyone else, and
// its row-level rule returns nothing to them.

export type CommissionImageRetentionRow = {
  listing_request_id: string;
  closed_at: string | null;
  delete_after: string | null;
  on_hold: boolean;
  hold_reason: string | null;
  hold_placed_at: string | null;
  deleted_at: string | null;
  deleted_file_count: number | null;
};

const queryKey = (listingRequestId: string) => [
  "commissionImageRetention",
  listingRequestId,
];

export const useCommissionImageRetention = (listingRequestId: string) =>
  useQuery({
    queryKey: queryKey(listingRequestId),
    enabled: Boolean(listingRequestId),
    queryFn: async (): Promise<CommissionImageRetentionRow | null> => {
      const { data, error } = await supabase
        .from("commission_image_retention")
        .select(
          "listing_request_id, closed_at, delete_after, on_hold, hold_reason, hold_placed_at, deleted_at, deleted_file_count",
        )
        .eq("listing_request_id", listingRequestId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as CommissionImageRetentionRow | null) ?? null;
    },
  });

export const useSetCommissionDisputeHold = (listingRequestId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { inDispute: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("admin_set_commission_dispute_hold", {
        p_listing_request_id: listingRequestId,
        p_in_dispute: input.inDispute,
        p_reason: input.inDispute ? (input.reason ?? "").trim() : null,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKey(listingRequestId) }),
  });
};
