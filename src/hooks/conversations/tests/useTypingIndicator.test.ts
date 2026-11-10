import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (message: { payload?: unknown }) => void;

const fake = vi.hoisted(() => {
  const state = {
    topic: "",
    handler: null as Handler | null,
    onStatus: null as ((status: string) => void) | null,
    send: vi.fn(),
  };

  const channel = {
    on: (_type: string, _filter: unknown, handler: Handler) => {
      state.handler = handler;
      return channel;
    },
    subscribe: (onStatus: (status: string) => void) => {
      state.onStatus = onStatus;
      return channel;
    },
    send: state.send,
  };

  return { state, channel };
});

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    channel: (topic: string) => {
      fake.state.topic = topic;
      return fake.channel;
    },
    removeChannel: vi.fn(),
  },
}));

import { TYPING_SEND_EVERY_MS, TYPING_SHOW_FOR_MS, useTypingIndicator } from "../useTypingIndicator";

const receive = (payload: unknown) => act(() => fake.state.handler?.({ payload }));

describe("useTypingIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.state.send.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("shows the other person typing, and hides after a pause or when they stop", () => {
    const { result } = renderHook(() => useTypingIndicator("c1", "me", true));

    expect(fake.state.topic).toBe("conversation:c1");

    receive({ user_id: "them", typing: true });
    expect(result.current.otherTyping).toBe(true);

    act(() => vi.advanceTimersByTime(TYPING_SHOW_FOR_MS));
    expect(result.current.otherTyping).toBe(false);

    receive({ user_id: "them", typing: true });
    receive({ user_id: "them", typing: false });
    expect(result.current.otherTyping).toBe(false);
  });

  it("ignores the same person typing in another tab", () => {
    const { result } = renderHook(() => useTypingIndicator("c1", "me", true));

    receive({ user_id: "me", typing: true });
    expect(result.current.otherTyping).toBe(false);
  });

  it("sends once the chat has joined, at most every two seconds, then stopped once", () => {
    const { result } = renderHook(() => useTypingIndicator("c1", "me", true));

    result.current.notifyTyping();
    expect(fake.state.send).not.toHaveBeenCalled();

    act(() => fake.state.onStatus?.("SUBSCRIBED"));

    result.current.notifyTyping();
    result.current.notifyTyping();
    expect(fake.state.send).toHaveBeenCalledTimes(1);
    expect(fake.state.send).toHaveBeenLastCalledWith({
      type: "broadcast",
      event: "typing",
      payload: { user_id: "me", typing: true },
    });

    vi.advanceTimersByTime(TYPING_SEND_EVERY_MS);
    result.current.notifyTyping();
    expect(fake.state.send).toHaveBeenCalledTimes(2);

    result.current.notifyStopped();
    result.current.notifyStopped();
    expect(fake.state.send).toHaveBeenCalledTimes(3);
    expect(fake.state.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: { user_id: "me", typing: false } })
    );
  });

  it("does nothing in a read-only chat", () => {
    fake.state.topic = "";
    renderHook(() => useTypingIndicator("c1", "me", false));

    expect(fake.state.topic).toBe("");
  });
});
