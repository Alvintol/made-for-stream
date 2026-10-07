import { describe, expect, it } from "vitest";

import {
  getConversationDisplayContext,
  getConversationDisplayTitle,
} from "../conversations/conversationDisplay";

describe("conversation display helpers", () => {
  it("uses the conversation subject before listing title for listing commission conversations", () => {
    const item = {
      conversation: {
        conversation_type: "listing_request",
        subject: "Custom cozy emote pack",
      },
      listing: {
        title: "Custom Emote Pack",
      },
    };

    expect(getConversationDisplayTitle(item)).toBe("Custom cozy emote pack");
    expect(getConversationDisplayContext(item)).toBe("Listing: Custom Emote Pack");
  });

  it("falls back to listing title for legacy listing commission conversations", () => {
    const item = {
      conversation: {
        conversation_type: "listing_request",
        subject: null,
      },
      listing: {
        title: "Custom Emote Pack",
      },
    };

    expect(getConversationDisplayTitle(item)).toBe("Custom Emote Pack");
    expect(getConversationDisplayContext(item)).toBeNull();
  });

  it("keeps listing inquiry cards listing-first", () => {
    const item = {
      conversation: {
        conversation_type: "listing_inquiry",
        subject: "Question about delivery",
      },
      listing: {
        title: "Custom Emote Pack",
      },
    };

    expect(getConversationDisplayTitle(item)).toBe("Custom Emote Pack");
    expect(getConversationDisplayContext(item)).toBeNull();
  });

  it("falls back to safe copy when commission title and listing title are missing", () => {
    const item = {
      conversation: {
        conversation_type: "listing_request",
        subject: "   ",
      },
      listing: null,
    };

    expect(getConversationDisplayTitle(item)).toBe("Commission request");
  });
});