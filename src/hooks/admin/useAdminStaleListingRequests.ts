import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

export type AdminStaleListingRequest = {
  listing_request_id: string;
  buyer_user_id: string;
  creator_user_id: string;
  status: string;
  last_activity_at: string;
  days_since_activity: number;
  has_open_notice: boolean;
};

// Sprint 6 checklist: "Staleness query surfaced in admin: requests not
// advanced in 14+ days with a pending action on one side." REQ-003's db
// signal.
export const useAdminStaleListingRequests = (staleAfterDays = 14) =>
  useQuery<AdminStaleListingRequest[]>({
    queryKey: ["adminStaleListingRequests", staleAfterDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_list_stale_listing_requests_checked",
        { p_stale_after_days: staleAfterDays }
      );

      if (error) {
        throw new Error(error.message || "Stale commissions could not be loaded.");
      }

      return (data ?? []) as AdminStaleListingRequest[];
    },
    staleTime: 60_000,
  });
