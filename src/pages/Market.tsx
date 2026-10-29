import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ListingCard from "../components/listings/ListingCard";
import { StaggerGroup } from "../lib/motion";
import { CATEGORIES } from "../domain/catalog";
import { normalizeTwitchLogin } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { useMarketListings, type MarketListingItem } from "../hooks/listings/useMarketListings";
import { useT } from "../lib/i18n/i18n";
import type { MessageKey } from "../lib/i18n/messages/en";
import {
  useHubActions,
  useHubState,
  type HubFilters,
  type OfferingType,
  type VideoSubtype,
  type CategoryKey,
} from "../providers/hub";

const classes = {
  page: "space-y-5",

  headerWrap: "space-y-1",
  h1: "pageTitle",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-1",
  select: "searchInput",
  freeToggleRow: "flex items-center gap-2",
  freeToggle: "navChip whitespace-nowrap",
  freeToggleActive: "navChip navChipActive whitespace-nowrap",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  loadingText: "text-sm text-zinc-600",
  emptyText: "text-sm text-zinc-600",
} as const;

// Sourced from src/domain/catalog.ts so Market and the rest of the app
// (creator specialty labels, etc.) can never drift out of sync again.
const categoryKeys = ["all", ...CATEGORIES.map((category) => category.key)] as const;

// Builds a search string for listing filtering
const getListingHaystack = (item: MarketListingItem): string => {
  const { listing, creator, platformAccounts } = item;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  return [
    listing.title,
    listing.short,
    listing.category,
    listing.offering_type,
    listing.video_subtype ?? "",
    ...(listing.deliverables ?? []),
    ...(listing.tags ?? []),
    creator?.display_name ?? "",
    creator?.handle ?? "",
    twitchAccount?.platform_login ?? "",
    twitchAccount?.platform_display_name ?? "",
  ]
    .join(" ")
    .toLowerCase();
};

// Reads supported filter values from the current URL query string
const parseFromUrl = (search: string): Partial<HubFilters> => {
  const params = new URLSearchParams(search);

  const q = params.get("q") ?? "";
  const category = params.get("cat") ?? "all";
  const type = params.get("type") ?? "all";
  const videoSubtype = params.get("video") ?? "all";

  return {
    q,
    category: category as CategoryKey,
    type: type as OfferingType,
    videoSubtype: videoSubtype as VideoSubtype,
  };
};

type MarketProps = {
  // Renders the dedicated /free page: pre-filters to free listings, hides
  // the redundant type filter, and swaps the free toggle for a fixed label.
  forceFree?: boolean;
};

const Market = ({ forceFree = false }: MarketProps) => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();
  const { search } = useLocation();
  const { twitchByLogin } = useTwitchStreams();

  const { data: items = [], isLoading, error } = useMarketListings();
  const t = useT();
  // Syncs supported URL params into Hub filter state
  useEffect(() => {
    const fromUrl = parseFromUrl(search);
    const patch: Partial<HubFilters> = {};

    if (fromUrl.q !== undefined && fromUrl.q !== filters.q) {
      patch.q = fromUrl.q;
    }

    if (fromUrl.type !== undefined && fromUrl.type !== filters.type) {
      patch.type = fromUrl.type;
    }

    if (
      fromUrl.category !== undefined &&
      fromUrl.category !== filters.category
    ) {
      patch.category = fromUrl.category;
    }

    if (
      fromUrl.videoSubtype !== undefined &&
      fromUrl.videoSubtype !== filters.videoSubtype
    ) {
      patch.videoSubtype = fromUrl.videoSubtype;
    }

    if (Object.keys(patch).length > 0) {
      setFilters(patch);
    }
  }, [
    search,
    filters.q,
    filters.type,
    filters.category,
    filters.videoSubtype,
    setFilters,
  ]);

  // Applies the current Hub filters to public marketplace listings
  const filtered = useMemo((): MarketListingItem[] => {
    const searchValue = filters.q.trim().toLowerCase();

    return items.filter((item) => {
      const { listing } = item;

      if ((forceFree || filters.freeOnly) && !listing.is_free) {
        return false;
      }

      if (
        !forceFree &&
        filters.type !== "all" &&
        listing.offering_type !== filters.type
      ) {
        return false;
      }

      if (
        filters.category !== "all" &&
        listing.category !== filters.category
      ) {
        return false;
      }

      if (filters.videoSubtype !== "all") {
        if (listing.category !== "video-editing") return false;
        if ((listing.video_subtype ?? "all") !== filters.videoSubtype) {
          return false;
        }
      }

      if (!searchValue) return true;

      return getListingHaystack(item).includes(searchValue);
    });
  }, [filters, items, forceFree]);

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>{forceFree ? t("market.freeTitle") : t("market.title")}</h1>
        <p className={classes.subtitle}>
          {forceFree
            ? t("market.freeSubtitle")
            : t("market.subtitle")}
        </p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={filters.q}
          onChange={(event) => setFilters({ q: event.currentTarget.value })}
          placeholder={t("market.searchPlaceholder")}
        />

        {!forceFree && (
          <select
            className={classes.select}
            value={filters.type}
            onChange={(event) =>
              setFilters({ type: event.currentTarget.value as OfferingType })
            }
          >
            <option value="all">{t("market.allTypes")}</option>
            <option value="digital">{t("offering.digital")}</option>
            <option value="commission">{t("offering.commission")}</option>
            <option value="service">{t("offering.service")}</option>
          </select>
        )}

        <select
          className={classes.select}
          value={filters.category}
          onChange={(event) =>
            setFilters({ category: event.currentTarget.value as CategoryKey })
          }
        >
          {categoryKeys.map((key) => (
            <option key={key} value={key}>
              {key === "all" ? t("market.allCategories") : t(`category.${key}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>

      {!forceFree && (
        <div className={classes.freeToggleRow}>
          <button
            type="button"
            className={
              filters.freeOnly ? classes.freeToggleActive : classes.freeToggle
            }
            aria-pressed={filters.freeOnly}
            onClick={() => setFilters({ freeOnly: !filters.freeOnly })}
          >
            {t("market.freeOnly")}
          </button>
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>{t("common.loading")}</div>}

      {error && !isLoading && (
        <div className={classes.loadingText}>
          {t("market.loadError")}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className={classes.emptyText}>{t("market.empty")}</div>
      )}

      <StaggerGroup
        className={classes.grid}
        itemCount={filtered.length}
        resetKey={search}
      >
        {filtered.map((item) => {
          const { listing, creator, platformAccounts } = item;

          const twitchAccount =
            platformAccounts.find((account) => account.platform === "twitch") ?? null;

          const twitchLoginRaw = twitchAccount?.platform_login ?? null;
          const twitchLogin = twitchLoginRaw
            ? normalizeTwitchLogin(twitchLoginRaw)
            : null;

          const isLive = twitchLogin ? Boolean(twitchByLogin[twitchLogin]) : false;

          return (
            <ListingCard
              key={listing.id}
              listing={{
                id: listing.id,
                title: listing.title,
                short: listing.short,
                offering_type: listing.offering_type,
                price_type: listing.price_type,
                price_min: listing.price_min,
                price_max: listing.price_max,
                currency: listing.currency,
                preview_url: listing.preview_url,
                is_free: listing.is_free,
              }}
              creator={{
                name: creator?.display_name ?? creator?.handle ?? t("common.unknownCreator"),
                isLive,
              }}
            />
          );
        })}
      </StaggerGroup>
    </div>
  );
};

export default Market;