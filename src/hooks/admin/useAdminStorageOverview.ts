import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

type DayRow = { day: string; files?: number; downloads?: number; bytes: number };

export type AdminStorageOverview = {
  included_storage_bytes: number;
  included_downloads_bytes: number;
  stored_bytes: number;
  buckets: { bucket: string; files: number; bytes: number }[];
  uploads_by_day: DayRow[];
  downloads_this_month: { downloads: number; bytes: number };
  downloads_by_day: DayRow[];
  largest_commissions: { listing_request_id: string; files: number; bytes: number }[];
  plans: {
    code: string;
    label: string;
    commission_limit_bytes: number;
    is_default: boolean;
    active_creators: number;
  }[];
};

// Storage and download totals for the admin Storage page
// (admin_get_storage_overview, 20261016_164). Read once per visit; there is
// no timer.
export const useAdminStorageOverview = () =>
  useQuery({
    queryKey: ["adminStorageOverview"],
    queryFn: async (): Promise<AdminStorageOverview> => {
      const { data, error } = await supabase.rpc("admin_get_storage_overview");

      if (error) throw error;

      return data as AdminStorageOverview;
    },
  });
