import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

// "…" in a chat while the other person types (20261106_191, MSG-009).
//
// Each open chat joins the conversation's private topic, "conversation:<id>".
// While someone types, their tab sends a "typing" signal at most every two
// seconds, and "stopped" when the box is emptied or the message is sent. The
// signals go browser to browser through Supabase Realtime; nothing is stored.
// If "stopped" is lost (tab closed, network), the dots hide by themselves.

export const TYPING_SEND_EVERY_MS = 2_000;
export const TYPING_SHOW_FOR_MS = 5_000;

type TypingPayload = { user_id?: string; typing?: boolean };

export const useTypingIndicator = (
  conversationId: string | null,
  userId: string | null,
  enabled: boolean
) => {
  // Which conversation the dots belong to, so they never carry over to another chat.
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !conversationId || !userId) return undefined;

    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`conversation:${conversationId}`, { config: { private: true } })
      .on("broadcast", { event: "typing" }, ({ payload }: { payload?: TypingPayload }) => {
        // The same person in another tab.
        if (!payload?.user_id || payload.user_id === userId) return;

        clearTimeout(hideTimer);

        if (payload.typing === false) {
          setTypingIn(null);
          return;
        }

        setTypingIn(conversationId);
        hideTimer = setTimeout(() => setTypingIn(null), TYPING_SHOW_FOR_MS);
      })
      .subscribe((status) => {
        joinedRef.current = status === "SUBSCRIBED";
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(hideTimer);
      channelRef.current = null;
      joinedRef.current = false;
      lastSentAtRef.current = 0;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, userId, enabled]);

  // Only over the open websocket: before it has joined, a send would go as a
  // separate web request instead. Returns whether it was sent.
  const send = useCallback(
    (typing: boolean) => {
      if (!joinedRef.current || !channelRef.current) return false;

      void channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: userId, typing },
      });

      return true;
    },
    [userId]
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();

    if (now - lastSentAtRef.current < TYPING_SEND_EVERY_MS) return;

    if (send(true)) lastSentAtRef.current = now;
  }, [send]);

  const notifyStopped = useCallback(() => {
    if (lastSentAtRef.current === 0) return;

    lastSentAtRef.current = 0;
    send(false);
  }, [send]);

  return {
    otherTyping: enabled && typingIn !== null && typingIn === conversationId,
    notifyTyping,
    notifyStopped,
  };
};
