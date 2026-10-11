import { supabase } from "../supabaseClient";

// Preview images on a milestone submission. Each one is prepared in the
// creator's browser exactly like a listing thumbnail (listingPreviewImage.ts:
// shrunk, watermarked, re-saved), except the watermark is always on, and only
// that copy is uploaded. Unlike thumbnails the bucket is private: the files
// are read through short-lived signed addresses, by the creator, the buyer
// and admins only. The bucket and its rules are in
// supabase/migrations/20261011_154_add_milestone_preview_images.sql.

export const MILESTONE_PREVIEW_BUCKET = "milestone-previews";
export const MILESTONE_PREVIEW_MAX_IMAGES = 6;

const SIGNED_URL_SECONDS = 60 * 60;

// Uploads one prepared copy into the milestone's folder and returns its
// path, which is what the submission stores.
export const uploadMilestonePreviewImage = async ({
  milestoneId,
  blob,
}: {
  milestoneId: string;
  blob: Blob;
}): Promise<string> => {
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${milestoneId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(MILESTONE_PREVIEW_BUCKET)
    .upload(path, blob, { contentType: blob.type });

  if (error) {
    throw error;
  }

  return path;
};

// Temporary addresses for a submission's images, in the same order. A file
// the viewer may not read is left out.
export const getMilestonePreviewImageUrls = async (paths: string[]): Promise<string[]> => {
  const { data, error } = await supabase.storage
    .from(MILESTONE_PREVIEW_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);

  if (error) {
    throw error;
  }

  return data.flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));
};
