import { supabase } from "../supabaseClient";

// A listing's optional animated preview: a GIF shown on the listing's own
// page, where it plays once. Unlike the static image
// (listingPreviewImage.ts) it is uploaded exactly as the creator made it,
// because a browser cannot re-save an animation. The bucket and database
// rule are in supabase/migrations/20261006_144_add_listing_animated_previews.sql.

export const LISTING_ANIMATION_BUCKET = "listing-animations";
export const LISTING_ANIMATION_MAX_BYTES = 8 * 1024 * 1024;

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

// Null when the file can be used; otherwise what to tell the creator.
export const validateListingAnimationFile = async (file: File): Promise<string | null> => {
  if (file.size > LISTING_ANIMATION_MAX_BYTES) {
    return "That GIF is over 8 MB. Use a shorter or smaller loop.";
  }

  const playOnceMs = getGifPlayOnceMs(new Uint8Array(await file.arrayBuffer()));

  return playOnceMs === null ? "Choose an animated GIF. That file is not one." : null;
};

// Uploads the GIF into the creator's own folder and returns its public
// address, which is what listings.animated_preview_url stores.
export const uploadListingAnimation = async ({
  userId,
  file,
}: {
  userId: string;
  file: Blob;
}): Promise<string> => {
  const path = `${userId}/${crypto.randomUUID()}.gif`;

  const { error } = await supabase.storage
    .from(LISTING_ANIMATION_BUCKET)
    .upload(path, file, { contentType: "image/gif", cacheControl: "31536000" });

  if (error) {
    throw error;
  }

  return supabase.storage.from(LISTING_ANIMATION_BUCKET).getPublicUrl(path).data.publicUrl;
};
