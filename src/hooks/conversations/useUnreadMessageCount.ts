import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";
import { supabase } from "../../lib/supabaseClient";

// The number on the top bar, which is on every page. One small read a minute,
// paused while the tab is hidden. The key sits under "messagesInbox" so anything
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
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
};
