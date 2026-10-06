import { describe, expect, it } from "vitest";
import { buildListingRequestSnapshot } from "../listings/listingRequestSnapshot";
import type { PublicListingRow } from "../../hooks/listings/usePublicListing";

const listing: PublicListingRow = {
  id: "listing-1",
  user_id: "creator-1",
  title: "Cozy Emote Pack",
  short: "12 emotes + variants.",
  offering_type: "digital",
  fulfilment_mode: "request",
  category: "emotes",
  video_subtype: null,
  price_type: "fixed",
  price_min: 18,
  price_max: 18,
  deliverables: ["png", "licence notes"],
  tags: ["emotes", "png", "cozy"],
  preview_url: "https://example.com/preview.png",
  animated_preview_url: null,
  status: "published",
  is_active: true,
  is_free: false,
  free_delivery_type: null,
  free_external_url: null,
  free_file_path: null,
  free_file_name: null,
  updated_at: "2026-04-22T00:00:00.000Z",
};

describe("buildListingRequestSnapshot", () => {
  it("captures the buyer-visible listing state at request time", () => {
    const snapshot = buildListingRequestSnapshot(listing);

    expect(snapshot).toEqual({
      listing_id: "listing-1",
      title: "Cozy Emote Pack",
      short: "12 emotes + variants.",
      offering_type: "digital",
      fulfilment_mode: "request",
      category: "emotes",
      video_subtype: null,
      price_type: "fixed",
      price_min: 18,
      price_max: 18,
      deliverables: ["png", "licence notes"],
      tags: ["emotes", "png", "cozy"],
      preview_url: "https://example.com/preview.png",
      status: "published",
      is_active: true,
      updated_at: "2026-04-22T00:00:00.000Z",
    });
  });

  it("preserves fulfilment mode and updated_at for dispute context", () => {
    const snapshot = buildListingRequestSnapshot({
      ...listing,
      fulfilment_mode: "instant",
      updated_at: "2026-04-23T15:45:00.000Z",
    });

    expect(snapshot.fulfilment_mode).toBe("instant");
    expect(snapshot.updated_at).toBe("2026-04-23T15:45:00.000Z");
  });
});