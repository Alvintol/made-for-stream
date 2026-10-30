import { english, type Translate } from "../../lib/i18n/i18n";

export type ListingOfferingType = "digital" | "commission" | "service";
export type ListingPriceType = "fixed" | "starting_at" | "range";
export type ListingVideoSubtype = "" | "long-form" | "short-form";
export type ListingFulfilmentMode = "request" | "instant";

export const listingFulfilmentModeOptions = [
    { value: "request", label: "listingForm.flowRequest" },
    { value: "instant", label: "fulfilment.instant" },
  ] as const satisfies ReadonlyArray<{
    value: ListingFulfilmentMode;
    label: string;
  }>;

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
// The listing page's call to action, as translation keys (lib/i18n).
export const getFulfilmentModeCopy = (
  fulfilmentMode: ListingFulfilmentMode
) =>
  fulfilmentMode === "instant"
    ? ({
      title: "listing.instantTitle",
      text: "listing.instantText",
      primaryLabel: "listing.instantButton",
    } as const)
    : ({
      title: "listing.requestTitle",
      text: "listing.requestText",
      primaryLabel: "listing.requestButton",
    } as const);

// Free listings skip Stripe entirely: a creator gives a listing away either
// as a direct file download (uploaded to the free-assets storage bucket) or
// as a redirect to something hosted elsewhere (itch.io, Steam, GitHub, a
// playable build). Exactly one of the two must be set when isFree is true.
export type FreeDeliveryType = "download" | "external_link";

export const freeDeliveryTypeOptions: Array<{
  value: FreeDeliveryType;
}> = [
    { value: "download" },
    { value: "external_link" },
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
  input: FreeListingInput,
  t: Translate = english
): string | null => {
  if (!input.isFree) return null;

  if (!input.deliveryType) {
    return t("listingForm.freeErrorType");
  }

  if (input.deliveryType === "external_link") {
    if (!isValidFreeExternalUrl(input.externalUrl.trim())) {
      return t("listingForm.freeErrorLink");
    }
  }

  if (input.deliveryType === "download") {
    if (!input.hasFile) {
      return t("listingForm.freeErrorFile");
    }

    if (
      typeof input.fileSizeBytes === "number" &&
      input.fileSizeBytes > FREE_ASSET_MAX_BYTES
    ) {
      return t("listingForm.freeErrorSize");
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
}, t: Translate = english): string =>
  t(
    isAdminHiddenListing(listing)
      ? "listingStatus.hidden"
      : listing.is_active
        ? "listingStatus.visible"
        : "listingStatus.inactive"
  );

export type ListingStatusKey = "draft" | "live" | "inactive" | "admin_hidden";

// The one-line answer to "can buyers see this?", for the creator's own pages.
export const getListingStatusSummary = (listing: {
  status: string;
  is_active: boolean;
  admin_hidden_at?: string | null;
}, t: Translate = english): { key: ListingStatusKey; title: string; description: string } =>
  isAdminHiddenListing(listing)
    ? {
        key: "admin_hidden",
        title: t("listingSummary.hiddenTitle"),
        description: t("listingSummary.hiddenText"),
      }
    : listing.status === "draft"
      ? {
          key: "draft",
          title: t("listingSummary.draftTitle"),
          description: t("listingSummary.draftText"),
        }
      : listing.is_active
        ? {
            key: "live",
            title: t("listingSummary.liveTitle"),
            description: t("listingSummary.liveText"),
          }
        : {
            key: "inactive",
            title: t("listingSummary.inactiveTitle"),
            description: t("listingSummary.inactiveText"),
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
  request: ListingRequestDisplayInput,
  t: Translate = english
): string => {
  const requestTitle = request.request_title?.trim();
  const listingTitle = request.listing_snapshot?.title?.trim();

  return requestTitle || listingTitle || t("commission.untitled");
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