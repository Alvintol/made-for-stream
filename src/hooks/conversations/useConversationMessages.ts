import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ConversationMessageType, SystemLine } from "../../domain/conversations/conversations";

export type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  message_type: ConversationMessageType;
  body: string | null;
  system_line?: SystemLine | null;
  created_at: string;
};

const conversationMessagesQueryKey = (conversationId: string | null) =>
  ["conversationMessages", conversationId] as const;

const normaliseBody = (value: string) => value.trim();

const fetchConversationMessages = async (
  conversationId: string
): Promise<ConversationMessageRow[]> => {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select(`
      id,
      conversation_id,
      sender_user_id,
      message_type,
      body,
      system_line,
      created_at
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ConversationMessageRow[];
};

export const useConversationMessages = (conversationId: string | null) => {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();

  const userId = user?.id ?? null;

  const messagesQuery = useQuery<ConversationMessageRow[]>({
    queryKey: conversationMessagesQueryKey(conversationId),
    enabled: !loading && Boolean(userId && conversationId),
    queryFn: () =>
      conversationId
        ? fetchConversationMessages(conversationId)
        : Promise.resolve([]),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!user?.id) {
        throw new Error("You must be signed in to send a message.");
      }

      if (!conversationId) {
        throw new Error("A conversation is required to send a message.");
      }

      const trimmedBody = normaliseBody(body);

      if (trimmedBody.length < 1 || trimmedBody.length > 2000) {
        throw new Error("Message must be between 1 and 2000 characters.");
      }

      const { data, error } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: conversationId,
          sender_user_id: user.id,
          message_type: "text",
          body: trimmedBody,
        })
        .select(`
          id,
          conversation_id,
          sender_user_id,
          message_type,
          body,
          created_at
        `)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("The message could not be sent.");
      }

      return data as ConversationMessageRow;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: conversationMessagesQueryKey(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
        }),
      ]);
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    currentUserId: userId,
    sendMessageMutation,
  };
};