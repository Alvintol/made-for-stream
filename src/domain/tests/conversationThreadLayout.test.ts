import { describe, expect, it } from "vitest";

import {
  getConversationMessageSide,
  startsNewConversationDay,
} from "../conversations/conversations";

const people = { buyerUserId: "buyer-1", creatorUserId: "creator-1" };

describe("which side of the thread a line sits on", () => {
  it("puts a line the creator caused on the creator's side for both people", () => {
    // "The creator sent a project change order for buyer review"
    expect(
      getConversationMessageSide({ ...people, senderUserId: "creator-1", viewerUserId: "creator-1" }),
    ).toBe("own");
    expect(
      getConversationMessageSide({ ...people, senderUserId: "creator-1", viewerUserId: "buyer-1" }),
    ).toBe("other");
  });

  it("puts a line the buyer caused on the buyer's side for both people", () => {
    // "The buyer declined the project change order"
    expect(
      getConversationMessageSide({ ...people, senderUserId: "buyer-1", viewerUserId: "buyer-1" }),
    ).toBe("own");
    expect(
      getConversationMessageSide({ ...people, senderUserId: "buyer-1", viewerUserId: "creator-1" }),
    ).toBe("other");
  });

  it("leaves a line that neither of them caused in the middle", () => {
    expect(
      getConversationMessageSide({ ...people, senderUserId: "admin-1", viewerUserId: "buyer-1" }),
    ).toBe("neutral");
    expect(
      getConversationMessageSide({ ...people, senderUserId: null, viewerUserId: "buyer-1" }),
    ).toBe("neutral");
  });

  it("shows an admin every line on the other side, as it does their messages", () => {
    expect(
      getConversationMessageSide({ ...people, senderUserId: "buyer-1", viewerUserId: "admin-1" }),
    ).toBe("other");
  });
});

describe("where a new day starts in the thread", () => {
  // Mid-afternoon UTC, so the answer is the same in any time zone.
  it("starts one at the first line and at the first line of each later day", () => {
    expect(startsNewConversationDay(null, "2026-10-12T15:00:00Z")).toBe(true);
    expect(startsNewConversationDay("2026-10-12T15:00:00Z", "2026-10-12T15:30:00Z")).toBe(false);
    expect(startsNewConversationDay("2026-10-12T15:30:00Z", "2026-10-13T15:00:00Z")).toBe(true);
  });
});
