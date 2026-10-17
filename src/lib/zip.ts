// Builds a .zip in the browser, so a creator can upload a folder (or a
// handful of files) as one file. Compression uses the browser's own
// CompressionStream; files that are already compressed (images, video,
// audio, archives) are stored as they are, because deflating them again
// costs time and saves nothing.
//
// ponytail: every file is read into memory and there is no zip64, so the
// archive must stay under 4 GB (the delivery cap is 1 GB). Stream the
// entries if creators need bigger folders zipped here.

export type ZipEntry = {
  // The path inside the archive, with "/" between folders.
  name: string;
  data: Blob;
  lastModified?: number;
};

const alreadyCompressed = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "heic",
  "mp4", "m4v", "mov", "webm", "mkv", "avi",
  "mp3", "m4a", "aac", "ogg", "opus", "flac",
  "zip", "7z", "rar", "gz", "tgz", "bz2", "xz",
]);

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }

  return table;
})();

export const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const deflate = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));

  return new Uint8Array(await new Response(stream).arrayBuffer());
};

// MS-DOS date and time, as zip stores them.
const dosDateTime = (time: number) => {
  const date = new Date(time);
  const year = Math.max(date.getFullYear(), 1980);

  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
};

const shouldCompress = (name: string) =>
  typeof CompressionStream !== "undefined" &&
  !alreadyCompressed.has(name.split(".").pop()?.toLowerCase() ?? "");

export const createZip = async (entries: ZipEntry[]): Promise<Blob> => {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name.replace(/\\/g, "/"));
    const raw = new Uint8Array(await entry.data.arrayBuffer());
    const crc = crc32(raw);

    let method = 0;
    let stored: Uint8Array = raw;

    if (shouldCompress(entry.name)) {
      const compressed = await deflate(raw);

      if (compressed.length < raw.length) {
        method = 8;
        stored = compressed;
      }
    }

    const { time, date } = dosDateTime(entry.lastModified ?? Date.now());

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names are UTF-8
    local.setUint16(8, method, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, stored.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, method, true);
    header.setUint16(12, time, true);
    header.setUint16(14, date, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, stored.length, true);
    header.setUint32(24, raw.length, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);

    parts.push(local.buffer, name as BlobPart, stored as BlobPart);
    central.push(new Uint8Array(header.buffer), name);
    offset += 30 + name.length + stored.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...(central as BlobPart[]), end.buffer], {
    type: "application/zip",
  });
};

export type ZipListing = {
  names: string[];
  // A password-protected entry: its name is readable, its contents are not.
  encrypted: boolean;
};

// The paths inside a zip, read from its central directory at the end of
// the file, without unpacking anything. Null when the file is not a zip
// this can read (damaged, or a zip64 archive).
export const listZipEntryNames = async (blob: Blob): Promise<ZipListing | null> => {
  const tailStart = Math.max(0, blob.size - (22 + 0xffff));
  const tail = new Uint8Array(await blob.slice(tailStart).arrayBuffer());
  const tailView = new DataView(tail.buffer);

  let end = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }

  if (end < 0) return null;

  const count = tailView.getUint16(end + 10, true);
  const size = tailView.getUint32(end + 12, true);
  const offset = tailView.getUint32(end + 16, true);

  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff || offset + size > blob.size) {
    return null;
  }

  const directory = new Uint8Array(await blob.slice(offset, offset + size).arrayBuffer());
  const view = new DataView(directory.buffer);
  const decoder = new TextDecoder();
  const names: string[] = [];
  let encrypted = false;
  let at = 0;

  for (let i = 0; i < count; i += 1) {
    if (at + 46 > directory.length || view.getUint32(at, true) !== 0x02014b50) return null;

    const flags = view.getUint16(at + 8, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);

    encrypted ||= (flags & 1) === 1;
    names.push(decoder.decode(directory.slice(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength + extraLength + commentLength;
  }

  return { names, encrypted };
};
