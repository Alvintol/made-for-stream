// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeProductFileDetails, formatDuration } from "../../domain/listings/instantDownloads";
import { english } from "../i18n/i18n";
import { measureProductFile, summariseZipImages } from "../listings/productFileDetails";
import { createZip, readZipEntries, readZipEntry } from "../zip";

const size = (bytes: number) => `${bytes} B`;

describe("reading a zip", () => {
  it("lists each entry's sizes and unpacks it, stored or deflated", async () => {
    const zip = await createZip([
      { name: "pack/overlay.png", data: new Blob(["png-bytes"]) },
      { name: "pack/readme.txt", data: new Blob(["hello hello hello hello"]) },
    ]);

    const entries = await readZipEntries(zip);

    expect(entries?.map((entry) => [entry.name, entry.uncompressedSize])).toEqual([
      ["pack/overlay.png", 9],
      ["pack/readme.txt", 23],
    ]);

    for (const entry of entries ?? []) {
      expect(await (await readZipEntry(zip, entry))?.text()).toBe(
        entry.name.endsWith(".png") ? "png-bytes" : "hello hello hello hello",
      );
    }
  });
});

describe("measuring a file on upload", () => {
  it("counts what a zip holds and groups its images by size", async () => {
    const zip = await createZip([
      { name: "a.png", data: new Blob(["a"]) },
      { name: "b.png", data: new Blob(["bb"]) },
      { name: "c.png", data: new Blob(["ccc"]) },
      { name: "notes.txt", data: new Blob(["notes"]) },
      { name: "__MACOSX/._a.png", data: new Blob(["junk"]) },
    ]);
    const file = new File([zip], "pack.zip");
    const fakeMeasure = async (blob: Blob) =>
      (await blob.text()) === "ccc" ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };

    expect(await measureProductFile(file, fakeMeasure)).toEqual({
      kind: "zip",
      files: 4,
      unzipped_bytes: 11,
      images: [
        { width: 1920, height: 1080, count: 2 },
        { width: 1080, height: 1080, count: 1 },
      ],
    });
  });

  it("measures an image, and gives up quietly on what it can't read", async () => {
    const image = new File(["x"], "overlay.png");

    expect(await measureProductFile(image, async () => ({ width: 1920, height: 1080 }))).toEqual({
      kind: "image",
      width: 1920,
      height: 1080,
    });
    expect(await measureProductFile(image, async () => null)).toBeNull();
    expect(await measureProductFile(new File(["x"], "font.ttf"))).toBeNull();
  });

  it("keeps the three most common image sizes", () => {
    const sizes = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4].map((n) => ({ width: n, height: n }));

    expect(summariseZipImages(sizes).map((group) => group.width)).toEqual([4, 3, 2]);
  });
});

describe("describing a file", () => {
  it("says an image's and video's pixels, and a video's or sound's length", () => {
    expect(describeProductFileDetails({ kind: "image", width: 1920, height: 1080 }, english, size)).toEqual([
      "1920 × 1080 px",
    ]);
    expect(
      describeProductFileDetails({ kind: "video", width: 1280, height: 720, seconds: 75 }, english, size),
    ).toEqual(["1280 × 720 px", "1:15"]);
    expect(describeProductFileDetails({ kind: "audio", seconds: 3725 }, english, size)).toEqual(["1:02:05"]);
    expect(formatDuration(9)).toBe("0:09");
  });

  it("says what a zip holds", () => {
    expect(
      describeProductFileDetails(
        { kind: "zip", files: 24, unzipped_bytes: 512, images: [{ width: 1920, height: 1080, count: 12 }] },
        english,
        size,
      ),
    ).toEqual(["Files inside: 24 (512 B unzipped)", "Images at 1920 × 1080 px: 12"]);
  });

  it("ignores details that aren't what the website saves", () => {
    expect(describeProductFileDetails("big", english, size)).toEqual([]);
    expect(describeProductFileDetails({ kind: "image", width: "wide" }, english, size)).toEqual([]);
    expect(describeProductFileDetails(null, english, size)).toEqual([]);
  });
});
