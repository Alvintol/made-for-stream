// Instant downloads (20261103_182): a ready-made digital listing bought and
// downloaded straight away. The database checks every rule here again when a
// purchase starts. Playbook: docs/support/listings/instant-downloads.md.

import type { MessageKey } from "../../lib/i18n/messages/en";

export type InstantLicence = "personal" | "stream" | "commercial";

export const instantLicences: readonly InstantLicence[] = ["personal", "stream", "commercial"];

export const isInstantLicence = (value: unknown): value is InstantLicence =>
  instantLicences.includes(value as InstantLicence);

export const instantLicenceLabel = (licence: InstantLicence): MessageKey =>
  `instant.licence.${licence}`;

export const instantLicenceText = (licence: InstantLicence): MessageKey =>
  `instant.licenceText.${licence}`;

// The smallest price a payment can have (Payment Terms section 2), in whole
// currency units like the listing's price.
export const INSTANT_MIN_PRICE = 10;

// The bucket's own limits, and the upload policy's file count.
export const PRODUCT_FILES_BUCKET = "product-files";
export const PRODUCT_FILES_MAX_COUNT = 10;

export type ProductFile = {
  path?: string;
  name: string;
  size_bytes: number;
  uploaded_at: string;
};

// A stored name carries a unique id before the extension
// ("pack_3f9a1c2b7d4e.zip"); people see the name without it.
export const productFileDisplayName = (name: string): string =>
  name.replace(/_[0-9a-f]{12}(\.[A-Za-z0-9]+)?$/, "$1");

// Why an instant listing can't be saved, or null when it can. Free listings
// skip Stripe, so none of this applies to them.
export const instantListingProblems = (input: {
  isInstant: boolean;
  isFree?: boolean;
  priceType: string;
  priceMin: number | null;
  licence: string;
}): { priceMin?: MessageKey; instantLicence?: MessageKey } => {
  if (!input.isInstant || input.isFree) return {};

  return {
    ...(input.priceType !== "fixed" || input.priceMin === null || input.priceMin < INSTANT_MIN_PRICE
      ? { priceMin: "instant.errorPrice" as const }
      : {}),
    ...(isInstantLicence(input.licence) ? {} : { instantLicence: "instant.errorLicence" as const }),
  };
};

export type InstantListingState = {
  files: ProductFile[];
  owned: boolean;
  pending_payment_id: string | null;
};

export type DownloadItem = {
  listing_request_id: string;
  listing_id: string;
  payment_id: string;
  title: string | null;
  licence: string | null;
  paid_at: string;
  files: ProductFile[];
  downloaded: boolean;
};
