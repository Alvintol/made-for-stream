import { describe, expect, it } from "vitest";

import {
  parseListingRequestReferenceLinks,
  BUDGET_FORMAT_MESSAGE,
  parseListingRequestBudget,
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
      budgetAmountMax: null,
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
      budgetAmountMax: null,
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
    expect(result.errors.budgetAmount).toBe(BUDGET_FORMAT_MESSAGE);
  });

  it("reads a single budget amount however it is written", () => {
    expect(parseListingRequestBudget("")).toBeNull();
    expect(parseListingRequestBudget("   ")).toBeNull();
    expect(parseListingRequestBudget("100")).toEqual({ min: 100, max: null });
    expect(parseListingRequestBudget(" $1,250.50 ")).toEqual({ min: 1250.5, max: null });
    expect(parseListingRequestBudget("CAD 100")).toEqual({ min: 100, max: null });
    expect(parseListingRequestBudget("100usd")).toEqual({ min: 100, max: null });
    // A comma before two digits is a decimal comma, not thousands.
    expect(parseListingRequestBudget("100,50 €")).toEqual({ min: 100.5, max: null });
  });

  it("reads a budget range, in either order and with any common separator", () => {
    const range = { min: 100, max: 150 };

    expect(parseListingRequestBudget("100-150")).toEqual(range);
    expect(parseListingRequestBudget("100 - 150")).toEqual(range);
    expect(parseListingRequestBudget("$100 – $150")).toEqual(range);
    expect(parseListingRequestBudget("100 to 150")).toEqual(range);
    expect(parseListingRequestBudget("100 TO 150 CAD")).toEqual(range);
    expect(parseListingRequestBudget("150-100")).toEqual(range);
    // The same figure twice is one figure.
    expect(parseListingRequestBudget("100-100")).toEqual({ min: 100, max: null });
  });

  it("refuses text it cannot be sure of, instead of guessing a number from it", () => {
    ["around 100", "100ish", "100 per emote, 5 emotes", "cheap", "-1", "100-150-200", "1000000", "1.999"].forEach(
      (text) => expect(parseListingRequestBudget(text)).toBe("invalid"),
    );
  });

  it("saves the two ends of a range", () => {
    const result = validateListingRequestForm({
      requestTitle: "Simple commission",
      requestDetails: "Please make a simple cozy emote.",
      requestedTimeline: "",
      budgetText: "100 to 150",
      referenceLinksText: "",
    });

    expect(result.values).toMatchObject({ budgetAmount: 100, budgetAmountMax: 150 });
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