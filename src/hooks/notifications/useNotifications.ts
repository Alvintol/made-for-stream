import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../lib/supabaseClient";
import { isLiveConnected } from "../../lib/realtime/liveUpdates";

export type BellNotification = {
  id: string;
  title: string;
  link_path: string | null;
  created_at: string;
  read_at: string | null;
};

// How many the bell lists. The unread number counts within these.
export const BELL_LIMIT = 20;

// The bell's rows (20261109_192): the person's own commission updates that
// the API has written a line for, newest first. Row-level security returns
// only their own. A live update refreshes them (lib/realtime/liveUpdates.ts).
export const useNotifications = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<BellNotification[]>({
    queryKey: ["notifications", userId],
    enabled: !loading && Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_request_notifications")
        .select("id, title, link_path, created_at, read_at")
        .not("title", "is", null)
        .order("created_at", { ascending: false })
        .limit(BELL_LIMIT);

      if (error) throw error;

      return (data ?? []) as BellNotification[];
    },
    refetchInterval: () => (isLiveConnected() ? 5 * 60_000 : 60_000),
    refetchIntervalInBackground: false,
  });
};

// Opening the bell marks everything in it read.
export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listing_request_notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .not("title", "is", null);

      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};
