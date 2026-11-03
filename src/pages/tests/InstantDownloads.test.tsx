import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: null as unknown,
  isLoading: false,
  start: vi.fn(),
  startError: null as unknown,
  downloads: [] as unknown[],
  getUrl: vi.fn(),
}));

vi.mock("../../hooks/listings/useInstantDownloads", () => ({
  useInstantListing: () => ({ data: mocks.state, isLoading: mocks.isLoading }),
  useStartInstantPurchase: () => ({
    mutateAsync: mocks.start,
    isPending: false,
    error: mocks.startError,
  }),
  useMyDownloads: () => ({ data: mocks.downloads, isLoading: false, isError: false, refetch: vi.fn() }),
  getProductFileDownloadUrl: mocks.getUrl,
}));

import InstantPurchasePanel from "../../components/listings/InstantPurchasePanel";
import Downloads from "../buyer/Downloads";

const file = { name: "overlay_pack_3f9a1c2b7d4e.zip", size_bytes: 2 * 1024 ** 2, uploaded_at: "2026-11-03T00:00:00Z" };

const renderPanel = (props: Partial<Parameters<typeof InstantPurchasePanel>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={["/listing/l1"]}>
      <Routes>
        <Route
          path="/listing/l1"
          element={
            <InstantPurchasePanel listingId="l1" licence="stream" userId="u1" isOwnListing={false} {...props} />
          }
        />
        <Route path="/payments/checkout/:paymentId" element={<p>Checkout page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.state = { files: [file], owned: false, pending_payment_id: null };
  mocks.isLoading = false;
  mocks.start.mockReset();
  mocks.startError = null;
  mocks.downloads = [];
  mocks.getUrl.mockReset();
});

describe("<InstantPurchasePanel />", () => {
  it("shows the licence and files, then starts the purchase and opens checkout", async () => {
    mocks.start.mockResolvedValue({ listing_request_id: "r1", payment_id: "p1" });

    renderPanel();

    expect(screen.getByText("Licence: Streaming use")).toBeInTheDocument();
    expect(screen.getByText("overlay_pack.zip")).toBeInTheDocument();
    expect(screen.getByText(/Final sale: no cancellations or refunds/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));

    await waitFor(() => expect(screen.getByText("Checkout page")).toBeInTheDocument());
    expect(mocks.start).toHaveBeenCalledWith("l1");
  });

  it("sends an owner of the item to their downloads", () => {
    mocks.state = { files: [file], owned: true, pending_payment_id: null };

    renderPanel();

    expect(screen.getByRole("link", { name: "Go to your downloads" })).toHaveAttribute("href", "/downloads");
    expect(screen.queryByRole("button", { name: "Buy now" })).not.toBeInTheDocument();
  });

  it("offers to continue a payment that's waiting", () => {
    mocks.state = { files: [file], owned: false, pending_payment_id: "p1" };

    renderPanel();

    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
  });

  it("can't be bought without a file or a licence", () => {
    mocks.state = { files: [], owned: false, pending_payment_id: null };

    renderPanel();

    expect(screen.getByText("This item isn't ready to buy yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks a visitor to sign in", () => {
    renderPanel({ userId: null });

    expect(screen.getByRole("link", { name: "Sign in to buy" })).toHaveAttribute("href", "/signin");
  });

  it("shows why the database refused", () => {
    mocks.startError = new Error("You already own this. You'll find it under Downloads.");

    renderPanel();

    expect(screen.getByText("You already own this. You'll find it under Downloads.")).toBeInTheDocument();
  });
});

describe("<Downloads />", () => {
  it("lists each purchase with its files, licence and invoice", () => {
    mocks.downloads = [
      {
        listing_request_id: "r1",
        listing_id: "l1",
        payment_id: "p1",
        title: "Cosy overlay pack",
        licence: "commercial",
        paid_at: "2026-11-03T12:00:00Z",
        files: [{ ...file, path: "l1/overlay_pack_3f9a1c2b7d4e.zip" }],
        downloaded: false,
      },
    ];

    render(
      <MemoryRouter>
        <Downloads />
      </MemoryRouter>,
    );

    expect(screen.getByText("Cosy overlay pack")).toBeInTheDocument();
    expect(screen.getByText(/Licence: Commercial use/)).toBeInTheDocument();
    expect(screen.getByText("overlay_pack.zip")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invoice" })).toHaveAttribute("href", "/payments/invoice/p1");
  });

  it("says when a download can't start", async () => {
    mocks.getUrl.mockRejectedValue(new Error("This file isn't available to you."));
    mocks.downloads = [
      {
        listing_request_id: "r1",
        listing_id: "l1",
        payment_id: "p1",
        title: "Cosy overlay pack",
        licence: "stream",
        paid_at: "2026-11-03T12:00:00Z",
        files: [{ ...file, path: "l1/overlay_pack_3f9a1c2b7d4e.zip" }],
        downloaded: true,
      },
    ];

    render(
      <MemoryRouter>
        <Downloads />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(screen.getByText("The download could not start. Please try again.")).toBeInTheDocument(),
    );
    expect(mocks.getUrl).toHaveBeenCalledWith("l1/overlay_pack_3f9a1c2b7d4e.zip");
  });

  it("says so when nothing has been bought", () => {
    render(
      <MemoryRouter>
        <Downloads />
      </MemoryRouter>,
    );

    expect(screen.getByText("You haven't bought any downloads yet.")).toBeInTheDocument();
  });
});
