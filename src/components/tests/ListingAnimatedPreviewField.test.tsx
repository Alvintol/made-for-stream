import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

import ListingAnimatedPreviewField from "../listings/ListingAnimatedPreviewField";
import { makeGif } from "../../lib/listings/tests/makeGif";

const gifFile = (delays: number[]) =>
  new File([makeGif(delays) as BlobPart], "loop.gif", { type: "image/gif" });

const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText("Animated preview (optional)"), {
    target: { files: [file] },
  });

describe("<ListingAnimatedPreviewField />", () => {
  it("warns that animated previews are not copy-protected", () => {
    render(<ListingAnimatedPreviewField hasExisting={false} onChange={vi.fn()} />);

    expect(screen.getByText("Animated previews are not copy-protected")).toBeInTheDocument();
    expect(screen.getByText(/not shrunk and not watermarked/i)).toBeInTheDocument();
    expect(screen.getByText(/Never upload the finished work/i)).toBeInTheDocument();
  });

  it("accepts an animated GIF and hands it to the page", async () => {
    const onChange = vi.fn();
    const file = gifFile([10, 10]);

    render(<ListingAnimatedPreviewField hasExisting={false} onChange={onChange} />);
    choose(file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ action: "upload", file }));
    expect(screen.getByRole("status")).toHaveTextContent("Ready to upload when you save: loop.gif");
  });

  it("refuses a GIF that does not move", async () => {
    const onChange = vi.fn();

    render(<ListingAnimatedPreviewField hasExisting={false} onChange={onChange} />);
    choose(gifFile([10]));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose an animated GIF");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lets the creator remove an existing animated preview, and change their mind", () => {
    const onChange = vi.fn();

    render(<ListingAnimatedPreviewField hasExisting onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Remove the animated preview"));
    expect(onChange).toHaveBeenLastCalledWith({ action: "remove" });

    fireEvent.click(screen.getByLabelText("Remove the animated preview"));
    expect(onChange).toHaveBeenLastCalledWith({ action: "keep" });
  });
});
