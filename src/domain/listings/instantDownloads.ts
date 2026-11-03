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

// Measured in the browser on upload (src/lib/listings/productFileDetails.ts).
// The database stores it as sent, so it's read as untrusted here.
export type ProductFileDetails =
  | { kind: "image"; width: number; height: number }
  | { kind: "video"; width: number; height: number; seconds: number }
  | { kind: "audio"; seconds: number }
  | {
      kind: "zip";
      files: number;
      unzipped_bytes: number;
      images?: Array<{ width: number; height: number; count: number }>;
    };

export type ProductFile = {
  path?: string;
  name: string;
  size_bytes: number;
  uploaded_at: string;
  details?: ProductFileDetails;
};

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// 75 -> "1:15", 3725 -> "1:02:05".
export const formatDuration = (seconds: number): string => {
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};

// A file's details as short phrases, such as "1920 × 1080 px" and "0:12".
export const describeProductFileDetails = (
  details: unknown,
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
  formatSize: (bytes: number) => string,
): string[] => {
  if (!details || typeof details !== "object") return [];

  const value = details as Record<string, unknown>;
  const pixels = isCount(value.width) && isCount(value.height) && value.width > 0 && value.height > 0
    ? [t("fileDetails.pixels", { width: value.width, height: value.height })]
    : [];
  const length = isCount(value.seconds) && value.seconds > 0 ? [formatDuration(value.seconds)] : [];

  if (value.kind === "image") return pixels;
  if (value.kind === "video") return [...pixels, ...length];
  if (value.kind === "audio") return length;

  if (value.kind === "zip" && isCount(value.files)) {
    const images = Array.isArray(value.images) ? value.images : [];

    return [
      t("fileDetails.zipFiles", {
        count: value.files,
        size: formatSize(isCount(value.unzipped_bytes) ? value.unzipped_bytes : 0),
      }),
      ...images
        .filter((group) => isCount(group?.width) && isCount(group?.height) && isCount(group?.count))
        .map((group) => t("fileDetails.zipImages", group)),
    ];
  }

  return [];
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
