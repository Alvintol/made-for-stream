import type { ListingRevisionRow } from "../../hooks/listings/useListingRevisions";
import { english, wordFor, type Translate } from "../i18n/i18n";
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

export const revisionPriceText = (
  priceType: "fixed" | "starting_at" | "range",
  priceMin: number,
  priceMax: number | null,
  t: Translate = english
) =>
  priceType === "fixed"
    ? `$${priceMin}`
    : priceType === "starting_at"
      ? `${t("price.from")} $${priceMin}`
      : `$${priceMin}–$${priceMax ?? priceMin}`;

export const revisionStatusText = (
  status: "draft" | "published",
  isActive: boolean,
  t: Translate = english
) =>
  `${t(status === "draft" ? "revision.statusDraft" : "revision.statusPublished")} • ${t(isActive ? "revision.active" : "listingStatus.inactive")}`;
// Builds human-readable change labels between two revision snapshots
export const getListingRevisionChanges = (
  current: ListingRevisionRow,
  previous: ListingRevisionRow | null,
  t: Translate = english
): ListingRevisionChange[] => {
  const none = t("listingForm.videoNone");
  const listText = (items: string[]) => (items.length > 0 ? items.join(", ") : none);

  if (!previous) {
    return [
      {
        key: "status",
        label: t("revisionChange.initial"),
      },
    ];
  }

  const currentSnapshot = current.snapshot;
  const previousSnapshot = previous.snapshot;

  const changes: ListingRevisionChange[] = [];

  if (currentSnapshot.title !== previousSnapshot.title) {
    changes.push({
      key: "title",
      label: t("revisionChange.title"),
      from: `"${previousSnapshot.title}"`,
      to: `"${currentSnapshot.title}"`,
    });
  }

  if (currentSnapshot.fulfilment_mode !== previousSnapshot.fulfilment_mode) {
    changes.push({
      key: "fulfilment_mode",
      label: t("revisionChange.fulfilment"),
      from: wordFor("fulfilment", previousSnapshot.fulfilment_mode, t),
      to: wordFor("fulfilment", currentSnapshot.fulfilment_mode, t),
    });
  }

  if (currentSnapshot.short !== previousSnapshot.short) {
    changes.push({
      key: "short",
      label: t("revisionChange.short"),
    });
  }

  if (currentSnapshot.offering_type !== previousSnapshot.offering_type) {
    changes.push({
      key: "offering_type",
      label: t("revisionChange.offering"),
      from: wordFor("offering", previousSnapshot.offering_type, t),
      to: wordFor("offering", currentSnapshot.offering_type, t),
    });
  }

  if (currentSnapshot.category !== previousSnapshot.category) {
    changes.push({
      key: "category",
      label: t("revisionChange.category"),
      from: wordFor("category", previousSnapshot.category, t),
      to: wordFor("category", currentSnapshot.category, t),
    });
  }

  if (currentSnapshot.video_subtype !== previousSnapshot.video_subtype) {
    changes.push({
      key: "video_subtype",
      label: t("revisionChange.video"),
      from: previousSnapshot.video_subtype ? wordFor("video", previousSnapshot.video_subtype, t) : none,
      to: currentSnapshot.video_subtype ? wordFor("video", currentSnapshot.video_subtype, t) : none,
    });
  }

  const currentPrice = revisionPriceText(
    currentSnapshot.price_type,
    currentSnapshot.price_min,
    currentSnapshot.price_max,
    t
  );

  const previousPrice = revisionPriceText(
    previousSnapshot.price_type,
    previousSnapshot.price_min,
    previousSnapshot.price_max,
    t
  );

  if (
    currentSnapshot.price_type !== previousSnapshot.price_type ||
    currentSnapshot.price_min !== previousSnapshot.price_min ||
    currentSnapshot.price_max !== previousSnapshot.price_max
  ) {
    changes.push({
      key: "price",
      label: t("revisionChange.price"),
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
      label: t("revisionChange.deliverables"),
      from: listText(previousSnapshot.deliverables),
      to: listText(currentSnapshot.deliverables),
    });
  }

  if (JSON.stringify(currentSnapshot.tags) !== JSON.stringify(previousSnapshot.tags)) {
    changes.push({
      key: "tags",
      label: t("revisionChange.tags"),
      from: listText(previousSnapshot.tags),
      to: listText(currentSnapshot.tags),
    });
  }

  if (currentSnapshot.preview_url !== previousSnapshot.preview_url) {
    changes.push({
      key: "preview_url",
      label: t("revisionChange.preview"),
      from: previousSnapshot.preview_url ?? none,
      to: currentSnapshot.preview_url ?? none,
    });
  }

  if (
    currentSnapshot.status !== previousSnapshot.status ||
    currentSnapshot.is_active !== previousSnapshot.is_active
  ) {
    changes.push({
      key: "status",
      label: t("revisionChange.status"),
      from: revisionStatusText(previousSnapshot.status, previousSnapshot.is_active, t),
      to: revisionStatusText(currentSnapshot.status, currentSnapshot.is_active, t),
    });
  }

  return changes.length > 0
    ? changes
    : [
      {
        key: "status",
        label: t("revisionChange.none"),
      },
    ];
};