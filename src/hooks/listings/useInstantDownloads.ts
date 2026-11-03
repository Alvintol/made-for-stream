import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PRODUCT_FILES_BUCKET,
  productFileDisplayName,
  type DownloadItem,
  type InstantListingState,
  type ProductFile,
} from "../../domain/listings/instantDownloads";
import { toUniqueStorageFileName } from "../../lib/listings/deliveryFiles";
import { measureProductFile } from "../../lib/listings/productFileDetails";
import { supabase } from "../../lib/supabaseClient";

// What's included, and whether the viewer owns it or has a payment waiting.
export const useInstantListing = (listingId: string | null | undefined, userId: string | null) =>
  useQuery({
    queryKey: ["instantListing", listingId, userId],
    enabled: Boolean(listingId),
    queryFn: async (): Promise<InstantListingState> => {
      const { data, error } = await supabase.rpc("get_instant_listing", { p_listing_id: listingId });

      if (error) throw error;

      return data as InstantListingState;
    },
  });

// Starts or reuses the buyer's purchase. The database refuses anything not
// for sale, an item already owned, or a creator who can't be paid.
export const useStartInstantPurchase = () =>
  useMutation({
    mutationFn: async (listingId: string): Promise<{ listing_request_id: string; payment_id: string }> => {
      const { data, error } = await supabase.rpc("start_instant_purchase", { p_listing_id: listingId });

      if (error) throw error;

      return data as { listing_request_id: string; payment_id: string };
    },
  });

export const useMyDownloads = () =>
  useQuery({
    queryKey: ["myDownloads"],
    queryFn: async (): Promise<DownloadItem[]> => {
      const { data, error } = await supabase.rpc("my_downloads");

      if (error) throw error;

      return data as DownloadItem[];
    },
  });

// Records the download for the buyer, then makes a one-minute link that
// downloads the file under its own name. Refused for anyone who hasn't paid.
export const getProductFileDownloadUrl = async (path: string): Promise<string> => {
  const { error: recordError } = await supabase.rpc("record_product_file_download", { p_path: path });

  if (recordError) throw recordError;

  const { data, error } = await supabase.storage
    .from(PRODUCT_FILES_BUCKET)
    .createSignedUrl(path, 60, { download: productFileDisplayName(path.split("/").pop() ?? path) });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("The download link could not be created.");
  }

  return data.signedUrl;
};

export const useMyProductFiles = (listingId: string | undefined) =>
  useQuery({
    queryKey: ["myProductFiles", listingId],
    enabled: Boolean(listingId),
    queryFn: async (): Promise<ProductFile[]> => {
      const { data, error } = await supabase.rpc("my_product_files", { p_listing_id: listingId });

      if (error) throw error;

      return data as ProductFile[];
    },
  });

export const useUploadProductFile = (listingId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // Shown to buyers with the file (20261103_183).
      const details = await measureProductFile(file);

      const { error } = await supabase.storage
        .from(PRODUCT_FILES_BUCKET)
        .upload(`${listingId}/${toUniqueStorageFileName(file.name)}`, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
          ...(details ? { metadata: { details } } : {}),
        });

      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["myProductFiles", listingId] }),
  });
};

export const useDeleteProductFile = (listingId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.storage.from(PRODUCT_FILES_BUCKET).remove([path]);

      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["myProductFiles", listingId] }),
  });
};

// For a refund decision: whether and when the buyer downloaded.
export const useInstantPurchaseDownloads = (listingRequestId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["instantPurchaseDownloads", listingRequestId],
    enabled: Boolean(listingRequestId) && enabled,
    queryFn: async (): Promise<{
      downloads: number;
      first_downloaded_at: string | null;
      last_downloaded_at: string | null;
      // When the buyer ticked the final-sale box, at which Refund Policy version.
      final_sale: { accepted_at: string; version: string } | null;
    }> => {
      const { data, error } = await supabase.rpc("get_instant_purchase_downloads", {
        p_listing_request_id: listingRequestId,
      });

      if (error) throw error;

      return data;
    },
  });
