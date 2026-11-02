import { useCallback, useEffect, useState } from "react";

const MINUTE = 60_000;

// Sending a message and system lines happen in a transaction, so one can appear
// a moment after a later one. Looking this far back catches those.
const MESSAGE_OVERLAP_MS = MINUTE;

// How often an open chat checks for news. Quick while it is active, slower once
// it goes quiet, and it stops after an hour (OPS-005: database timers must end).
export const chatPollMs = (idleMs: number, activeMs = 15_000): number | false => {
  if (idleMs < 10 * MINUTE) return activeMs;
  if (idleMs < 60 * MINUTE) return Math.max(activeMs, MINUTE);

  return false;
};

// The interval for a query, from how long the chat has been quiet. A new message
// or coming back to the tab counts as activity. Hidden tabs are paused anyway.
export const useChatPoll = (activeMs?: number) => {
  const [activeAt, setActiveAt] = useState(() => Date.now());

  useEffect(() => {
    const onFocus = () => setActiveAt(Date.now());

    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return useCallback(
    (lastMessageAt?: string | null) =>
      chatPollMs(
        Date.now() - Math.max(activeAt, lastMessageAt ? Date.parse(lastMessageAt) : 0),
        activeMs
      ),
    [activeAt, activeMs]
  );
};

type TimedMessage = { id: string; created_at: string };

// The time to ask for messages from, or null to read the whole chat. Messages
// never change once sent, so only new ones are needed after the first read.
export const messagesSince = (known: readonly TimedMessage[]): string | null => {
  const newest = known.at(-1)?.created_at;

  return newest ? new Date(Date.parse(newest) - MESSAGE_OVERLAP_MS).toISOString() : null;
};

// Adds what is new, oldest first. Returns `known` itself when nothing is, so the
// chat does not redraw every time it checks.
export const mergeMessages = <Message extends TimedMessage>(
  known: Message[],
  incoming: Message[]
): Message[] => {
  const seen = new Set(known.map((message) => message.id));
  const added = incoming.filter((message) => !seen.has(message.id));

  return added.length === 0
    ? known
    : [...known, ...added].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
};
