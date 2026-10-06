import type { ListingRevisionRow } from "../../hooks/listings/useListingRevisions";

export type ListingRevisionChange = {
  key:
  | "title"
  | "short"
  | "offering_type"
  | "fulfilment_mode"
  | "category"
  | "video_subtype"
  | "price"
  | "deliverables"
  | "tags"
  | "preview_url"
  | "status";
  label: string;
  // Set together when the field went from one value to another; shown on
  // their own lines.
  from?: string;
  to?: string;
};

const priceText = (
  priceType: "fixed" | "starting_at" | "range",
  priceMin: number,
  priceMax: number | null
) =>
  priceType === "fixed"
    ? `$${priceMin}`
    : priceType === "starting_at"
      ? `From $${priceMin}`
      : `$${priceMin}–$${priceMax ?? priceMin}`;

const statusText = (status: "draft" | "published", isActive: boolean) =>
  `${status} • ${isActive ? "Active" : "Inactive"}`;

const listText = (items: string[]) => (items.length > 0 ? items.join(", ") : "None");

// Builds human-readable change labels between two revision snapshots
export const getListingRevisionChanges = (
  current: ListingRevisionRow,
  previous: ListingRevisionRow | null
): ListingRevisionChange[] => {
  if (!previous) {
    return [
      {
        key: "status",
        label: "Initial listing revision recorded",
      },
    ];
  }

  const currentSnapshot = current.snapshot;
  const previousSnapshot = previous.snapshot;

  const changes: ListingRevisionChange[] = [];

  if (currentSnapshot.title !== previousSnapshot.title) {
    changes.push({
      key: "title",
      label: "Title changed",
      from: `"${previousSnapshot.title}"`,
      to: `"${currentSnapshot.title}"`,
    });
  }

  if (currentSnapshot.fulfilment_mode !== previousSnapshot.fulfilment_mode) {
    changes.push({
      key: "fulfilment_mode",
      label: "Fulfilment mode changed",
      from: previousSnapshot.fulfilment_mode,
      to: currentSnapshot.fulfilment_mode,
    });
  }

  if (currentSnapshot.short !== previousSnapshot.short) {
    changes.push({
      key: "short",
      label: "Short description changed",
    });
  }

  if (currentSnapshot.offering_type !== previousSnapshot.offering_type) {
    changes.push({
      key: "offering_type",
      label: "Offering type changed",
      from: previousSnapshot.offering_type,
      to: currentSnapshot.offering_type,
    });
  }

  if (currentSnapshot.category !== previousSnapshot.category) {
    changes.push({
      key: "category",
      label: "Category changed",
      from: previousSnapshot.category,
      to: currentSnapshot.category,
    });
  }

  if (currentSnapshot.video_subtype !== previousSnapshot.video_subtype) {
    changes.push({
      key: "video_subtype",
      label: "Video subtype changed",
      from: previousSnapshot.video_subtype ?? "None",
      to: currentSnapshot.video_subtype ?? "None",
    });
  }

  const currentPrice = priceText(
    currentSnapshot.price_type,
    currentSnapshot.price_min,
    currentSnapshot.price_max
  );

  const previousPrice = priceText(
    previousSnapshot.price_type,
    previousSnapshot.price_min,
    previousSnapshot.price_max
  );

  if (
    currentSnapshot.price_type !== previousSnapshot.price_type ||
    currentSnapshot.price_min !== previousSnapshot.price_min ||
    currentSnapshot.price_max !== previousSnapshot.price_max
  ) {
    changes.push({
      key: "price",
      label: "Price changed",
      from: previousPrice,
      to: currentPrice,
    });
  }

  if (
    JSON.stringify(currentSnapshot.deliverables) !==
    JSON.stringify(previousSnapshot.deliverables)
  ) {
    changes.push({
      key: "deliverables",
      label: "Deliverables changed",
      from: listText(previousSnapshot.deliverables),
      to: listText(currentSnapshot.deliverables),
    });
  }

  if (JSON.stringify(currentSnapshot.tags) !== JSON.stringify(previousSnapshot.tags)) {
    changes.push({
      key: "tags",
      label: "Tags changed",
      from: listText(previousSnapshot.tags),
      to: listText(currentSnapshot.tags),
    });
  }

  if (currentSnapshot.preview_url !== previousSnapshot.preview_url) {
    changes.push({
      key: "preview_url",
      label: "Preview image changed",
      from: previousSnapshot.preview_url ?? "None",
      to: currentSnapshot.preview_url ?? "None",
    });
  }

  if (
    currentSnapshot.status !== previousSnapshot.status ||
    currentSnapshot.is_active !== previousSnapshot.is_active
  ) {
    changes.push({
      key: "status",
      label: "Status changed",
      from: statusText(previousSnapshot.status, previousSnapshot.is_active),
      to: statusText(currentSnapshot.status, currentSnapshot.is_active),
    });
  }

  return changes.length > 0
    ? changes
    : [
      {
        key: "status",
        label: "Revision recorded with no tracked field differences",
      },
    ];
};