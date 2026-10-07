import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import ListingCard, {
  type ListingCardListing,
  type ListingCardCreator,
} from "../listings/ListingCard";
import {
  HubActionsContext,
  HubStateContext,
} from "../../providers/hub/HubProvider";
import type { HubActions, HubState } from "../../providers/hub";

// Prices are shown in the creator's own currency in these tests; the
// conversion has its own tests (ListingPriceText, displayCurrency).
vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => ({ displayCurrency: null, rates: null }),
  useDisplayPreferences: () => ({ data: null, isLoading: false }),
  useSaveDisplayPreferences: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useExchangeRates: () => ({ data: null }),
}));


// Mock Hub actions used by FavouriteButton inside ListingCard
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
  ui: ReactNode,
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

// Small reusable listing factory for tests
const createListing = (
  overrides?: Partial<ListingCardListing>
): ListingCardListing => ({
  id: "listing-emotes-01",
  title: "Cozy Emote Pack (12)",
  short: "12 emotes + variants. Includes PNG + licence notes.",
  offering_type: "digital",
  price_type: "fixed",
  price_min: 18,
  price_max: 18,
  preview_url: "https://picsum.photos/seed/emotes/960/540",
  is_free: false,
  ...overrides,
});

// Small reusable creator factory for tests
const createCreator = (
  overrides?: Partial<ListingCardCreator>
): ListingCardCreator => ({
  name: "Amatrine",
  isLive: false,
  ...overrides,
});

describe("ListingCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the listing title and short description", () => {
    const listing = createListing();
    const creator = createCreator();

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("Cozy Emote Pack (12)")).toBeInTheDocument();
    expect(
      screen.getByText("12 emotes + variants. Includes PNG + licence notes.")
    ).toBeInTheDocument();
  });

  it("renders the offering type badge", () => {
    const listing = createListing({
      offering_type: "service",
    });
    const creator = createCreator();

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("service")).toBeInTheDocument();
  });

  it("renders the creator name", () => {
    const listing = createListing();
    const creator = createCreator({
      name: "Rigmancer",
    });

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("Rigmancer")).toBeInTheDocument();
  });

  it("renders the live label in the creator text when live", () => {
    const listing = createListing();
    const creator = createCreator({
      name: "Rigmancer",
      isLive: true,
    });

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("Rigmancer • Live")).toBeInTheDocument();
  });

  it("renders the live badge when the creator is live", () => {
    const listing = createListing();
    const creator = createCreator({
      isLive: true,
    });

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders a fixed price correctly", () => {
    const listing = createListing({
      price_type: "fixed",
      price_min: 18,
      price_max: 18,
    });
    const creator = createCreator();

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("$18 CAD")).toBeInTheDocument();
  });

  it("renders a starting_at price correctly", () => {
    const listing = createListing({
      price_type: "starting_at",
      price_min: 90,
      price_max: null,
    });
    const creator = createCreator({
      name: "jaQUILLyn",
    });

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("From $90 CAD")).toBeInTheDocument();
  });

  it("renders a range price correctly", () => {
    const listing = createListing({
      price_type: "range",
      price_min: 120,
      price_max: 420,
    });
    const creator = createCreator({
      name: "Rigmancer",
    });

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("$120–$420 CAD")).toBeInTheDocument();
  });

  it("links to the listing page", () => {
    const listing = createListing({
      id: "listing-rigging-01",
    });
    const creator = createCreator({
      name: "Rigmancer",
    });

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    const link = screen.getByRole("link");

    expect(link).toHaveAttribute("href", "/listing/listing-rigging-01");
  });

  it("renders the favourite button inside the card", () => {
    const listing = createListing();
    const creator = createCreator();

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(
      screen.getByRole("button", { name: "Add favourite" })
    ).toBeInTheDocument();
  });

  it("renders a Free badge and $0 price for free listings", () => {
    const listing = createListing({ is_free: true });
    const creator = createCreator();

    renderWithProviders(<ListingCard listing={listing} creator={creator} />);

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.queryByText("$18")).not.toBeInTheDocument();
  });
});