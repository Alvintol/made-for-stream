import { supabase } from "../supabaseClient";

// Listing thumbnails are processed in the browser before upload: shrunk,
// optionally watermarked, and re-saved. Only that copy is uploaded, so the
// creator's original never reaches our storage and cannot be pulled off the
// page. Re-saving also drops hidden data such as a phone's location.
// The bucket and the database rule are in
// supabase/migrations/20261006_143_add_listing_preview_uploads.sql.

export const LISTING_PREVIEW_BUCKET = "listing-previews";
export const LISTING_PREVIEW_MAX_EDGE = 1200;
// What the creator may pick. The uploaded copy is far smaller.
export const LISTING_PREVIEW_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const LISTING_PREVIEW_ACCEPT = "image/jpeg,image/png,image/webp";

const ACCEPTED_TYPES = new Set(LISTING_PREVIEW_ACCEPT.split(","));

export const validateListingPreviewSource = (file: {
  type: string;
  size: number;
}): string | null =>
  !ACCEPTED_TYPES.has(file.type)
    ? "Choose a JPEG, PNG or WebP image."
    : file.size > LISTING_PREVIEW_MAX_SOURCE_BYTES
      ? "That image is over 20 MB. Choose a smaller one."
      : null;

// Fits the image inside a square of maxEdge, never enlarging it.
export const getListingPreviewSize = (
  width: number,
  height: number,
  maxEdge = LISTING_PREVIEW_MAX_EDGE,
): { width: number; height: number } => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const getListingPreviewWatermarkText = (handle?: string | null): string => {
  const cleanHandle = handle?.trim().replace(/^@/, "");

  return cleanHandle ? `Made for Stream · @${cleanHandle}` : "Made for Stream";
};

// Repeats the text diagonally across the whole image, so it cannot be
// cropped away, in a faint grey with a faint dark edge so it reads on both
// light and dark artwork.
const drawWatermark = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
) => {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 22));

  context.save();
  context.font = `600 ${fontSize}px sans-serif`;
  context.fillStyle = "rgba(160, 160, 160, 0.32)";
  context.strokeStyle = "rgba(0, 0, 0, 0.10)";
  context.lineWidth = 1;
  context.textBaseline = "middle";
  context.translate(width / 2, height / 2);
  context.rotate(-Math.PI / 6);

  const stepX = context.measureText(text).width + fontSize * 3;
  const stepY = fontSize * 5;
  const reach = Math.hypot(width, height);

  for (let y = -reach, row = 0; y <= reach; y += stepY, row += 1) {
    // Offset alternate rows so the marks do not line up into clear lanes.
    for (let x = -reach - (row % 2) * (stepX / 2); x <= reach; x += stepX) {
      context.strokeText(text, x, y);
      context.fillText(text, x, y);
    }
  }

  context.restore();
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Returns the copy to upload. `watermarkText` null means no watermark.
export const renderListingPreviewImage = async (
  file: Blob,
  { watermarkText }: { watermarkText: string | null },
): Promise<Blob> => {
  // from-image applies the photo's own rotation, which is otherwise lost
  // when the hidden data is dropped.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    const { width, height } = getListingPreviewSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("This browser could not prepare the image.");
    }

    context.drawImage(bitmap, 0, 0, width, height);

    if (watermarkText) {
      drawWatermark(context, width, height, watermarkText);
    }

    // Safari cannot write WebP and silently hands back a PNG, so fall back
    // to JPEG when the result is not what was asked for.
    const webp = await canvasToBlob(canvas, "image/webp", 0.86);
    const blob =
      webp?.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/jpeg", 0.88);

    if (!blob) {
      throw new Error("This browser could not prepare the image.");
    }

    return blob;
  } finally {
    bitmap.close();
  }
};

// Uploads the prepared copy into the creator's own folder and returns its
// public address, which is what listings.preview_url stores.
export const uploadListingPreviewImage = async ({
  userId,
  blob,
}: {
  userId: string;
  blob: Blob;
}): Promise<string> => {
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(LISTING_PREVIEW_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });

  if (error) {
    throw error;
  }

  return supabase.storage.from(LISTING_PREVIEW_BUCKET).getPublicUrl(path).data.publicUrl;
};
