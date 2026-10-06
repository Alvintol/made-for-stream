import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditListing from "../listings/EditListing";

const mocks = vi.hoisted(() => ({
  useMyListing: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("../../hooks/listings/useMyListing", () => ({
  useMyListing: mocks.useMyListing,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({ data: { handle: "PizzaButt" } }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
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
    <MemoryRouter initialEntries={["/creator/listings/listing-1/edit"]}>
      <Routes>
        <Route path="/creator/listings/:id/edit" element={<EditListing />} />
      </Routes>
    </MemoryRouter>
  );

describe("<EditListing />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    mocks.useMyListing.mockReturnValue({
      data: createListing(),
      isLoading: false,
      error: null,
    });
  });

  it("renders the edit form for a normal inactive draft listing", () => {
    renderPage();

    expect(screen.getByText("Edit draft listing")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    // The thumbnail is an upload now, not a pasted link.
    expect(screen.getByLabelText("Preview image")).toHaveAttribute("type", "file");
    expect(screen.queryByLabelText("Preview URL")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save changes" })
    ).toBeInTheDocument();
  });

  it("shows a locked moderation state for admin-hidden listings", () => {
    mocks.useMyListing.mockReturnValue({
      data: createListing({
        admin_hidden_at: "2026-05-13T12:00:00.000Z",
        admin_hidden_by_user_id: "admin-1",
        admin_hidden_report_id: "report-1",
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Listing locked by moderation")).toBeInTheDocument();

    expect(
      screen.getByText(
        /This listing has been hidden by an admin and cannot be edited/
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument();

    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});