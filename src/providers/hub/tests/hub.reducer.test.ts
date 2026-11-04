import { describe, expect, it } from "vitest";
import { hubReducer, initialHubState, initialFilters } from "../index";
import type { HubState } from "../hub.types";

// Creates a fresh copy of the initial Hub state for each test
const createState = (): HubState => ({
  ...initialHubState,
  filters: { ...initialHubState.filters },
  favourites: {
    creators: { ...initialHubState.favourites.creators },
    listings: { ...initialHubState.favourites.listings },
  },
});

describe("hubReducer", () => {
  it("sets filter values with filters/set", () => {
    const state = createState();

    const next = hubReducer(state, {
      type: "filters/set",
      patch: {
        q: "vtuber",
        onlyOpen: true,
        category: "vtuber-rigging",
      },
    });

    expect(next.filters.q).toBe("vtuber");
    expect(next.filters.onlyOpen).toBe(true);
    expect(next.filters.category).toBe("vtuber-rigging");

    // Unchanged filter fields should stay intact
    expect(next.filters.type).toBe(state.filters.type);
    expect(next.filters.videoSubtype).toBe(state.filters.videoSubtype);
  });

  it("resets filters with filters/reset", () => {
    const state = createState();

    const changed = hubReducer(state, {
      type: "filters/set",
      patch: {
        q: "editing",
        onlyLive: true,
        type: "service",
        category: "video-editing",
      },
    });

    const reset = hubReducer(changed, { type: "filters/reset" });

    expect(reset.filters).toEqual(initialFilters);
  });

  it("hydrates favourites with favourites/set", () => {
    const state = createState();

    const next = hubReducer(state, {
      type: "favourites/set",
      favourites: {
        creators: {
          "creator-inkwellotter": true,
        },
        listings: {
          "listing-emotes-01": true,
        },
      },
    });

    expect(next.favourites.creators["creator-inkwellotter"]).toBe(true);
    expect(next.favourites.listings["listing-emotes-01"]).toBe(true);
  });

  it("sets favouritesLoaded with favourites/setLoaded", () => {
    const state = createState();

    const next = hubReducer(state, {
      type: "favourites/setLoaded",
      value: true,
    });

    expect(next.favouritesLoaded).toBe(true);
  });

  it("toggles a creator favourite on", () => {
    const state = createState();

    const next = hubReducer(state, {
      type: "favourites/toggleCreator",
      creatorId: "creator-rigmancer",
    });

    expect(next.favourites.creators["creator-rigmancer"]).toBe(true);
  });

  it("toggles a creator favourite off", () => {
    const state = createState();

    const withFavourite = hubReducer(state, {
      type: "favourites/set",
      favourites: {
        creators: {
          "creator-rigmancer": true,
        },
        listings: {},
      },
    });

    const next = hubReducer(withFavourite, {
      type: "favourites/toggleCreator",
      creatorId: "creator-rigmancer",
    });

    expect(next.favourites.creators["creator-rigmancer"]).toBeUndefined();
  });

  it("toggles a listing favourite on", () => {
    const state = createState();

    const next = hubReducer(state, {
      type: "favourites/toggleListing",
      listingId: "listing-audio-01",
    });

    expect(next.favourites.listings["listing-audio-01"]).toBe(true);
  });

  it("toggles a listing favourite off", () => {
    const state = createState();

    const withFavourite = hubReducer(state, {
      type: "favourites/set",
      favourites: {
        creators: {},
        listings: {
          "listing-audio-01": true,
        },
      },
    });

    const next = hubReducer(withFavourite, {
      type: "favourites/toggleListing",
      listingId: "listing-audio-01",
    });

    expect(next.favourites.listings["listing-audio-01"]).toBeUndefined();
  });
});