import { describe, expect, it } from "vitest";

import {
  parseListingRequestReferenceLinks,
  validateListingRequestForm,
} from "../listings/listingRequestForm";

describe("listing commission form helpers", () => {
  it("parses reference links one per line and removes empty rows", () => {
    expect(
      parseListingRequestReferenceLinks(`
        https://example.com/one

        https://example.com/two
      `)
    ).toEqual(["https://example.com/one", "https://example.com/two"]);
  });

  it("returns trimmed valid form values", () => {
    const result = validateListingRequestForm({
      requestTitle: " Custom cozy emote pack ",
      requestDetails:
        " I need three cozy emotes for my Twitch channel launch. ",
      requestedTimeline: " Flexible, ideally before June 10. ",
      budgetText: "75",
      referenceLinksText: `
        https://example.com/reference-one
        https://example.com/reference-two
      `,
    });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      requestTitle: "Custom cozy emote pack",
      requestDetails:
        "I need three cozy emotes for my Twitch channel launch.",
      requestedTimeline: "Flexible, ideally before June 10.",
      budgetAmount: 75,
      referenceLinks: [
        "https://example.com/reference-one",
        "https://example.com/reference-two",
      ],
    });
  });

  it("stores optional values as empty-safe values", () => {
    const result = validateListingRequestForm({
      requestTitle: "Simple commission",
      requestDetails: "Please make a simple cozy emote.",
      requestedTimeline: "   ",
      budgetText: "   ",
      referenceLinksText: "   ",
    });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      requestTitle: "Simple commission",
      requestDetails: "Please make a simple cozy emote.",
      requestedTimeline: undefined,
      budgetAmount: null,
      referenceLinks: [],
    });
  });

  it("returns validation errors for too-short required fields", () => {
    const result = validateListingRequestForm({
      requestTitle: "Hi",
      requestDetails: "Too short",
      requestedTimeline: "",
      budgetText: "",
      referenceLinksText: "",
    });

    expect(result.values).toBeNull();
    expect(result.errors).toEqual({
      requestTitle: "Summary must be between 3 and 120 characters.",
      requestDetails: "Details must be between 10 and 2000 characters.",
    });
  });

  it("rejects invalid budget values", () => {
    const result = validateListingRequestForm({
      requestTitle: "Simple commission",
      requestDetails: "Please make a simple cozy emote.",
      requestedTimeline: "",
      budgetText: "-1",
      referenceLinksText: "",
    });

    expect(result.values).toBeNull();
    expect(result.errors.budgetAmount).toBe(
      "Budget must be a valid amount between 0 and 999999.99."
    );
  });

  it("rejects more than five reference links", () => {
    const result = validateListingRequestForm({
      requestTitle: "Simple commission",
      requestDetails: "Please make a simple cozy emote.",
      requestedTimeline: "",
      budgetText: "",
      referenceLinksText: `
        https://example.com/one
        https://example.com/two
        https://example.com/three
        https://example.com/four
        https://example.com/five
        https://example.com/six
      `,
    });

    expect(result.values).toBeNull();
    expect(result.errors.referenceLinks).toBe("Add up to 5 reference links.");
  });

  it("rejects non-http reference links", () => {
    const result = validateListingRequestForm({
      requestTitle: "Simple commission",
      requestDetails: "Please make a simple cozy emote.",
      requestedTimeline: "",
      budgetText: "",
      referenceLinksText: "ftp://example.com/reference",
    });

    expect(result.values).toBeNull();
    expect(result.errors.referenceLinks).toBe(
      "Reference links must start with http:// or https://."
    );
  });
});