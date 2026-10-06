import { describe, expect, it, vi } from "vitest";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

import {
  checkListingAnimationFile,
  getGifPlayOnceMs,
  getListingAnimationKind,
  getListingAnimationKindFromUrl,
  LISTING_ANIMATION_MAX_BYTES,
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

// The first bytes of real MP4 and WebM files.
const mp4Bytes = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

describe("getListingAnimationKind", () => {
  it("tells GIF, MP4 and WebM apart by their first bytes", () => {
    expect(getListingAnimationKind(makeGif([10, 10]))).toBe("gif");
    expect(getListingAnimationKind(mp4Bytes)).toBe("mp4");
    expect(getListingAnimationKind(webmBytes)).toBe("webm");
  });

  it("recognises nothing else", () => {
    expect(getListingAnimationKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBeNull();
    expect(getListingAnimationKind(new Uint8Array())).toBeNull();
  });
});

describe("getListingAnimationKindFromUrl", () => {
  const base = "https://p.supabase.co/storage/v1/object/public/listing-animations/u/";

  it("reads the kind from the stored file's extension", () => {
    expect(getListingAnimationKindFromUrl(`${base}a.mp4`)).toBe("mp4");
    expect(getListingAnimationKindFromUrl(`${base}a.WEBM?x=1`)).toBe("webm");
    expect(getListingAnimationKindFromUrl(`${base}a.gif`)).toBe("gif");
  });
});

describe("checkListingAnimationFile", () => {
  const fileOf = (bytes: Uint8Array, name: string, type: string) =>
    new File([bytes as BlobPart], name, { type });

  it("accepts an animated GIF, an MP4 and a WebM", async () => {
    expect(await checkListingAnimationFile(fileOf(makeGif([10, 10]), "a.gif", "image/gif"))).toEqual({
      kind: "gif",
      error: null,
    });
    expect(await checkListingAnimationFile(fileOf(mp4Bytes, "a.mp4", "video/mp4"))).toEqual({
      kind: "mp4",
      error: null,
    });
    expect(await checkListingAnimationFile(fileOf(webmBytes, "a.webm", "video/webm"))).toEqual({
      kind: "webm",
      error: null,
    });
  });

  it("goes by what the file is, not what it is called", async () => {
    // An MP4 renamed to .gif is still uploaded and played as a video.
    expect(await checkListingAnimationFile(fileOf(mp4Bytes, "a.gif", "image/gif"))).toEqual({
      kind: "mp4",
      error: null,
    });
  });

  it("refuses a GIF that does not move", async () => {
    const check = await checkListingAnimationFile(fileOf(makeGif([10]), "a.gif", "image/gif"));

    expect(check.error).toMatch(/does not move/);
  });

  it("refuses any other kind of file", async () => {
    const check = await checkListingAnimationFile(
      fileOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), "a.mp4", "video/mp4"),
    );

    expect(check.error).toMatch(/animated GIF, or an MP4 or WebM video/);
  });

  it("refuses a file over 8 MB", async () => {
    const big = new File([new Uint8Array(LISTING_ANIMATION_MAX_BYTES + 1)], "big.mp4", {
      type: "video/mp4",
    });

    expect((await checkListingAnimationFile(big)).error).toMatch(/over 8 MB/);
  });
});
