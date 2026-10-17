// @vitest-environment node
import { describe, expect, it } from "vitest";

import { crc32, createZip, listZipEntryNames } from "../zip";

const text = (value: string) => new TextEncoder().encode(value);

// Reads the archive back the way an unzip tool does: from the central
// directory at the end.
const readZip = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;

  expect(view.getUint32(end, true)).toBe(0x06054b50);

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = [];

  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);

    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const storedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const localAt = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameLength));

    const localNameLength = view.getUint16(localAt + 26, true);
    const dataAt = localAt + 30 + localNameLength;
    const stored = bytes.slice(dataAt, dataAt + storedSize);

    const data =
      method === 8
        ? new Uint8Array(
            await new Response(
              new Blob([stored]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
            ).arrayBuffer(),
          )
        : stored;

    entries.push({ name, method, crc, data });
    at += 46 + nameLength;
  }

  return entries;
};

describe("zip", () => {
  it("computes the standard checksum", () => {
    expect(crc32(text("hello"))).toBe(0x3610a686);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("keeps folders and contents, compressing only what shrinks", async () => {
    const source = "layer data ".repeat(500);
    const zip = await createZip([
      { name: "Emote Pack/source.psd", data: new Blob([text(source)]) },
      { name: "Emote Pack/sizes/112.png", data: new Blob([text("png bytes")]) },
    ]);

    const entries = await readZip(zip);

    expect(entries.map((entry) => entry.name)).toEqual([
      "Emote Pack/source.psd",
      "Emote Pack/sizes/112.png",
    ]);
    expect(entries[0].method).toBe(8);
    expect(new TextDecoder().decode(entries[0].data)).toBe(source);
    expect(entries[0].crc).toBe(crc32(text(source)));
    // An image is stored as it is.
    expect(entries[1].method).toBe(0);
    expect(new TextDecoder().decode(entries[1].data)).toBe("png bytes");
    expect(zip.size).toBeLessThan(source.length);
  });
});

describe("reading the names inside a zip", () => {
  it("lists every path without unpacking", async () => {
    const zip = await createZip([
      { name: "Pack/emote.png", data: new Blob([text("a")]) },
      { name: "Pack/tools/setup.exe", data: new Blob([text("b")]) },
    ]);

    expect(await listZipEntryNames(zip)).toEqual({
      names: ["Pack/emote.png", "Pack/tools/setup.exe"],
      encrypted: false,
    });
  });

  it("gives up on something that is not a zip", async () => {
    expect(await listZipEntryNames(new Blob([text("not a zip at all")]))).toBeNull();
  });
});
