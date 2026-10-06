import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock("../../lib/listings/listingPreviewImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/listings/listingPreviewImage")>()),
  renderListingPreviewImage: mocks.render,
}));

vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

import ListingPreviewImageField from "../listings/ListingPreviewImageField";

const prepared = new Blob(["prepared"], { type: "image/webp" });

const chooseFile = (file: File) =>
  fireEvent.change(screen.getByLabelText("Preview image"), { target: { files: [file] } });

const png = () => new File(["x"], "art.png", { type: "image/png" });

describe("<ListingPreviewImageField />", () => {
  beforeEach(() => {
    mocks.render.mockReset().mockResolvedValue(prepared);
    URL.createObjectURL = vi.fn(() => "blob:prepared");
    URL.revokeObjectURL = vi.fn();
  });

  it("prepares a watermarked copy naming the site and the creator by default", async () => {
    const onChange = vi.fn();

    render(<ListingPreviewImageField existingUrl={null} handle="PizzaButt" onChange={onChange} />);

    chooseFile(png());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ blob: prepared, watermarked: true }));
    expect(mocks.render).toHaveBeenCalledWith(expect.any(File), {
      watermarkText: "Made for Stream · @PizzaButt",
    });
    expect(screen.getByAltText("Your preview image as buyers will see it")).toHaveAttribute(
      "src",
      "blob:prepared",
    );
  });

  it("prepares the copy again without the watermark when the option is switched off", async () => {
    const onChange = vi.fn();

    render(<ListingPreviewImageField existingUrl={null} handle="PizzaButt" onChange={onChange} />);

    chooseFile(png());
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("Add a watermark"));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ blob: prepared, watermarked: false }),
    );
    expect(mocks.render).toHaveBeenLastCalledWith(expect.any(File), { watermarkText: null });
  });

  it("refuses a file that is not an image, without preparing anything", () => {
    const onChange = vi.fn();

    render(<ListingPreviewImageField existingUrl={null} handle="PizzaButt" onChange={onChange} />);

    chooseFile(new File(["x"], "notes.pdf", { type: "application/pdf" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG, PNG or WebP image.");
    expect(mocks.render).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the listing's current image until a new one is chosen", () => {
    render(
      <ListingPreviewImageField
        existingUrl="https://example.com/old.jpg"
        handle="PizzaButt"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Current preview image")).toHaveAttribute(
      "src",
      "https://example.com/old.jpg",
    );
  });

  it("says so when the image cannot be read", async () => {
    mocks.render.mockRejectedValue(new Error("decode failed"));

    const onChange = vi.fn();

    render(<ListingPreviewImageField existingUrl={null} handle="PizzaButt" onChange={onChange} />);

    chooseFile(png());

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be read");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
