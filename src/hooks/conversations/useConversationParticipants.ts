import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useChatPoll } from "./chatPolling";
export type ConversationParticipantRow = {
  conversation_id: string;
  user_id: string;
  role: "buyer" | "creator";
  last_read_at: string | null;
  archived_at: string | null;
  muted_at: string | null;
  created_at: string;
};

// Loads participant read state for a conversation.
// This powers read receipts without storing read state on individual messages.
const fetchConversationParticipants = async (
  conversationId: string
): Promise<ConversationParticipantRow[]> => {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(`
      conversation_id,
      user_id,
      role,
      last_read_at,
      archived_at,
      muted_at,
      created_at
    `)
    .eq("conversation_id", conversationId);

  if (error) {
    throw error;
  }

  return (data ?? []) as ConversationParticipantRow[];
};

export const useConversationParticipants = (
  conversationId: string | null
) => {
  const pollMs = useChatPoll(60_000);

  return useQuery<ConversationParticipantRow[]>({
    queryKey: ["conversationParticipants", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () =>
      conversationId
        ? fetchConversationParticipants(conversationId)
        : Promise.resolve([]),
    staleTime: 10_000,
    refetchInterval: () => pollMs(),
  });
};