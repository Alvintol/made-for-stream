import { useMemo } from "react";
import CreatorCard, { type CreatorCardModel } from "../../components/creators/CreatorCard";
import { normalizeTwitchLogin, type TwitchStream } from "../../domain/twitch";
import { useCreatorDirectory, type CreatorDirectoryRow } from "../../hooks/useCreatorDirectory";
import { useTwitchStreams } from "../../hooks/useTwitchStreams";
import { useT } from "../../lib/i18n/i18n";
import { StaggerGroup } from "../../lib/motion";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
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
  moreRow: "flex justify-center",
  moreButton: "btnOutline",
} as const;

// Adapts real db-backed creator data into the shape CreatorCard already expects
const toCreatorCardModel = (
  creator: CreatorDirectoryRow,
  stream: TwitchStream | undefined
): CreatorCardModel => ({
  id: creator.user_id,
  handle: creator.handle,
  displayName: creator.display_name ?? creator.handle,
  verified: false,
  bio: creator.bio ?? "",
  tags: creator.tags,
  specialties: creator.specialties,
  commissionStatus: creator.listing_count > 0 ? "open" : "closed",
  platforms: {
    twitch: creator.twitch_login
      ? {
        login: creator.twitch_login,
        userId: creator.twitch_user_id ?? undefined,
      }
      : undefined,
    youtube: creator.youtube_user_id
      ? {
        channelId: creator.youtube_user_id,
        handle: creator.youtube_login ?? undefined,
      }
      : undefined,
  },
  links: {
    twitch: creator.twitch_url ?? undefined,
    youtube: creator.youtube_url ?? undefined,
  },
  live: creator.twitch_user_id
    ? {
      isLive: Boolean(stream),
      title: stream?.title,
      platform: "twitch",
    }
    : undefined,
});
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
  const q = useDebouncedValue(filters.q.trim());
  const liveLogins = useMemo(() => Object.keys(twitchByLogin).sort(), [twitchByLogin]);

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCreatorDirectory({
    q,
    onlyOpen: filters.onlyOpen,
    logins: filters.onlyLive ? liveLogins : null,
  });

  const t = useT();

  const creators = useMemo(
    () =>
      (data?.pages ?? [])
        .flatMap((page) => page.rows)
        .map((creator) =>
          toCreatorCardModel(
            creator,
            creator.twitch_login
              ? twitchByLogin[normalizeTwitchLogin(creator.twitch_login)]
              : undefined
          )
        ),
    [data, twitchByLogin]
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

      {!isLoading && !error && creators.length === 0 && (
        <div className={classes.emptyText}>{t("creators.empty")}</div>
      )}

      <StaggerGroup className={classes.cardsGrid} itemCount={creators.length}>
        {creators.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} />
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

export default CreatorsPage;