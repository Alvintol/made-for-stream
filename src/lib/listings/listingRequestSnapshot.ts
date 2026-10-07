import type { PublicListingRow } from "../../hooks/listings/usePublicListing";

export type ListingRequestSnapshot = {
  listing_id: string;
  title: string;
  short: string;
  offering_type: string;
  fulfilment_mode: "request" | "instant";
  category: string;
  video_subtype: string | null;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  // Absent on snapshots taken before listings had a currency (those were CAD).
  currency?: string;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
  status: string;
  is_active: boolean;
  updated_at: string;
};

// Freezes the buyer-visible listing state at the moment a request is submitted
export const buildListingRequestSnapshot = (
  listing: PublicListingRow
): ListingRequestSnapshot => ({
  listing_id: listing.id,
  title: listing.title,
  short: listing.short,
  offering_type: listing.offering_type,
  fulfilment_mode: listing.fulfilment_mode,
  category: listing.category,
  video_subtype: listing.video_subtype,
  price_type: listing.price_type,
  price_min: listing.price_min,
  price_max: listing.price_max,
  currency: listing.currency,
  deliverables: listing.deliverables,
  tags: listing.tags,
  preview_url: listing.preview_url,
  status: listing.status,
  is_active: listing.is_active,
  updated_at: listing.updated_at,
});