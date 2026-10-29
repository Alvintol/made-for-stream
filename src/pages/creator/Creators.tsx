import { useMemo } from "react";
import CreatorCard, { type CreatorCardModel } from "../../components/creators/CreatorCard";
import { normalizeTwitchLogin } from "../../domain/twitch";
import { usePublicCreators, type PublicCreatorItem } from "../../hooks/usePublicCreators";
import { useTwitchStreams } from "../../hooks/useTwitchStreams";
import { useT } from "../../lib/i18n/i18n";
import { StaggerGroup } from "../../lib/motion";
import {
  useHubState,
  useHubActions,
  type HubFilters,
  type HubActions,
} from "../../providers/hub";

const classes = {
  container: "space-y-5",

  headerWrap: "space-y-1",
  h1: "pageTitle",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-2",

  togglesRow: "flex items-center gap-4",
  label: "flex items-center gap-2 text-sm text-zinc-700",
  checkbox: "h-4 w-4 accent-[rgb(var(--ink))]",

  cardsGrid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  loadingText: "text-sm text-zinc-600",
  emptyText: "text-sm text-zinc-600",
} as const;

// Adapts real db-backed creator data into the shape CreatorCard already expects
const toCreatorCardModel = (
  item: PublicCreatorItem,
  isLive: boolean,
  liveTitle?: string
): CreatorCardModel => {
  const { profile, platformAccounts, listings } = item;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const youtubeAccount =
    platformAccounts.find((account) => account.platform === "youtube") ?? null;

  const tags = Array.from(
    new Set(
      listings.flatMap((listing) => [
        ...(listing.tags ?? []),
        listing.category,
        listing.offering_type,
      ])
    )
  ).filter(Boolean);

  const specialties = Array.from(
    new Set(listings.map((listing) => listing.category).filter(Boolean))
  );

  return {
    id: profile.user_id,
    handle: profile.handle ?? "",
    displayName: profile.display_name ?? profile.handle ?? "Creator",
    verified: false,
    bio: profile.bio ?? "",
    tags,
    specialties,
    commissionStatus: listings.length > 0 ? "open" : "closed",
    platforms: {
      twitch: twitchAccount?.platform_login
        ? {
          login: twitchAccount.platform_login,
          userId: twitchAccount.platform_user_id,
        }
        : undefined,
      youtube: youtubeAccount
        ? {
          channelId: youtubeAccount.platform_user_id,
          handle: youtubeAccount.platform_login ?? undefined,
        }
        : undefined,
    },
    links: {
      twitch: twitchAccount?.profile_url ?? undefined,
      youtube: youtubeAccount?.profile_url ?? undefined,
    },
    live: twitchAccount
      ? {
        isLive,
        title: liveTitle,
        platform: "twitch",
      }
      : undefined,
  };
};

// Filters creators using the current Hub filter state
const getFilteredCreators = (
  list: CreatorCardModel[],
  filters: HubFilters
): CreatorCardModel[] => {
  const searchValue = filters.q.trim().toLowerCase();

  return list.filter((creator) => {
    if (filters.onlyLive && !creator.live?.isLive) return false;
    if (filters.onlyOpen && creator.commissionStatus !== "open") return false;
    if (!searchValue) return true;

    const haystack = [
      creator.displayName,
      creator.handle,
      creator.bio,
      ...(creator.tags ?? []),
      ...(creator.specialties ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchValue);
  });
};

const PageHeader = () => {
  const t = useT();

  return (
    <div className={classes.headerWrap}>
      <h1 className={classes.h1}>{t("creators.title")}</h1>
      <p className={classes.subtitle}>{t("creators.subtitle")}</p>
    </div>
  );
};

type FiltersRowProps = {
  filters: HubFilters;
  setFilters: HubActions["setFilters"];
};

const FiltersRow = ({ filters, setFilters }: FiltersRowProps) => {
  const t = useT();

  return (
  <div className={classes.filtersGrid}>
    <input
      className={classes.input}
      value={filters.q}
      onChange={(event) => setFilters({ q: event.currentTarget.value })}
      placeholder={t("creators.searchPlaceholder")}
    />

    <div className={classes.togglesRow}>
      <label className={classes.label}>
        <input
          className={classes.checkbox}
          type="checkbox"
          checked={filters.onlyLive}
          onChange={(event) =>
            setFilters({ onlyLive: event.currentTarget.checked })
          }
        />
        {t("common.live")}
      </label>

      <label className={classes.label}>
        <input
          className={classes.checkbox}
          type="checkbox"
          checked={filters.onlyOpen}
          onChange={(event) =>
            setFilters({ onlyOpen: event.currentTarget.checked })
          }
        />
        {t("creators.open")}
      </label>
    </div>
  </div>
  );
};

const CreatorsPage = () => {
  const { filters } = useHubState();
  const { setFilters } = useHubActions();
  const { twitchByLogin } = useTwitchStreams();

  const { data: items = [], isLoading, error } = usePublicCreators();
  const t = useT();
  const creators = useMemo(() => {
    return items.map((item) => {
      const twitchAccount =
        item.platformAccounts.find((account) => account.platform === "twitch") ?? null;

      const twitchLoginRaw = twitchAccount?.platform_login ?? null;
      const twitchLogin = twitchLoginRaw
        ? normalizeTwitchLogin(twitchLoginRaw)
        : null;

      const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
      const isLive = Boolean(stream);

      return toCreatorCardModel(item, isLive, stream?.title);
    });
  }, [items, twitchByLogin]);

  const filtered = useMemo(
    () => getFilteredCreators(creators, filters),
    [creators, filters]
  );

  return (
    <div className={classes.container}>
      <PageHeader />
      <FiltersRow filters={filters} setFilters={setFilters} />

      {isLoading && <div className={classes.loadingText}>{t("common.loading")}</div>}

      {error && !isLoading && (
        <div className={classes.loadingText}>
          {t("creators.loadError")}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className={classes.emptyText}>{t("creators.empty")}</div>
      )}

      <StaggerGroup className={classes.cardsGrid} itemCount={filtered.length}>
        {filtered.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} />
        ))}
      </StaggerGroup>
    </div>
  );
};

export default CreatorsPage;