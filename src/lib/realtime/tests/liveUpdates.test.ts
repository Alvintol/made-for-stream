import { describe, expect, it } from "vitest";
import { refreshesOnMessage, refreshesOnNotification } from "../liveUpdates";

describe("refreshesOnMessage", () => {
  it("reloads that chat, the inbox, the unread number and request chats", () => {
    expect(refreshesOnMessage(["conversationMessages", "c1"], "c1")).toBe(true);
    expect(refreshesOnMessage(["conversationDetails", "c1"], "c1")).toBe(true);
    expect(refreshesOnMessage(["messagesInbox", "u1"], "c1")).toBe(true);
    expect(refreshesOnMessage(["messagesInbox", "unread", "u1"], "c1")).toBe(true);
    expect(refreshesOnMessage(["requestConversation", "r1"], "c1")).toBe(true);
  });

  it("leaves other chats and unrelated pages alone", () => {
    expect(refreshesOnMessage(["conversationMessages", "c2"], "c1")).toBe(false);
    expect(refreshesOnMessage(["myListings"], "c1")).toBe(false);
  });

  it("reloads every chat after a reconnect", () => {
    expect(refreshesOnMessage(["conversationMessages", "c2"], null)).toBe(true);
  });
});

describe("refreshesOnNotification", () => {
  it("reloads request pages, lists and their parts", () => {
    expect(refreshesOnNotification(["buyerRequest", "r1"])).toBe(true);
    expect(refreshesOnNotification(["myCreatorRequests", "u1"])).toBe(true);
    expect(refreshesOnNotification(["listingRequestPayments", "r1"])).toBe(true);
  });

  it("leaves unrelated pages alone", () => {
    expect(refreshesOnNotification(["marketListings"])).toBe(false);
    expect(refreshesOnNotification(["conversationMessages", "c1"])).toBe(false);
  });
});
