import { supabase } from "../supabaseClient";

// A listing's optional animated preview: a GIF or a short video shown on the
// listing's own page, where it plays once. Unlike the static image
// (listingPreviewImage.ts) it is uploaded exactly as the creator made it,
// because a browser cannot re-save an animation. The bucket and database
// rule are in supabase/migrations/20261006_144_add_listing_animated_previews.sql
// and 20261006_145_allow_video_listing_previews.sql.

export const LISTING_ANIMATION_BUCKET = "listing-animations";
export const LISTING_ANIMATION_MAX_BYTES = 8 * 1024 * 1024;
export const LISTING_ANIMATION_ACCEPT = "image/gif,video/mp4,video/webm";

export type ListingAnimationKind = "gif" | "mp4" | "webm";

export const LISTING_ANIMATION_CONTENT_TYPES: Record<ListingAnimationKind, string> = {
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

// What a file really is, from its first bytes, whatever it is named.
export const getListingAnimationKind = (bytes: Uint8Array): ListingAnimationKind | null => {
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));

  return text(0, 4) === "GIF8"
    ? "gif"
    : text(4, 8) === "ftyp"
      ? "mp4"
      : bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
        ? "webm"
        : null;
};

// Which kind a stored preview is, from the address we gave it at upload.
export const getListingAnimationKindFromUrl = (url: string): ListingAnimationKind => {
  const path = url.split(/[?#]/)[0].toLowerCase();

  return path.endsWith(".mp4") ? "mp4" : path.endsWith(".webm") ? "webm" : "gif";
};

// How long one pass through an animated GIF takes, in milliseconds, read
// from the file's own frame delays. Null when the bytes are not a GIF or
// the GIF has a single frame (nothing to play).
export const getGifPlayOnceMs = (bytes: Uint8Array): number | null => {
  const signature = String.fromCharCode(...bytes.subarray(0, 6));

  if (signature !== "GIF87a" && signature !== "GIF89a") {
    return null;
  }

  const colourTableBytes = (packed: number) =>
    packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0;

  // Header (6) + logical screen descriptor (7), then the global colour table.
  let position = 13 + colourTableBytes(bytes[10]);
  let frames = 0;
  let totalCentiseconds = 0;
  let nextDelay = 0;

  const skipSubBlocks = () => {
    while (position < bytes.length) {
      const size = bytes[position];

      position += 1;

      if (size === 0) return;

      position += size;
    }
  };

  while (position < bytes.length) {
    const block = bytes[position];

    position += 1;

    if (block === 0x21) {
      const label = bytes[position];

      position += 1;

      // Graphic control extension: the delay for the frame that follows.
      if (label === 0xf9) {
        nextDelay = bytes[position + 2] | (bytes[position + 3] << 8);
      }

      skipSubBlocks();
    } else if (block === 0x2c) {
      // Image descriptor (9 bytes), optional local colour table, LZW size.
      position += 9 + colourTableBytes(bytes[position + 8]) + 1;
      skipSubBlocks();

      frames += 1;
      // Browsers play a delay of 0 or 1 as a tenth of a second.
      totalCentiseconds += nextDelay <= 1 ? 10 : nextDelay;
      nextDelay = 0;
    } else {
      // The trailer (0x3B), or bytes we do not understand: stop either way.
      break;
    }
  }

  return frames > 1 ? totalCentiseconds * 10 : null;
};

export type ListingAnimationCheck =
  | { kind: ListingAnimationKind; error: null }
  | { kind: null; error: string };

// Says what the file is, or what to tell the creator if it cannot be used.
export const checkListingAnimationFile = async (file: File): Promise<ListingAnimationCheck> => {
  if (file.size > LISTING_ANIMATION_MAX_BYTES) {
    return { kind: null, error: "That file is over 8 MB. Use a shorter or smaller clip." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = getListingAnimationKind(bytes);

  if (kind === null) {
    return { kind: null, error: "Choose an animated GIF, or an MP4 or WebM video." };
  }

  if (kind === "gif" && getGifPlayOnceMs(bytes) === null) {
    return { kind: null, error: "That GIF does not move. Choose an animated one." };
  }

  return { kind, error: null };
};

// Uploads the file into the creator's own folder and returns its public
// address, which is what listings.animated_preview_url stores. The file
// extension records the kind, which is how the listing page knows whether to
// play it as a GIF or a video.
export const uploadListingAnimation = async ({
  userId,
  file,
  kind,
}: {
  userId: string;
  file: Blob;
  kind: ListingAnimationKind;
}): Promise<string> => {
  const path = `${userId}/${crypto.randomUUID()}.${kind}`;

  const { error } = await supabase.storage.from(LISTING_ANIMATION_BUCKET).upload(path, file, {
    contentType: LISTING_ANIMATION_CONTENT_TYPES[kind],
    cacheControl: "31536000",
  });

  if (error) {
    throw error;
  }

  return supabase.storage.from(LISTING_ANIMATION_BUCKET).getPublicUrl(path).data.publicUrl;
};
