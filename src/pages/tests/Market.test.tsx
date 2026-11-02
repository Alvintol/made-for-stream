import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HubProvider from "../../providers/hub";
import Market from "../Market";

const mocks = vi.hoisted(() => ({
  useMarketListings: vi.fn(),
  fetchNextPage: vi.fn(),
}));

vi.mock("../../hooks/listings/useMarketListings", () => ({
  useMarketListings: mocks.useMarketListings,
}));

vi.mock("../../hooks/useTwitchStreams", () => ({
  useTwitchStreams: () => ({ twitchByLogin: {} }),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

const renderMarket = (path = "/market", forceFree = false) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <HubProvider>
        <Market forceFree={forceFree} />
      </HubProvider>
    </MemoryRouter>,
  );

const lastFilters = () => mocks.useMarketListings.mock.lastCall?.[0];

describe("Market", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMarketListings.mockReturnValue({
      data: { pages: [{ rows: [], next: null }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mocks.fetchNextPage,
      isFetchingNextPage: false,
    });
  });

  it("keeps what is typed and searches once typing pauses", async () => {
    renderMarket();

    const search = screen.getByPlaceholderText("Search listings...");
    fireEvent.change(search, { target: { value: "emote" } });

    await waitFor(() => expect(lastFilters()?.q).toBe("emote"));
    expect(search).toHaveValue("emote");
  });

  it("keeps a chosen category", async () => {
    renderMarket();

    const [, category] = screen.getAllByRole("combobox");
    fireEvent.change(category, { target: { value: "emotes" } });

    await waitFor(() => expect(lastFilters()?.category).toBe("emotes"));
    expect(category).toHaveValue("emotes");
  });

  it("takes its filters from a link", async () => {
    renderMarket("/market?q=panel&cat=emotes");

    await waitFor(() =>
      expect(lastFilters()).toMatchObject({ q: "panel", category: "emotes" }),
    );
  });

  it("asks only for free listings on the free page, whatever type was picked", () => {
    renderMarket("/free", true);

    expect(lastFilters()).toMatchObject({ freeOnly: true, type: null });
  });

  it("offers more only when there is another page", () => {
    const { unmount } = renderMarket();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    unmount();

    mocks.useMarketListings.mockReturnValue({
      data: { pages: [{ rows: [], next: "cursor" }] },
      isLoading: false,
      error: null,
      hasNextPage: true,
      fetchNextPage: mocks.fetchNextPage,
      isFetchingNextPage: false,
    });

    renderMarket();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(mocks.fetchNextPage).toHaveBeenCalledOnce();
  });
});
