import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { reportPresence } from "../presence/presence";

// Live updates over a websocket (Supabase Realtime, 20261105_190, MSG-007).
//
// The database sends each signed-in person a short signal on their own private
// topic, "user:<id>", whenever a message lands in one of their conversations
// or a commission notification is queued for them. A signal says only what
// changed; this reloads those queries, which read through the usual
// row-level security. Polling (chatPolling.ts) slows to a safety net while
// the connection is up and returns to normal if it drops.

let connected = false;

export const isLiveConnected = (): boolean => connected;

// What a new message in `conversationId` makes out of date. null matches
// every conversation (after a reconnect, when signals may have been missed).
export const refreshesOnMessage = (key: QueryKey, conversationId: string | null): boolean => {
  const [name, id] = key;

  if (name === "conversationMessages" || name === "conversationDetails" || name === "conversationParticipants") {
    return conversationId === null || id === conversationId;
  }

  return name === "messagesInbox" || name === "requestConversation";
};

const REQUEST_QUERIES = new Set([
  "buyerRequest",
  "creatorRequest",
  "myBuyerRequests",
  "myCreatorRequests",
  "requestConversation",
  "activeListingRequestForListing",
]);

// What a commission notification makes out of date: the request pages and
// lists, and everything about a request's agreement, payments and steps.
export const refreshesOnNotification = (key: QueryKey): boolean => {
  const name = String(key[0]);

  return REQUEST_QUERIES.has(name) || name.startsWith("listingRequest");
};

// Listens for `userId`; returns the function that stops.
export const startLiveUpdates = (queryClient: QueryClient, userId: string): (() => void) => {
  let everConnected = false;

  const refresh = (matches: (key: QueryKey) => boolean) =>
    void queryClient.invalidateQueries({ predicate: (query) => matches(query.queryKey) });

  const channel = supabase
    .channel(`user:${userId}`, { config: { private: true } })
    .on("broadcast", { event: "message" }, ({ payload }) =>
      refresh((key) => refreshesOnMessage(key, String(payload?.conversation_id ?? "")))
    )
    .on("broadcast", { event: "notification" }, () => refresh(refreshesOnNotification))
    .subscribe((status, error) => {
      const nowConnected = status === "SUBSCRIBED";

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`MSG-007: live updates unavailable (${status}).`, error?.message ?? "");
      }

      if (nowConnected) reportPresence();

      if (nowConnected === connected) return;

      connected = nowConnected;

      // Back after a drop: catch up on anything missed. Dropped: reload once
      // so the open queries pick their normal polling back up. The first
      // connect needs neither; the page has only just loaded.
      if (everConnected) {
        refresh((key) => refreshesOnMessage(key, null) || refreshesOnNotification(key));
      }

      everConnected ||= nowConnected;
    });

  return () => {
    connected = false;
    void supabase.removeChannel(channel);
  };
};
