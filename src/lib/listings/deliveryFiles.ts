// Files a creator uploads with the final delivery (migrations 20261016_163
// and 164). Private bucket; the buyer can download them once nothing is
// owed before the final release. The limits mirror the bucket and
// public.create_listing_request_final_delivery_v2; the per-commission limit
// comes from the database (get_commission_storage_usage).

import { supabase } from "../supabaseClient";
import { createZip } from "../zip";

export const DELIVERY_FILES_BUCKET = "delivery-files";
export const DELIVERY_FILE_MAX_BYTES = 2 * 1024 ** 3; // 2 GB a file
export const DELIVERY_FILES_MAX_COUNT = 50;
export const DELIVERY_FILES_MAX_TOTAL_BYTES = 10 * 1024 ** 3; // 10 GB a delivery
// Zipping happens in the browser's memory; bigger folders are zipped on the
// computer instead.
export const FOLDER_ZIP_MAX_BYTES = 2 * 1024 ** 3;

export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
};

export const isZipFile = (file: { name: string }) => /\.zip$/i.test(file.name);

// Why a set of files cannot be delivered, or null when it can.
// remainingBytes is what is left of the commission's storage, when known.
export const validateDeliveryFiles = (
  files: readonly File[],
  remainingBytes?: number | null,
): string | null => {
  if (files.length > DELIVERY_FILES_MAX_COUNT) {
    return `A final delivery can contain no more than ${DELIVERY_FILES_MAX_COUNT} files. Zip them into one.`;
  }

  const tooBig = files.find((file) => file.size > DELIVERY_FILE_MAX_BYTES);

  if (tooBig) {
    return `${tooBig.name} is larger than 2 GB. Send it as a link instead.`;
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);

  if (total > DELIVERY_FILES_MAX_TOTAL_BYTES) {
    return "The files in one final delivery can add up to 10 GB at most.";
  }

  if (remainingBytes != null && total > remainingBytes) {
    return `This commission has ${formatFileSize(Math.max(0, remainingBytes))} of storage left. Remove a file, or send the largest as a link.`;
  }

  return null;
};

// Storage keys take a limited set of characters, so a name keeps only
// letters, digits, ".", "-" and "_", with spaces turned into underscores:
// "meowington 222222222 updated deliverables.zip" becomes
// "meowington_222222222_updated_deliverables.zip".
export const toStorageFileName = (name: string): string => {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return clean.length > 0 ? clean.slice(-120) : "file";
};

// The stored name: the clean name with a unique id before the extension
// ("pack_3f9a1c2b7d4e.zip"), so two files with the same name never meet in
// storage.
export const toUniqueStorageFileName = (
  name: string,
  id: string = crypto.randomUUID().replace(/-/g, "").slice(0, 12),
): string => {
  const clean = toStorageFileName(name);
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const extension = dot > 0 ? clean.slice(dot) : "";

  return `${base.slice(0, 100)}_${id}${extension}`;
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
  `${((files[0]?.webkitRelativePath ?? "").split("/")[0] || "delivery").trim() || "delivery"}.zip`;

export const uploadDeliveryFile = async (input: {
  agreementId: string;
  file: File;
}): Promise<string> => {
  const path = `${input.agreementId}/${toUniqueStorageFileName(input.file.name)}`;

  const { error } = await supabase.storage
    .from(DELIVERY_FILES_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw error;

  return path;
};

// Records the download, then makes a one-hour link that downloads the file
// under its own name. Both are refused by the database for a buyer while a
// balance is still owed.
export const getDeliveryFileDownloadUrl = async (path: string): Promise<string> => {
  const { error: recordError } = await supabase.rpc("record_delivery_file_download", {
    p_path: path,
  });

  if (recordError) throw recordError;

  const { data, error } = await supabase.storage
    .from(DELIVERY_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60, { download: deliveryFileName(path) });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("The download link could not be created.");
  }

  return data.signedUrl;
};
