import { describe, expect, it } from "vitest";
import { chatPollMs, mergeMessages, messagesSince } from "../chatPolling";

const MINUTE = 60_000;

const message = (id: string, created_at: string) => ({ id, created_at });

describe("chatPollMs", () => {
  it("is quick while active, slower once quiet, and stops after an hour", () => {
    expect(chatPollMs(MINUTE)).toBe(15_000);
    expect(chatPollMs(10 * MINUTE)).toBe(MINUTE);
    expect(chatPollMs(59 * MINUTE)).toBe(MINUTE);
    expect(chatPollMs(60 * MINUTE)).toBe(false);
  });

  it("never speeds up a slower timer once quiet", () => {
    expect(chatPollMs(MINUTE, 30_000)).toBe(30_000);
    expect(chatPollMs(10 * MINUTE, 30_000)).toBe(MINUTE);
    expect(chatPollMs(10 * MINUTE, 2 * MINUTE)).toBe(2 * MINUTE);
  });
});

describe("messagesSince", () => {
  it("reads the whole chat the first time", () => {
    expect(messagesSince([])).toBeNull();
  });

  it("looks back a minute before the newest message", () => {
    expect(messagesSince([message("a", "2026-11-02T12:05:00.000Z")])).toBe(
      "2026-11-02T12:04:00.000Z"
    );
  });
});

describe("mergeMessages", () => {
  const first = message("a", "2026-11-02T12:00:00.000Z");
  const second = message("b", "2026-11-02T12:01:00.000Z");
  const late = message("c", "2026-11-02T12:00:30.000Z");

  it("skips messages it already has, which the look-back repeats", () => {
    const known = [first, second];

    expect(mergeMessages(known, [second])).toBe(known);
  });

  it("puts a message that appeared late in its right place", () => {
    expect(mergeMessages([first, second], [second, late])).toEqual([first, late, second]);
  });

  it("keeps the order of messages from the same moment", () => {
    const same = message("d", first.created_at);

    expect(mergeMessages([first], [same])).toEqual([first, same]);
  });
});
