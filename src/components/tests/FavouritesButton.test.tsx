import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HubActionsContext,
  HubStateContext,
} from "../../providers/hub/HubProvider";
import React from "react";
import type { HubActions, HubState } from "../../providers/hub";
import FavouriteButton from '../layout/FavouriteButton';

// Mock action functions so we can verify which one gets called
const mockSetFilters = vi.fn();
const mockResetFilters = vi.fn();
const mockRefreshFavourites = vi.fn();
const mockToggleFavouriteCreator = vi.fn();
const mockToggleFavouriteListing = vi.fn();

// Builds a fresh Hub state object for each test
const createState = (overrides?: Partial<HubState>): HubState => ({
  filters: {
    q: "",
    onlyLive: false,
    onlyOpen: false,
    type: "all",
    category: "all",
    videoSubtype: "all",
    freeOnly: false,
  },
  favourites: {
    creators: {},
    listings: {},
  },
  favouritesLoaded: true,
  ...overrides,
});

// Builds a full Hub actions object for the mocked provider
const createActions = (): HubActions => ({
  setFilters: mockSetFilters,
  resetFilters: mockResetFilters,
  refreshFavourites: mockRefreshFavourites,
  toggleFavouriteCreator: mockToggleFavouriteCreator,
  toggleFavouriteListing: mockToggleFavouriteListing,
});

// Test helper that renders the button inside mocked Hub contexts
const renderWithHub = (
  ui: React.ReactNode,
  stateOverrides?: Partial<HubState>
) => {
  const state = createState(stateOverrides);
  const actions = createActions();

  return render(
    <HubStateContext.Provider value={state} >
      <HubActionsContext.Provider value={actions} >
        {ui}
      </HubActionsContext.Provider>
    </HubStateContext.Provider>
  );
};

describe("FavouriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an unfavourited creator button by default", () => {
    renderWithHub(
      <FavouriteButton kind="creator" targetId="creator-inkwellotter" />
    );

    const button = screen.getByRole("button", { name: "Add favourite" });

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", "Favourite");
  });

  it("renders the heart inside a standard SVG view box", () => {
    renderWithHub(
      <FavouriteButton kind="creator" targetId="creator-inkwellotter" />
    );

    const heart = screen
      .getByRole("button", { name: "Add favourite" })
      .querySelector("svg");

    expect(heart).toHaveAttribute("viewBox", "0 0 24 24");
    expect(heart).not.toHaveClass("overflow-visible");
  });

  it("renders a favourited creator button when the creator is in state", () => {
    renderWithHub(
      <FavouriteButton kind="creator" targetId="creator-inkwellotter" />,
      {
        favourites: {
          creators: {
            "creator-inkwellotter": true,
          },
          listings: {},
        },
      }
    );

    const button = screen.getByRole("button", { name: "Remove favourite" });

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("title", "Favourited");
  });

  it("calls toggleFavouriteCreator when a creator button is clicked", async () => {
    const user = userEvent.setup();

    renderWithHub(
      <FavouriteButton kind="creator" targetId="creator-rigmancer" />
    );

    await user.click(screen.getByRole("button", { name: "Add favourite" }));

    expect(mockToggleFavouriteCreator).toHaveBeenCalledTimes(1);
    expect(mockToggleFavouriteCreator).toHaveBeenCalledWith("creator-rigmancer");
    expect(mockToggleFavouriteListing).not.toHaveBeenCalled();
  });

  it("calls toggleFavouriteListing when a listing button is clicked", async () => {
    const user = userEvent.setup();

    renderWithHub(
      <FavouriteButton kind="listing" targetId="listing-rigging-01" />
    );

    await user.click(screen.getByRole("button", { name: "Add favourite" }));

    expect(mockToggleFavouriteListing).toHaveBeenCalledTimes(1);
    expect(mockToggleFavouriteListing).toHaveBeenCalledWith("listing-rigging-01");
    expect(mockToggleFavouriteCreator).not.toHaveBeenCalled();
  });

  it("renders a favourited listing button when the listing is in state", () => {
    renderWithHub(
      <FavouriteButton kind="listing" targetId="listing-audio-01" />,
      {
        favourites: {
          creators: {},
          listings: {
            "listing-audio-01": true,
          },
        },
      }
    );

    const button = screen.getByRole("button", { name: "Remove favourite" });

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("title", "Favourited");
  });
});
