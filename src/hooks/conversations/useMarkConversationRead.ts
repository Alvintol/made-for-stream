import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

type MarkConversationReadInput = {
  conversationId: string;
};

export const useMarkConversationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkConversationReadInput) => {
      const { data, error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: input.conversationId,
      });

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationParticipants"],
        }),
        // The inbox and the unread number on the top bar (its key sits under it).
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
      ]);
    },
  });
};