type ListingPriceType = "fixed" | "starting_at" | "range";
type ListingVideoSubtype = "long-form" | "short-form" | null;

export type ListingPublishReadinessInput = {
  title: string;
  short: string;
  category: string;
  video_subtype: ListingVideoSubtype;
  price_type: ListingPriceType;
  price_min: number;
  price_max: number | null;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
};

export type ListingPublishCheck = {
  key: string;
  label: string;
  passed: boolean;
};

export type ListingPublishReadiness = {
  checks: ListingPublishCheck[];
  isReady: boolean;
};

const hasTrimmedText = (value: string) => value.trim().length > 0;

export const getListingPublishReadiness = (
  listing: ListingPublishReadinessInput
): ListingPublishReadiness => {
  const checks: ListingPublishCheck[] = [
    {
      key: "title",
      label: "Title is present and between 3 and 80 characters",
      passed:
        listing.title.trim().length >= 3 && listing.title.trim().length <= 80,
    },
    {
      key: "short",
      label: "Short description is between 10 and 280 characters",
      passed:
        listing.short.trim().length >= 10 && listing.short.trim().length <= 280,
    },
    {
      key: "category",
      label: "Category is set",
      passed: hasTrimmedText(listing.category),
    },
    {
      key: "price",
      label: "Pricing is valid",
      passed:
        listing.price_min >= 0 &&
        (
          listing.price_type === "fixed"
            ? listing.price_max === listing.price_min
            : listing.price_type === "starting_at"
              ? listing.price_max === null
              : listing.price_max !== null && listing.price_max >= listing.price_min
        ),
    },
    {
      key: "deliverables",
      label: "At least one deliverable is listed",
      passed: listing.deliverables.length > 0,
    },
    {
      key: "preview",
      label: "Preview image is added",
      passed: hasTrimmedText(listing.preview_url ?? ""),
    },
    {
      key: "tags",
      label: "At least one tag is added",
      passed: listing.tags.length > 0,
    },
  ];

  return {
    checks,
    isReady: checks.every((check) => check.passed),
  };
};

export const getMissingPublishCheckCount = (readiness: ListingPublishReadiness) =>
  readiness.checks.filter((check) => !check.passed).length;
