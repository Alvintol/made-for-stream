// Files a creator uploads with the final delivery (migration 20261016_163).
// Private bucket; the buyer can download them once nothing is owed before
// the final release. The limits mirror the bucket and
// public.create_listing_request_final_delivery_v2.

import { supabase } from "../supabaseClient";
import { createZip } from "../zip";

export const DELIVERY_FILES_BUCKET = "delivery-files";
export const DELIVERY_FILE_MAX_BYTES = 1024 ** 3; // 1 GB a file
export const DELIVERY_FILES_MAX_COUNT = 20;
export const DELIVERY_FILES_MAX_TOTAL_BYTES = 5 * 1024 ** 3; // 5 GB a delivery

export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
};

export const isZipFile = (file: { name: string }) => /\.zip$/i.test(file.name);

// Why a set of files cannot be delivered, or null when it can.
export const validateDeliveryFiles = (files: readonly File[]): string | null => {
  if (files.length > DELIVERY_FILES_MAX_COUNT) {
    return `A final delivery can contain no more than ${DELIVERY_FILES_MAX_COUNT} files. Zip them into one.`;
  }

  const tooBig = files.find((file) => file.size > DELIVERY_FILE_MAX_BYTES);

  if (tooBig) {
    return `${tooBig.name} is larger than 1 GB. Send it as a link instead.`;
  }

  if (files.reduce((sum, file) => sum + file.size, 0) > DELIVERY_FILES_MAX_TOTAL_BYTES) {
    return "The files in one final delivery can add up to 5 GB at most.";
  }

  return null;
};

// Storage keys take a limited set of characters; the name is kept readable.
export const toStorageFileName = (name: string): string => {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return clean.length > 0 ? clean.slice(-120) : "file";
};

// The name the person sees: the last part of the stored path.
export const deliveryFileName = (path: string): string => path.split("/").pop() ?? path;

// A folder from <input webkitdirectory>, or several loose files, as one zip.
// Folder paths inside the archive are kept.
export const zipFiles = async (files: readonly File[], zipName: string): Promise<File> => {
  const blob = await createZip(
    files.map((file) => ({
      name: file.webkitRelativePath || file.name,
      data: file,
      lastModified: file.lastModified,
    })),
  );

  return new File([blob], zipName.endsWith(".zip") ? zipName : `${zipName}.zip`, {
    type: "application/zip",
  });
};

// The zip's name for a folder: the folder's own name.
export const folderZipName = (files: readonly File[]): string =>
  `${(files[0]?.webkitRelativePath.split("/")[0] || "delivery").trim() || "delivery"}.zip`;

export const uploadDeliveryFile = async (input: {
  agreementId: string;
  file: File;
}): Promise<string> => {
  const path = `${input.agreementId}/${crypto.randomUUID()}/${toStorageFileName(input.file.name)}`;

  const { error } = await supabase.storage
    .from(DELIVERY_FILES_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw error;

  return path;
};

// A one-hour link that downloads the file under its own name. Refused by
// the database for a buyer while a balance is still owed.
export const getDeliveryFileDownloadUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(DELIVERY_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60, { download: deliveryFileName(path) });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("The download link could not be created.");
  }

  return data.signedUrl;
};
