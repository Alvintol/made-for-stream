import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

import ListingAnimatedPreview from "../listings/ListingAnimatedPreview";
import { makeGif } from "../../lib/listings/tests/makeGif";

const COVER = "https://example.com/cover.webp";
const ANIMATION = "https://project.supabase.co/storage/v1/object/public/listing-animations/u/a.gif";

// One pass of this GIF takes 2 seconds.
const gif = makeGif([100, 100]);

const renderPreview = () =>
  render(<ListingAnimatedPreview coverUrl={COVER} animationUrl={ANIMATION} className="img" />);

const picture = () => document.querySelector("img") as HTMLImageElement;

// Lets the mocked download and its promise chain finish.
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe("<ListingAnimatedPreview />", () => {
  let reducedMotion = false;
  let nextBlobUrl = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotion = false;
    nextBlobUrl = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => gif.buffer })),
    );
    window.matchMedia = vi.fn(() => ({ matches: reducedMotion })) as never;
    URL.createObjectURL = vi.fn(() => `blob:play-${(nextBlobUrl += 1)}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the still cover first, never the GIF's real address", async () => {
    renderPreview();

    expect(picture()).toHaveAttribute("src", COVER);

    await settle();

    expect(picture().getAttribute("src")).toBe("blob:play-1");
    expect(document.body.innerHTML).not.toContain(ANIMATION);
  });

  it("plays once, then returns to the cover and offers Play again", async () => {
    renderPreview();
    await settle();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(picture()).toHaveAttribute("src", "blob:play-1");

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(picture()).toHaveAttribute("src", COVER);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:play-1");

    // A fresh address restarts the GIF from its first frame.
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(picture()).toHaveAttribute("src", "blob:play-2");
  });

  it("waits for a click when the visitor asks for less motion", async () => {
    reducedMotion = true;

    renderPreview();
    await settle();

    expect(picture()).toHaveAttribute("src", COVER);

    fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
    expect(picture()).toHaveAttribute("src", "blob:play-1");
  });

  it("blocks right-click and dragging on the picture", async () => {
    renderPreview();
    await settle();

    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    picture().dispatchEvent(menu);

    expect(menu.defaultPrevented).toBe(true);
    expect(picture()).toHaveAttribute("draggable", "false");
  });

  describe("with a video", () => {
    const VIDEO = ANIMATION.replace("a.gif", "a.mp4");

    const renderVideo = () =>
      render(<ListingAnimatedPreview coverUrl={COVER} animationUrl={VIDEO} className="img" />);

    const video = () => document.querySelector("video") as HTMLVideoElement | null;

    it("plays it muted from a temporary address, with saving controls off", async () => {
      renderVideo();
      await settle();

      expect(video()).toHaveAttribute("src", "blob:play-1");
      expect(video()?.muted).toBe(true);
      expect(video()).toHaveAttribute("controlslist", "nodownload noplaybackrate");
      expect(video()).not.toHaveAttribute("controls");
      expect(document.body.innerHTML).not.toContain(VIDEO);
    });

    it("returns to the cover when the video ends, and offers Play again", async () => {
      renderVideo();
      await settle();

      // No timer is involved: a long wait changes nothing.
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(video()).not.toBeNull();

      fireEvent.ended(video() as HTMLVideoElement);

      expect(video()).toBeNull();
      expect(picture()).toHaveAttribute("src", COVER);

      fireEvent.click(screen.getByRole("button", { name: "Play again" }));
      expect(video()).toHaveAttribute("src", "blob:play-2");
    });

    it("keeps the cover and offers nothing when this browser cannot play the format", async () => {
      renderVideo();
      await settle();

      fireEvent.error(video() as HTMLVideoElement);

      expect(video()).toBeNull();
      expect(picture()).toHaveAttribute("src", COVER);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("just keeps the cover when the GIF cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    renderPreview();
    await settle();

    expect(picture()).toHaveAttribute("src", COVER);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
