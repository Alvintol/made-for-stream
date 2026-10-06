import { describe, expect, it } from "vitest";
import { getListingRevisionChanges } from "../listings/listingRevisionDiff";
import type {
  ListingRevisionRow,
  ListingRevisionSnapshot,
} from "../../hooks/listings/useListingRevisions";

type BuildRevisionOverrides = Partial<Omit<ListingRevisionRow, "snapshot">> & {
  snapshot?: Partial<ListingRevisionSnapshot>;
};

const buildRevision = (
  overrides: BuildRevisionOverrides = {}
): ListingRevisionRow => ({
  id: overrides.id ?? 1,
  listing_id: overrides.listing_id ?? "listing-1",
  actor_user_id: overrides.actor_user_id ?? "creator-1",
  event_type: overrides.event_type ?? "updated",
  created_at: overrides.created_at ?? "2026-04-22T00:00:00.000Z",
  snapshot: {
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
    deliverables: ["png"],
    tags: ["emotes", "png"],
    preview_url: "https://example.com/preview.png",
    status: "published",
    is_active: true,
    created_at: "2026-04-20T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    ...(overrides.snapshot ?? {}),
  },
});

describe("getListingRevisionChanges", () => {
  it("returns the initial revision message when there is no previous revision", () => {
    const current = buildRevision();

    expect(getListingRevisionChanges(current, null)).toEqual([
      {
        key: "status",
        label: "Initial listing revision recorded",
      },
    ]);
  });

  it("detects a price change", () => {
    const previous = buildRevision({
      id: 1,
      snapshot: {
        price_type: "fixed",
        price_min: 18,
        price_max: 18,
      },
    });

    const current = buildRevision({
      id: 2,
      snapshot: {
        price_type: "starting_at",
        price_min: 25,
        price_max: null,
      },
    });

    expect(getListingRevisionChanges(current, previous)).toContainEqual({
      key: "price",
      label: "Price changed",
      from: "$18",
      to: "From $25",
    });
  });

  it("detects a fulfilment mode change", () => {
    const previous = buildRevision({
      id: 1,
      snapshot: {
        fulfilment_mode: "request",
      },
    });

    const current = buildRevision({
      id: 2,
      snapshot: {
        fulfilment_mode: "instant",
      },
    });

    expect(getListingRevisionChanges(current, previous)).toContainEqual({
      key: "fulfilment_mode",
      label: "Fulfilment mode changed",
      from: "request",
      to: "instant",
    });
  });

  it("detects a status change", () => {
    const previous = buildRevision({
      id: 1,
      snapshot: {
        status: "draft",
        is_active: false,
      },
    });

    const current = buildRevision({
      id: 2,
      snapshot: {
        status: "published",
        is_active: true,
      },
    });

    expect(getListingRevisionChanges(current, previous)).toContainEqual({
      key: "status",
      label: "Status changed",
      from: "draft • Inactive",
      to: "published • Active",
    });
  });

  it("detects deliverable and tag changes", () => {
    const previous = buildRevision({
      id: 1,
      snapshot: {
        deliverables: ["png"],
        tags: ["emotes"],
      },
    });

    const current = buildRevision({
      id: 2,
      snapshot: {
        deliverables: ["png", "psd"],
        tags: ["emotes", "cozy"],
      },
    });

    const changes = getListingRevisionChanges(current, previous);

    expect(changes).toContainEqual({
      key: "deliverables",
      label: "Deliverables changed",
      from: "png",
      to: "png, psd",
    });

    expect(changes).toContainEqual({
      key: "tags",
      label: "Tags changed",
      from: "emotes",
      to: "emotes, cozy",
    });
  });

  it("falls back when no tracked values changed", () => {
    const previous = buildRevision({ id: 1 });
    const current = buildRevision({ id: 2 });

    expect(getListingRevisionChanges(current, previous)).toEqual([
      {
        key: "status",
        label: "Revision recorded with no tracked field differences",
      },
    ]);
  });
});