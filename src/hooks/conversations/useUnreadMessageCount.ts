import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../lib/supabaseClient";
import { isLiveConnected } from "../../lib/realtime/liveUpdates";

// The number on the top bar, which is on every page. Refreshed live, with one
// small read every few minutes as a safety net, paused while the tab is hidden. The key sits under "messagesInbox" so anything
// that refreshes the inbox refreshes this too.
export const useUnreadMessageCount = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<number>({
    queryKey: ["messagesInbox", "unread", userId],
    enabled: !loading && Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_unread_message_count");

      if (error) throw error;

      return (data as number | null) ?? 0;
    },
    // A live update refreshes it the moment a message arrives; this is the
    // safety net (lib/realtime/liveUpdates.ts).
    refetchInterval: () => (isLiveConnected() ? 5 * 60_000 : 60_000),
    refetchIntervalInBackground: false,
  });
};
