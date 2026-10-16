import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

export type CommissionStorageUsage = {
  usedBytes: number;
  limitBytes: number;
  planLabel: string;
};

export const commissionStorageUsageQueryKey = (listingRequestId: string | null | undefined) => [
  "commissionStorageUsage",
  listingRequestId,
];

// How much of a commission's delivery-file allowance is used
// (get_commission_storage_usage, 20261016_164).
export const useCommissionStorageUsage = (listingRequestId?: string | null) =>
  useQuery({
    queryKey: commissionStorageUsageQueryKey(listingRequestId),
    enabled: Boolean(listingRequestId),
    queryFn: async (): Promise<CommissionStorageUsage | null> => {
      const { data, error } = await supabase.rpc("get_commission_storage_usage", {
        p_listing_request_id: listingRequestId,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;

      return row
        ? {
            usedBytes: Number(row.used_bytes) || 0,
            limitBytes: Number(row.limit_bytes) || 0,
            planLabel: String(row.plan_label ?? ""),
          }
        : null;
    },
  });
