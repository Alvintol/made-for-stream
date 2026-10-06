import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreatorListingDetails from "../listings/CreatorListingDetails";

const mocks = vi.hoisted(() => ({
  useMyListing: vi.fn(),
  useListingRevisions: vi.fn(),
  deleteDraft: vi.fn(),
  publishListing: vi.fn(),
  setListingActiveState: vi.fn(),
  moveListingToDraft: vi.fn(),
}));

vi.mock("../../hooks/listings/useMyListing", () => ({
  useMyListing: mocks.useMyListing,
}));

vi.mock("../../hooks/listings/useListingRevisions", () => ({
  useListingRevisions: mocks.useListingRevisions,
}));

vi.mock("../../hooks/listings/useDeleteListingDraft", () => ({
  useDeleteListingDraft: () => ({
    mutateAsync: mocks.deleteDraft,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/listings/usePublishListing", () => ({
  usePublishListing: () => ({
    mutateAsync: mocks.publishListing,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/listings/useSetListingActiveState", () => ({
  useSetListingActiveState: () => ({
    mutateAsync: mocks.setListingActiveState,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/listings/useMoveListingToDraft", () => ({
  useMoveListingToDraft: () => ({
    mutateAsync: mocks.moveListingToDraft,
    isPending: false,
    error: null,
  }),
}));

const createListing = (overrides = {}) => ({
  id: "listing-1",
  user_id: "creator-1",
  title: "Custom Emote Pack",
  short: "A custom emote pack for streamers.",
  offering_type: "commission",
  fulfilment_mode: "request",
  category: "emotes",
  video_subtype: null,
  price_type: "fixed",
  price_min: 50,
  price_max: 50,
  deliverables: ["3 emotes", "PNG files"],
  tags: ["emotes"],
  preview_url: null,
  status: "draft",
  is_active: false,
  admin_hidden_at: null,
  admin_hidden_by_user_id: null,
  admin_hidden_report_id: null,
  created_at: "2026-05-09T12:00:00.000Z",
  updated_at: "2026-05-09T12:00:00.000Z",
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/creator/listings/listing-1"]}>
      <Routes>
        <Route path="/creator/listings/:id" element={<CreatorListingDetails />} />
      </Routes>
    </MemoryRouter>
  );

describe("<CreatorListingDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useMyListing.mockReturnValue({
      data: createListing(),
      isLoading: false,
      error: null,
    });

    mocks.useListingRevisions.mockReturnValue({
      data: {
        rows: [],
        hasMore: false,
      },
      isLoading: false,
      error: null,
    });
  });

  it("shows normal draft listing actions", () => {
    renderPage();

    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Edit draft" })).toHaveAttribute(
      "href",
      "/creator/listings/listing-1/edit"
    );

    expect(
      screen.getByRole("button", { name: "Delete draft" })
    ).toBeInTheDocument();
  });

  it("shows a moderation lock for admin-hidden listings", () => {
    mocks.useMyListing.mockReturnValue({
      data: createListing({
        status: "published",
        is_active: false,
        admin_hidden_at: "2026-05-13T12:00:00.000Z",
        admin_hidden_by_user_id: "admin-1",
        admin_hidden_report_id: "report-1",
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Hidden by admin")).toBeInTheDocument();
    expect(screen.getByText(/hidden by moderation/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Locked by admin" })
    ).toBeDisabled();

    expect(screen.queryByRole("link", { name: "Edit draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish listing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivate listing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate listing" })).not.toBeInTheDocument();
  });
  it("says a draft is private and points at what is missing", () => {
    renderPage();

    const banner = screen.getByRole("status");

    expect(banner).toHaveTextContent("Draft: only you can see this");
    expect(banner).toHaveTextContent("1 checklist item left.");
    expect(screen.getByRole("link", { name: "See what is missing" })).toHaveAttribute(
      "href",
      "#publish-checklist",
    );
    expect(screen.queryByRole("button", { name: "Publish now" })).not.toBeInTheDocument();
  });

  it("offers Publish now in the banner once the checklist is done", () => {
    mocks.useMyListing.mockReturnValue({
      data: createListing({ preview_url: "https://example.com/preview.jpg" }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("button", { name: "Publish now" })).toBeEnabled();
  });

  it("says a published, active listing is live", () => {
    mocks.useMyListing.mockReturnValue({
      data: createListing({ status: "published", is_active: true }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Live: buyers can see this");
  });

  it("says a deactivated listing is hidden and offers to reactivate it", () => {
    mocks.useMyListing.mockReturnValue({
      data: createListing({ status: "published", is_active: false }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Deactivated: hidden from buyers");
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
  });
});
