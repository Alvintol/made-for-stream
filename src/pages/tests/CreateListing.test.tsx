import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateListing from "../listings/CreateListing";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  publish: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({ data: { handle: "PizzaButt" } }),
}));

// The real preparation needs a canvas; the field's own tests cover it.
vi.mock("../../lib/listings/listingPreviewImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/listings/listingPreviewImage")>()),
  renderListingPreviewImage: async () => new Blob(["prepared"], { type: "image/webp" }),
  uploadListingPreviewImage: mocks.upload,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "creator-1" } }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => {
        mocks.insert(row);

        return {
          select: () => ({
            single: async () => ({ data: { id: "listing-9" }, error: null }),
          }),
        };
      },
    }),
  },
}));

vi.mock("../../hooks/listings/usePublishListing", () => ({
  usePublishListing: () => ({ mutateAsync: mocks.publish }),
}));

// Stands in for the listing details page: shows where we landed and any
// publish error carried over.
const DetailsProbe = () => {
  const location = useLocation();
  const state = location.state as { publishError?: string } | null;

  return (
    <div>
      landed on {location.pathname}
      {state?.publishError ? ` with error: ${state.publishError}` : ""}
    </div>
  );
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/creator/listings/new"]}>
      <Routes>
        <Route path="/creator/listings/new" element={<CreateListing />} />
        <Route path="/creator/listings/:id" element={<DetailsProbe />} />
      </Routes>
    </MemoryRouter>,
  );

// By field id: several labels start with the same word ("Price type", "Price min").
const type = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id) as HTMLElement, { target: { value } });

// The least a draft needs.
const fillDraftFields = () => {
  type("title", "Custom Emote Pack");
  type("short", "A custom emote pack for streamers.");
  type("category", "emotes");
  type("priceMin", "50");
};

// Everything the publish checklist asks for.
const fillEverything = async () => {
  fillDraftFields();
  type("deliverablesText", "3 emotes");
  type("tagsText", "emotes");
  fireEvent.change(screen.getByLabelText("Preview image"), {
    target: { files: [new File(["x"], "art.png", { type: "image/png" })] },
  });

  await screen.findByText("Everything on the checklist is done.");
};

const getButtons = (name: string) => screen.getAllByRole("button", { name });

describe("<CreateListing /> publish flow", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.publish.mockReset().mockResolvedValue("listing-9");
    mocks.upload.mockReset().mockResolvedValue(
      "https://project.supabase.co/storage/v1/object/public/listing-previews/creator-1/a.webp",
    );
    URL.createObjectURL = vi.fn(() => "blob:prepared");
    URL.revokeObjectURL = vi.fn();
  });

  it("keeps Publish now disabled until the checklist is done, but lets a draft be saved", () => {
    renderPage();

    fillDraftFields();

    getButtons("Publish now").forEach((button) => expect(button).toBeDisabled());
    getButtons("Save as draft").forEach((button) => expect(button).toBeEnabled());
    expect(screen.getByText(/items left before this can be published/i)).toBeInTheDocument();
  });

  it("saves a draft and goes straight to the listing's page", async () => {
    renderPage();

    fillDraftFields();
    fireEvent.click(getButtons("Save as draft")[0]);

    expect(await screen.findByText("landed on /creator/listings/listing-9")).toBeInTheDocument();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        is_active: false,
        preview_url: null,
        preview_watermarked: false,
      }),
    );
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("publishes straight away when the checklist is done", async () => {
    renderPage();

    await fillEverything();

    fireEvent.click(getButtons("Publish now")[0]);

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith("listing-9"));
    expect(await screen.findByText("landed on /creator/listings/listing-9")).toBeInTheDocument();

    // The prepared copy is uploaded, and its address and watermark choice are saved.
    expect(mocks.upload).toHaveBeenCalledWith({ userId: "creator-1", blob: expect.any(Blob) });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        preview_url: expect.stringContaining("/listing-previews/creator-1/"),
        preview_watermarked: true,
      }),
    );
  });

  it("keeps the draft and carries the reason when publishing is refused", async () => {
    mocks.publish.mockRejectedValue(new Error("Connect and complete Stripe payout onboarding before publishing paid listings."));

    renderPage();

    await fillEverything();
    fireEvent.click(getButtons("Publish now")[0]);

    expect(
      await screen.findByText(/landed on \/creator\/listings\/listing-9 with error: Connect and complete Stripe payout onboarding/),
    ).toBeInTheDocument();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});
