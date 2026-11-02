import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES, type CategoryKey } from "../domain/catalog";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { useLiveCreators, type CreatorDirectoryRow } from "../hooks/useCreatorDirectory";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { StaggerGroup } from "../lib/motion";

type PlatformFilter = "all" | "twitch" | "youtube";

// ponytail: the most-watched 48 are shown, and search covers only those. Add
// paging when more than 48 linked creators are regularly live at once.
const LIVE_CARD_COUNT = 48;
const classes = {
  page: "space-y-5",

  headerWrap: "space-y-1",
  h1: "pageTitle",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-2",
  select: "searchInput",

  errorCard:
    "card border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.20)] p-4",
  errorTitle: "text-sm font-semibold text-zinc-900",
  errorText: "mt-1 text-sm text-zinc-700",

  emptyCard: "card p-6",
  emptyTitle: "font-display text-base font-extrabold tracking-tight",
  emptyText: "mt-2 text-sm text-zinc-600",
  emptyActions: "mt-4 flex flex-wrap gap-3",
  btnOutline: "btnOutline",
  btnPrimary: "btnPrimary",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  card: "card p-4",
  cardLink: "block",

  thumb: "mb-3 h-40 w-full rounded-2xl object-cover",
  topRow: "flex flex-wrap items-center gap-2",
  name: "font-display text-base font-extrabold tracking-tight",
  badgeLive: "badge badgeLive",

  title: "mt-2 text-sm text-zinc-600",
  meta: "mt-2 text-xs text-zinc-500",

  specialtiesRow: "mt-3 flex flex-wrap gap-2",
  specPill: "chip px-2 py-0.5 text-xs",

  actionsRow: "mt-4 flex flex-wrap gap-2",
} as const;

// Converts a category key into its display label
const categoryLabel = (key: string): string =>
  CATEGORIES.find((category) => category.key === key)?.label ?? key;

const getCreatorName = (creator: CreatorDirectoryRow): string =>
  creator.display_name ?? creator.handle;

// Builds a search haystack for live creator filtering
const getSearchHaystack = (creator: CreatorDirectoryRow, stream: TwitchStream): string =>
  [
    getCreatorName(creator),
    creator.handle,
    creator.bio ?? "",
    ...creator.tags,
    ...creator.specialties.map(categoryLabel),
    stream.title ?? "",
    stream.gameName ?? "",
  ]
    .join(" ")
    .toLowerCase();

const getTwitchWatchUrl = (creator: CreatorDirectoryRow, stream: TwitchStream): string =>
  creator.twitch_url ??
  `https://twitch.tv/${encodeURIComponent(normalizeTwitchLogin(stream.login))}`;
const Live = () => {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  const { twitchByLogin, isFetching, error } = useTwitchStreams();
  const liveCreators = useLiveCreators(twitchByLogin, LIVE_CARD_COUNT);

  const liveNow = useMemo(() => {
    const searchValue = q.trim().toLowerCase();

    return liveCreators
      .filter(() => platform === "all" || platform === "twitch")
      .filter(({ creator, stream }) =>
        searchValue ? getSearchHaystack(creator, stream).includes(searchValue) : true
      );
  }, [liveCreators, platform, q]);
  const onPlatformChange = (event: ChangeEvent<HTMLSelectElement>) =>
    setPlatform(event.currentTarget.value as PlatformFilter);

  const errorMsg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error
        ? String(error)
        : null;

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Live now</h1>

        <p className={classes.subtitle}>
          Real-time Twitch live status. {isFetching ? "Refreshing…" : ""}
        </p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={q}
          onChange={(event) => setQ(event.currentTarget.value)}
          placeholder="Search live creators (name, tags, title, specialties...)"
        />

        <select
          className={classes.select}
          value={platform}
          onChange={onPlatformChange}
        >
          <option value="all">All platforms</option>
          <option value="twitch">Twitch</option>
          <option value="youtube" disabled>
            YouTube (next)
          </option>
        </select>
      </div>

      {errorMsg && (
        <div className={classes.errorCard}>
          <div className={classes.errorTitle}>Live status unavailable</div>
          <div className={classes.errorText}>{errorMsg}</div>
        </div>
      )}

      {liveNow.length === 0 ? (
        <div className={classes.emptyCard}>
          <div className={classes.emptyTitle}>No one is live right now</div>

          <p className={classes.emptyText}>
            No linked Twitch creators are live at the moment.
          </p>

          <div className={classes.emptyActions}>
            <Link to="/creators" className={classes.btnOutline}>
              Browse creators
            </Link>

            <Link to="/market" className={classes.btnPrimary}>
              Browse market
            </Link>
          </div>
        </div>
      ) : (
        <StaggerGroup className={classes.grid} itemCount={liveNow.length}>
          {liveNow.map(({ creator, stream }) => {
            const thumb =
              stream.thumbnailUrl
                ?.replace("{width}", "640")
                .replace("{height}", "360") ?? "";

            const creatorName = getCreatorName(creator);

            return (
              <div key={creator.user_id} className={classes.card}>
                <Link to={`/creator/${creator.handle}`} className={classes.cardLink}>
                  {Boolean(thumb) && (
                    <img
                      src={thumb}
                      alt=""
                      className={classes.thumb}
                      loading="lazy"
                    />
                  )}

                  <div className={classes.topRow}>
                    <div className={classes.name}>{creatorName}</div>
                    <span className={classes.badgeLive}>Live</span>
                  </div>

                  <p className={classes.title}>{stream.title ?? ""}</p>

                  <p className={classes.meta}>
                    {stream.gameName ?? ""} • {stream.viewerCount ?? 0} viewers
                  </p>

                  {creator.specialties.length > 0 && (
                    <div className={classes.specialtiesRow}>
                      {creator.specialties.slice(0, 4).map((specialty) => (
                        <span key={specialty} className={classes.specPill}>
                          {categoryLabel(specialty)}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                <div className={classes.actionsRow}>
                  <Link to={`/creator/${creator.handle}`} className={classes.btnOutline}>
                    View profile
                  </Link>

                  <a
                    className={classes.btnPrimary}
                    href={getTwitchWatchUrl(creator, stream)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Watch ${creatorName} live on Twitch`}
                  >
                    Watch live
                  </a>
                </div>
              </div>
            );
          })}
        </StaggerGroup>
      )}
    </div>
  );
};

export default Live;