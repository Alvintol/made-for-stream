import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ConversationMessageType, SystemLine } from "../../domain/conversations/conversations";
import { mergeMessages, messagesSince, useChatPoll } from "./chatPolling";

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

// An open chat reads its newest messages, then only new ones; older ones load
// when the person asks. A long commission chat is never downloaded whole.
export const CHAT_PAGE_SIZE = 100;

const messageColumns = `
  id,
  conversation_id,
  sender_user_id,
  message_type,
  body,
  system_line,
  created_at
`;

const fetchConversationMessages = async (
  conversationId: string,
  getKnown: () => ConversationMessageRow[]
): Promise<ConversationMessageRow[]> => {
  const since = messagesSince(getKnown());
  const query = supabase
    .from("conversation_messages")
    .select(messageColumns)
    .eq("conversation_id", conversationId);

  const { data, error } = since
    ? await query.gte("created_at", since).order("created_at", { ascending: true })
    : await query.order("created_at", { ascending: false }).limit(CHAT_PAGE_SIZE);

  if (error) {
    throw error;
  }

  // Merged with what is known now, not when the read began, so earlier
  // messages loaded meanwhile are kept.
  return mergeMessages(getKnown(), (data ?? []) as ConversationMessageRow[]);
};

export const useConversationMessages = (conversationId: string | null) => {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();

  const userId = user?.id ?? null;
  const pollMs = useChatPoll();

  const messagesQuery = useQuery<ConversationMessageRow[]>({
    queryKey: conversationMessagesQueryKey(conversationId),
    enabled: !loading && Boolean(userId && conversationId),
    queryFn: () =>
      conversationId
        ? fetchConversationMessages(
          conversationId,
          () =>
            queryClient.getQueryData<ConversationMessageRow[]>(
              conversationMessagesQueryKey(conversationId)
            ) ?? []
        )
        : Promise.resolve([]),
    staleTime: 10_000,
    refetchInterval: (query) => pollMs(query.state.data?.at(-1)?.created_at),
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

  const messages = messagesQuery.data ?? [];
  const oldestAt = messages[0]?.created_at ?? null;
  // Messages sent in one transaction share a time, so the oldest time can have
  // more messages than are loaded. Older reads include that time, and the
  // merge drops the ones already known.
  const atOldest = messages.filter((message) => message.created_at === oldestAt).length;

  // Whether anything is older than what is loaded. A chat shorter than one
  // page was read whole, so it never asks.
  const earlierQuery = useQuery<boolean>({
    queryKey: [...conversationMessagesQueryKey(conversationId), "earlier", oldestAt, atOldest],
    enabled: Boolean(conversationId && oldestAt) && messages.length >= CHAT_PAGE_SIZE,
    staleTime: Infinity,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("conversation_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId as string)
        .lte("created_at", oldestAt as string);

      if (error) throw error;

      return (count ?? 0) > atOldest;
    },
  });

  // How many of `messages` were loaded by "Show earlier messages", so the chat
  // doesn't treat them as new ones arriving.
  const [earlier, setEarlier] = useState({ conversationId, count: 0 });
  const earlierCount = earlier.conversationId === conversationId ? earlier.count : 0;

  const loadEarlierMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId || !oldestAt) return [];

      const { data, error } = await supabase
        .from("conversation_messages")
        .select(messageColumns)
        .eq("conversation_id", conversationId)
        .lte("created_at", oldestAt)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE + atOldest);

      if (error) throw error;

      return (data ?? []) as ConversationMessageRow[];
    },
    onSuccess: (older) => {
      const key = conversationMessagesQueryKey(conversationId);
      const known = queryClient.getQueryData<ConversationMessageRow[]>(key) ?? [];
      const merged = mergeMessages(known, older);

      queryClient.setQueryData(key, merged);
      setEarlier({ conversationId, count: earlierCount + merged.length - known.length });
    },
  });

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    currentUserId: userId,
    sendMessageMutation,
    hasEarlier: earlierQuery.data === true,
    earlierCount,
    loadEarlierMutation,
  };
};