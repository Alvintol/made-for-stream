import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CreatorCard, { type CreatorCardModel } from "../creators/CreatorCard";
import {
  HubActionsContext,
  HubStateContext,
} from "../../providers/hub/HubProvider";
import type { HubActions, HubState } from "../../providers/hub";

// Mock the Twitch streams hook so the test controls live status
vi.mock("../../hooks/useTwitchStreams", () => ({
  useTwitchStreams: vi.fn(),
}));

import { useTwitchStreams } from "../../hooks/useTwitchStreams";

const mockUseTwitchStreams = vi.mocked(useTwitchStreams);

// Builds a mocked useTwitchStreams() result
// The real hook returns more than the component needs, so this helper
// gives us the fields the test cares about and then casts to the full type
const createTwitchStreamsResult = (
  overrides?: Partial<ReturnType<typeof useTwitchStreams>>
): ReturnType<typeof useTwitchStreams> =>
  ({
    twitchByLogin: {},
    data: [],
    logins: [],
    error: null,
    isFetching: false,
    ...overrides,
  }) as unknown as ReturnType<typeof useTwitchStreams>;

// Mock Hub actions used by FavouriteButton inside CreatorCard
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

// Renders the component inside the providers it depends on
const renderWithProviders = (
  ui: React.ReactNode,
  stateOverrides?: Partial<HubState>
) => {
  const state = createState(stateOverrides);
  const actions = createActions();

  return render(
    <MemoryRouter>
      <HubStateContext.Provider value={state}>
        <HubActionsContext.Provider value={actions}>
          {ui}
        </HubActionsContext.Provider>
      </HubStateContext.Provider>
    </MemoryRouter>
  );
};

// Small reusable creator factory for tests
const createCreator = (
  overrides?: Partial<CreatorCardModel>
): CreatorCardModel => ({
  id: "creator-amatrine",
  handle: "Amatrine",
  displayName: "Amatrine",
  verified: true,
  bio: "Freelance artist for emotes and overlays.",
  tags: ["emotes", "overlays"],
  specialties: ["emotes", "overlays"],
  commissionStatus: "open",
  platforms: {
    twitch: {
      login: "Amatrine",
      userId: "twitch-amatrine",
    },
  },
  links: {
    twitch: "https://twitch.tv/Amatrine",
  },
  live: {
    isLive: false,
    title: undefined,
    platform: "twitch",
  },
  ...overrides,
});

describe("CreatorCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: creator is not live
    mockUseTwitchStreams.mockReturnValue(createTwitchStreamsResult());
  });

  it("renders the creator display name and bio", () => {
    const creator = createCreator();

    renderWithProviders(<CreatorCard creator={creator} />);

    expect(screen.getByText("Amatrine")).toBeInTheDocument();
    expect(
      screen.getByText("Freelance artist for emotes and overlays.")
    ).toBeInTheDocument();
  });

  it("shows the verified badge when the creator is verified", () => {
    const creator = createCreator({ verified: true });

    renderWithProviders(<CreatorCard creator={creator} />);

    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("does not show the verified badge when the creator is not verified", () => {
    const creator = createCreator({ verified: false });

    renderWithProviders(<CreatorCard creator={creator} />);

    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("shows the live badge when the creator is live", () => {
    const creator = createCreator({
      live: {
        isLive: true,
        title: "Grinding ranked",
        platform: "twitch",
      },
    });

    renderWithProviders(<CreatorCard creator={creator} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("links to the creator profile page", () => {
    const creator = createCreator({
      id: "creator-rigmancer",
      handle: "rigmancer",
      displayName: "Rigmancer",
    });

    renderWithProviders(<CreatorCard creator={creator} />);

    const link = screen.getByRole("link");

    expect(link).toHaveAttribute("href", "/creator/rigmancer");
  });

  it("renders the favourite button inside the card", () => {
    const creator = createCreator();

    renderWithProviders(<CreatorCard creator={creator} />);

    expect(
      screen.getByRole("button", { name: "Add favourite" })
    ).toBeInTheDocument();
  });
});