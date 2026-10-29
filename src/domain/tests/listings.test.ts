import { describe, expect, it } from "vitest";
import {
  allowsFreeListing,
  allowsInstantFulfilment,
  getAllowedFulfilmentModes,
  getFulfilmentModeCopy,
  isValidFreeExternalUrl,
  normaliseFulfilmentMode,
  validateFreeListingInput,
} from "../listings/listings";

describe("listings domain helpers", () => {
  it("allows instant fulfilment only for digital listings", () => {
    expect(allowsInstantFulfilment("digital")).toBe(true);
    expect(allowsInstantFulfilment("commission")).toBe(false);
    expect(allowsInstantFulfilment("service")).toBe(false);
  });

  it("returns the correct allowed fulfilment modes for each offering type", () => {
    expect(getAllowedFulfilmentModes("digital")).toEqual(["request", "instant"]);
    expect(getAllowedFulfilmentModes("commission")).toEqual(["request"]);
    expect(getAllowedFulfilmentModes("service")).toEqual(["request"]);
  });

  it("normalises invalid instant combinations back to commission", () => {
    expect(normaliseFulfilmentMode("digital", "instant")).toBe("instant");
    expect(normaliseFulfilmentMode("digital", "request")).toBe("request");
    expect(normaliseFulfilmentMode("commission", "instant")).toBe("request");
    expect(normaliseFulfilmentMode("service", "instant")).toBe("request");
  });

  it("returns commission CTA copy for commission listings", () => {
    expect(getFulfilmentModeCopy("request")).toEqual({
      title: "listing.requestTitle",
      text: "listing.requestText",
      primaryLabel: "listing.requestButton",
    });
  });

  it("returns instant CTA copy for instant listings", () => {
    expect(getFulfilmentModeCopy("instant")).toEqual({
      title: "listing.instantTitle",
      text: "listing.instantText",
      primaryLabel: "listing.instantButton",
    });
  });

  it("allows free listings only for digital offerings", () => {
    expect(allowsFreeListing("digital")).toBe(true);
    expect(allowsFreeListing("commission")).toBe(false);
    expect(allowsFreeListing("service")).toBe(false);
  });

  it("validates external free-listing links", () => {
    expect(isValidFreeExternalUrl("https://itch.io/my-game")).toBe(true);
    expect(isValidFreeExternalUrl("http://example.com")).toBe(true);
    expect(isValidFreeExternalUrl("not-a-url")).toBe(false);
    expect(isValidFreeExternalUrl("ftp://example.com")).toBe(false);
  });

  it("passes non-free listings without requiring delivery fields", () => {
    expect(
      validateFreeListingInput({
        isFree: false,
        deliveryType: null,
        externalUrl: "",
        hasFile: false,
      })
    ).toBeNull();
  });

  it("requires a delivery type once a listing is marked free", () => {
    expect(
      validateFreeListingInput({
        isFree: true,
        deliveryType: null,
        externalUrl: "",
        hasFile: false,
      })
    ).toBe("Choose how buyers will get this free listing.");
  });

  it("requires a valid external link for the external_link delivery type", () => {
    expect(
      validateFreeListingInput({
        isFree: true,
        deliveryType: "external_link",
        externalUrl: "not-a-url",
        hasFile: false,
      })
    ).toBe("Enter a valid link starting with http:// or https://.");

    expect(
      validateFreeListingInput({
        isFree: true,
        deliveryType: "external_link",
        externalUrl: "https://itch.io/my-game",
        hasFile: false,
      })
    ).toBeNull();
  });

  it("requires an uploaded file for the download delivery type", () => {
    expect(
      validateFreeListingInput({
        isFree: true,
        deliveryType: "download",
        externalUrl: "",
        hasFile: false,
      })
    ).toBe("Upload a file for buyers to download.");

    expect(
      validateFreeListingInput({
        isFree: true,
        deliveryType: "download",
        externalUrl: "",
        hasFile: true,
        fileSizeBytes: 1024,
      })
    ).toBeNull();
  });

  it("rejects a downloadable file over the 200MB limit", () => {
    expect(
      validateFreeListingInput({
        isFree: true,
        deliveryType: "download",
        externalUrl: "",
        hasFile: true,
        fileSizeBytes: 200 * 1024 * 1024 + 1,
      })
    ).toBe("That file is larger than the 200MB limit for free downloads.");
  });
});