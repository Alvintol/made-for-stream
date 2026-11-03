// What an instant download's file is, measured in the browser as it's
// uploaded and saved as the file's metadata (20261103_183): an image's or
// video's size in pixels, a video's or sound's length, and what a zip holds.
// Buyers see it before they buy. A file that can't be measured just has no
// details; measuring never stops an upload.

import { isSystemJunkFile } from "../../domain/listings/deliveryFileTypes";
import type { ProductFileDetails } from "../../domain/listings/instantDownloads";
import { readZipEntries, readZipEntry } from "../zip";

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
const VIDEO = /\.(mp4|mov|webm|mkv|m4v)$/i;
const AUDIO = /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i;

// ponytail: up to 50 images in a zip, each under 40 MB unzipped, are opened.
// Raise these if packs get bigger.
const ZIP_IMAGE_LIMIT = 50;
const ZIP_IMAGE_MAX_BYTES = 40 * 1024 ** 2;
const MEASURE_TIMEOUT_MS = 15_000;

const withTimeout = <T>(work: Promise<T>): Promise<T | null> =>
  Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS))]);

export const measureImage = async (blob: Blob): Promise<{ width: number; height: number } | null> => {
  const bitmap = await createImageBitmap(blob).catch(() => null);

  if (!bitmap) return null;

  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();

  return size;
};

const measureMedia = (file: Blob, tag: "video" | "audio") =>
  new Promise<{ width: number; height: number; seconds: number } | null>((resolve) => {
    const element = document.createElement(tag);
    const url = URL.createObjectURL(file);
    const done = (value: { width: number; height: number; seconds: number } | null) => {
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
      resolve(value);
    };

    element.preload = "metadata";
    element.onloadedmetadata = () =>
      done({
        width: element instanceof HTMLVideoElement ? element.videoWidth : 0,
        height: element instanceof HTMLVideoElement ? element.videoHeight : 0,
        seconds: Number.isFinite(element.duration) ? Math.round(element.duration) : 0,
      });
    element.onerror = () => done(null);
    element.src = url;
  });

// Images in a zip grouped by size, largest group first, at most three.
export const summariseZipImages = (sizes: Array<{ width: number; height: number }>) => {
  const groups = new Map<string, { width: number; height: number; count: number }>();

  sizes.forEach(({ width, height }) => {
    const key = `${width}x${height}`;
    const group = groups.get(key) ?? { width, height, count: 0 };

    group.count += 1;
    groups.set(key, group);
  });

  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 3);
};

const measureZip = async (
  file: Blob,
  measure: (blob: Blob) => Promise<{ width: number; height: number } | null>,
): Promise<ProductFileDetails | null> => {
  const entries = await readZipEntries(file);

  if (!entries) return null;

  const files = entries.filter((entry) => !entry.name.endsWith("/") && !isSystemJunkFile(entry.name));
  const sizes: Array<{ width: number; height: number }> = [];

  for (const entry of files
    .filter((item) => IMAGE.test(item.name) && item.uncompressedSize <= ZIP_IMAGE_MAX_BYTES)
    .slice(0, ZIP_IMAGE_LIMIT)) {
    const data = await readZipEntry(file, entry).catch(() => null);
    const size = data ? await measure(data) : null;

    if (size) sizes.push(size);
  }

  return {
    kind: "zip",
    files: files.length,
    unzipped_bytes: files.reduce((total, entry) => total + entry.uncompressedSize, 0),
    ...(sizes.length > 0 ? { images: summariseZipImages(sizes) } : {}),
  };
};

export const measureProductFile = async (
  file: File,
  measure: (blob: Blob) => Promise<{ width: number; height: number } | null> = measureImage,
): Promise<ProductFileDetails | null> => {
  try {
    if (IMAGE.test(file.name)) {
      const size = await withTimeout(measure(file));

      return size ? { kind: "image", ...size } : null;
    }

    if (VIDEO.test(file.name)) {
      const video = await withTimeout(measureMedia(file, "video"));

      return video && video.width > 0 ? { kind: "video", ...video } : null;
    }

    if (AUDIO.test(file.name)) {
      const audio = await withTimeout(measureMedia(file, "audio"));

      return audio && audio.seconds > 0 ? { kind: "audio", seconds: audio.seconds } : null;
    }

    if (/\.zip$/i.test(file.name)) {
      return await withTimeout(measureZip(file, measure));
    }
  } catch {
    return null;
  }

  return null;
};
