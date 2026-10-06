export type ListingOfferingType = "digital" | "commission" | "service";
export type ListingPriceType = "fixed" | "starting_at" | "range";
export type ListingVideoSubtype = "" | "long-form" | "short-form";
export type ListingFulfilmentMode = "request" | "instant";

export const listingFulfilmentModeOptions: Array<{
  value: ListingFulfilmentMode;
  label: string;
}> = [
    { value: "request", label: "Request approval" },
    { value: "instant", label: "Instant purchase" },
  ];

// Only digital listings can be sold instantly in this first pass
export const allowsInstantFulfilment = (
  offeringType: ListingOfferingType
): boolean => offeringType === "digital";

// Returns the allowed fulfilment modes for the chosen offering type
export const getAllowedFulfilmentModes = (
  offeringType: ListingOfferingType
): ListingFulfilmentMode[] =>
  allowsInstantFulfilment(offeringType) ? ["request", "instant"] : ["request"];

// Forces invalid combinations back to request mode
export const normaliseFulfilmentMode = (
  offeringType: ListingOfferingType,
  fulfilmentMode: ListingFulfilmentMode
): ListingFulfilmentMode =>
  allowsInstantFulfilment(offeringType) ? fulfilmentMode : "request";

// Buyer-facing CTA copy for public listing pages
export const getFulfilmentModeCopy = (
  fulfilmentMode: ListingFulfilmentMode
) =>
  fulfilmentMode === "instant"
    ? {
      title: "Instant purchase coming soon",
      text:
        "This listing is intended for direct repeat purchases once digital delivery is added.",
      primaryLabel: "Buy instantly soon",
    }
    : {
      title: "Request flow coming soon",
      text:
        "This listing is intended to start with creator review or confirmation before work begins.",
      primaryLabel: "Request this listing soon",
    };

// Free listings skip Stripe entirely: a creator gives a listing away either
// as a direct file download (uploaded to the free-assets storage bucket) or
// as a redirect to something hosted elsewhere (itch.io, Steam, GitHub, a
// playable build). Exactly one of the two must be set when isFree is true.
export type FreeDeliveryType = "download" | "external_link";

export const freeDeliveryTypeOptions: Array<{
  value: FreeDeliveryType;
  label: string;
}> = [
    { value: "download", label: "Direct download (upload a file)" },
    { value: "external_link", label: "External link (itch.io, Steam, GitHub, etc.)" },
  ];

// Only digital listings can be marked free in this first pass — commissions
// and services always involve custom work for a specific buyer.
export const allowsFreeListing = (
  offeringType: ListingOfferingType
): boolean => offeringType === "digital";

export const isValidFreeExternalUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// Keep uploads well below typical free-tier Supabase Storage request limits.
export const FREE_ASSET_MAX_BYTES = 200 * 1024 * 1024; // 200MB

export type FreeListingInput = {
  isFree: boolean;
  deliveryType: FreeDeliveryType | null;
  externalUrl: string;
  hasFile: boolean;
  fileSizeBytes?: number | null;
};

// Validates the free-listing fields of the create-listing form. Returns
// null when valid, or a single user-facing error message otherwise.
export const validateFreeListingInput = (
  input: FreeListingInput
): string | null => {
  if (!input.isFree) return null;

  if (!input.deliveryType) {
    return "Choose how buyers will get this free listing.";
  }

  if (input.deliveryType === "external_link") {
    if (!isValidFreeExternalUrl(input.externalUrl.trim())) {
      return "Enter a valid link starting with http:// or https://.";
    }
  }

  if (input.deliveryType === "download") {
    if (!input.hasFile) {
      return "Upload a file for buyers to download.";
    }

    if (
      typeof input.fileSizeBytes === "number" &&
      input.fileSizeBytes > FREE_ASSET_MAX_BYTES
    ) {
      return "That file is larger than the 200MB limit for free downloads.";
    }
  }

  return null;
};

export const isAdminHiddenListing = (listing: {
  admin_hidden_at?: string | null;
}): boolean => Boolean(listing.admin_hidden_at);

export const getListingVisibilityLabel = (listing: {
  is_active: boolean;
  admin_hidden_at?: string | null;
}): string =>
  isAdminHiddenListing(listing)
    ? "Hidden by admin"
    : listing.is_active
      ? "Visible"
      : "Inactive";

export type ListingStatusKey = "draft" | "live" | "inactive" | "admin_hidden";

// The one-line answer to "can buyers see this?", for the creator's own pages.
export const getListingStatusSummary = (listing: {
  status: string;
  is_active: boolean;
  admin_hidden_at?: string | null;
}): { key: ListingStatusKey; title: string; description: string } =>
  isAdminHiddenListing(listing)
    ? {
        key: "admin_hidden",
        title: "Locked by an admin",
        description: "Buyers cannot see this listing, and you cannot change it until an admin restores it.",
      }
    : listing.status === "draft"
      ? {
          key: "draft",
          title: "Draft: only you can see this",
          description: "Buyers cannot see or request this listing until you publish it.",
        }
      : listing.is_active
        ? {
            key: "live",
            title: "Live: buyers can see this",
            description: "This listing is published and shown in the market.",
          }
        : {
            key: "inactive",
            title: "Deactivated: hidden from buyers",
            description: "This listing is published but switched off. Reactivate it to show it in the market again.",
          };

export type ListingRequestDisplayInput = {
  request_title?: string | null;
  request_details?: string | null;
  message?: string | null;
  listing_snapshot?: {
    title?: string | null;
  } | null;
};

export const getListingRequestDisplayTitle = (
  request: ListingRequestDisplayInput
): string => {
  const requestTitle = request.request_title?.trim();
  const listingTitle = request.listing_snapshot?.title?.trim();

  return requestTitle || listingTitle || "Untitled request";
};

export const getListingRequestDisplayPreview = (
  request: ListingRequestDisplayInput,
  maxLength = 140
): string => {
  const previewText =
    request.request_details?.trim() || request.message?.trim() || "";

  return previewText.length > maxLength
    ? `${previewText.slice(0, maxLength)}…`
    : previewText;
};