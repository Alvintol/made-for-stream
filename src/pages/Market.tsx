import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ListingCard from "../components/listings/ListingCard";
import { StaggerGroup } from "../lib/motion";
import { CATEGORIES } from "../domain/catalog";
import { normalizeTwitchLogin } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { useMarketListings } from "../hooks/listings/useMarketListings";
import { useT } from "../lib/i18n/i18n";
import { useDebouncedValue } from "../lib/useDebouncedValue";
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
  moreRow: "flex justify-center",
  moreButton: "btnOutline",
} as const;

// Sourced from src/domain/catalog.ts so Market and the rest of the app
// (creator specialty labels, etc.) can never drift out of sync again.
const categoryKeys = ["all", ...CATEGORIES.map((category) => category.key)] as const;

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
  const q = useDebouncedValue(filters.q.trim());

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMarketListings({
    q,
    category: filters.category === "all" ? null : filters.category,
    type: forceFree || filters.type === "all" ? null : filters.type,
    video: filters.videoSubtype === "all" ? null : filters.videoSubtype,
    freeOnly: forceFree || filters.freeOnly,
  });

  const listings = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);
  const t = useT();

  // A link sets the filters when the URL changes. From there the controls on
  // the page own them, so nothing here may put the URL's values back.
  useEffect(() => {
    setFilters(parseFromUrl(search));
  }, [search, setFilters]);
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

      {!isLoading && !error && listings.length === 0 && (
        <div className={classes.emptyText}>{t("market.empty")}</div>
      )}

      <StaggerGroup
        className={classes.grid}
        itemCount={listings.length}
        resetKey={search}
      >
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            creator={{
              name: listing.creator_name ?? listing.creator_handle ?? t("common.unknownCreator"),
              isLive: listing.twitch_login
                ? Boolean(twitchByLogin[normalizeTwitchLogin(listing.twitch_login)])
                : false,
            }}
          />
        ))}
      </StaggerGroup>

      {hasNextPage && (
        <div className={classes.moreRow}>
          <button
            type="button"
            className={classes.moreButton}
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
};

export default Market;