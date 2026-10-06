import { describe, expect, it, vi } from "vitest";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

import {
  getGifPlayOnceMs,
  LISTING_ANIMATION_MAX_BYTES,
  validateListingAnimationFile,
} from "../listingAnimatedPreview";
import { makeGif } from "./makeGif";

describe("getGifPlayOnceMs", () => {
  it("adds up the frame delays of one pass", () => {
    // Delays are stored in hundredths of a second.
    expect(getGifPlayOnceMs(makeGif([50, 50, 100]))).toBe(2000);
  });

  it("counts a delay of 0 or 1 as a tenth of a second, as browsers play it", () => {
    expect(getGifPlayOnceMs(makeGif([0, 1, 20]))).toBe(100 + 100 + 200);
  });

  it("reads past a global colour table", () => {
    expect(getGifPlayOnceMs(makeGif([30, 30], { globalColourTable: true }))).toBe(600);
  });

  it("steps over the loop block, comments and local colour tables real GIFs carry", () => {
    expect(
      getGifPlayOnceMs(
        makeGif([12, 8, 20, 4, 50], {
          globalColourTable: true,
          realWorldBlocks: true,
          localColourTables: true,
        }),
      ),
    ).toBe(940);
  });

  it("says a single-frame GIF is not an animation", () => {
    expect(getGifPlayOnceMs(makeGif([50]))).toBeNull();
  });

  it("says a file that is not a GIF is not an animation", () => {
    expect(getGifPlayOnceMs(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]))).toBeNull();
    expect(getGifPlayOnceMs(new Uint8Array())).toBeNull();
  });

  it("stops cleanly on a file that is cut short", () => {
    const whole = makeGif([50, 50, 50]);

    expect(() => getGifPlayOnceMs(whole.subarray(0, whole.length - 9))).not.toThrow();
  });
});

describe("validateListingAnimationFile", () => {
  const fileOf = (bytes: Uint8Array, name = "loop.gif") =>
    new File([bytes as BlobPart], name, { type: "image/gif" });

  it("accepts an animated GIF", async () => {
    expect(await validateListingAnimationFile(fileOf(makeGif([10, 10])))).toBeNull();
  });

  it("refuses a still GIF and a renamed file", async () => {
    expect(await validateListingAnimationFile(fileOf(makeGif([10])))).toMatch(/animated GIF/);
    expect(
      await validateListingAnimationFile(fileOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))),
    ).toMatch(/animated GIF/);
  });

  it("refuses a GIF over 8 MB", async () => {
    const big = new File([new Uint8Array(LISTING_ANIMATION_MAX_BYTES + 1)], "big.gif", {
      type: "image/gif",
    });

    expect(await validateListingAnimationFile(big)).toMatch(/over 8 MB/);
  });
});
