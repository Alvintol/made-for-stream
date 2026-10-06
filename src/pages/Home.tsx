import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "../domain/catalog";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { useMarketListings, type MarketListingItem } from "../hooks/listings/useMarketListings";
import { usePublicCreators, type PublicCreatorItem } from "../hooks/usePublicCreators";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { StaggerGroup } from "../lib/motion";
import HeroParallax from "../components/home/HeroParallax";

const classes = {
  page: "space-y-16",

  section: "space-y-5",
  headerRow: "flex items-end justify-between gap-4",
  eyebrow:
    "text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--accent-text))]",
  h2: "font-display text-2xl font-bold tracking-tight",
  linkSubtle:
    "shrink-0 text-sm font-semibold text-zinc-600 transition hover:text-[rgb(var(--accent-text))]",

  heroTileFallback:
    "h-full w-full bg-[radial-gradient(120%_120%_at_0%_0%,rgb(var(--accent)/0.35),transparent_60%),radial-gradient(120%_120%_at_100%_100%,rgb(var(--brand)/0.3),transparent_55%)]",

  grid: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",

  card: "card group relative flex flex-col overflow-hidden hover:-translate-y-0.5",
  media: "relative aspect-[16/10] overflow-hidden bg-zinc-100",
  mediaImg:
    "h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]",
  mediaBadges: "absolute left-3 top-3 flex flex-wrap gap-1.5",
  cardBody: "flex flex-1 flex-col p-4",

  badge: "badge",
  badgeFeatured: "badge badgeFeatured",
  badgeLive: "badge badgeLive",

  featuredTop: "flex items-start justify-between gap-3",
  featuredTitleWrap: "min-w-0",
  featuredTitle: "font-display truncate text-base font-bold tracking-tight",
  featuredMeta: "mt-0.5 text-xs font-medium text-zinc-500",
  featuredPrice:
    "shrink-0 rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-sm font-semibold text-[rgb(var(--accent-text))]",
  featuredShort: "mt-2 line-clamp-2 text-sm leading-6 text-zinc-600",
  featuredBy: "mt-auto flex items-center gap-2 pt-4 text-sm text-zinc-600",
  featuredAvatar:
    "flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold uppercase text-zinc-700",
  featuredByName: "font-semibold text-zinc-900",

  liveRow: "flex flex-wrap items-center gap-2",
  liveTitle: "font-display text-base font-bold tracking-tight",
  liveDesc: "mt-1.5 line-clamp-2 text-sm text-zinc-600",
  liveMeta: "mt-auto pt-3 text-xs font-medium text-zinc-500",

  liveErrorCard: "notice noticeWarning",
  liveErrorTitle: "text-sm font-semibold",
  liveErrorBody: "mt-1 text-sm",

  loadingText: "text-sm text-zinc-600",
  emptyText: "notice noticeNeutral",
} as const;

// Fast lookup map for category labels by key
const categoryLabels = Object.fromEntries(
  CATEGORIES.map((category) => [category.key, category.label])
) as Record<string, string>;

// Converts a category key into its display label
const categoryLabel = (key: string): string => categoryLabels[key] ?? key;

// Converts offering type into a small display pill label
const offeringPill = (offeringType: string): string =>
  offeringType === "digital"
    ? "Digital"
    : offeringType === "commission"
      ? "Commission"
      : offeringType === "service"
        ? "Service"
        : offeringType;

// Formats listing price text for display
const priceText = (item: MarketListingItem["listing"]): string =>
  item.price_type === "fixed"
    ? `$${item.price_min}`
    : item.price_type === "starting_at"
      ? `From $${item.price_min}`
      : item.price_type === "range"
        ? `$${item.price_min}–$${item.price_max ?? item.price_min}`
        : "";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  to: string;
  linkText: string;
};

const SectionHeader = ({ eyebrow, title, to, linkText }: SectionHeaderProps) => (
  <div className={classes.headerRow}>
    <div>
      <div className={classes.eyebrow}>{eyebrow}</div>
      <h2 className={classes.h2}>{title}</h2>
    </div>

    <Link to={to} className={classes.linkSubtle}>
      {linkText}
    </Link>
  </div>
);

// The hero's artwork is fixed placeholder art, not creators' listings. It
// used to take the three newest listings' images, so whatever a creator
// published last became the site's front-page art (noticed 2026-10-06).
// Replace these with brand artwork when it exists (rebrand assets).
const HERO_PLACEHOLDER_URLS = [
  "https://picsum.photos/seed/emotes/960/540",
  "https://picsum.photos/seed/overlay/960/540",
  "https://picsum.photos/seed/pngtuber/960/540",
];

type FeaturedListingCardProps = {
  item: MarketListingItem;
};

const FeaturedListingCard = ({ item }: FeaturedListingCardProps) => {
  const { listing, creator } = item;

  const videoSuffix =
    listing.category === "video-editing" && listing.video_subtype
      ? ` • ${listing.video_subtype === "long-form" ? "Long Form" : "Short Form"}`
      : "";

  const creatorName = creator?.display_name ?? creator?.handle ?? "Unknown creator";

  return (
    <Link to={`/listing/${listing.id}`} className={classes.card}>
      <div className={classes.media}>
        {listing.preview_url ? (
          <img
            src={listing.preview_url}
            alt=""
            className={classes.mediaImg}
            loading="lazy"
          />
        ) : (
          <div className={classes.heroTileFallback} />
        )}

        <div className={classes.mediaBadges}>
          <span className={classes.badge}>{offeringPill(listing.offering_type)}</span>
          <span className={classes.badgeFeatured}>Featured</span>
        </div>
      </div>

      <div className={classes.cardBody}>
        <div className={classes.featuredTop}>
          <div className={classes.featuredTitleWrap}>
            <div className={classes.featuredTitle}>{listing.title}</div>

            <div className={classes.featuredMeta}>
              {categoryLabel(listing.category)}
              {videoSuffix}
            </div>
          </div>

          <div className={classes.featuredPrice}>{priceText(listing)}</div>
        </div>

        <p className={classes.featuredShort}>{listing.short}</p>

        <div className={classes.featuredBy}>
          <span className={classes.featuredAvatar} aria-hidden="true">
            {creatorName.charAt(0)}
          </span>
          <span>
            by <span className={classes.featuredByName}>{creatorName}</span>
          </span>
        </div>
      </div>
    </Link>
  );
};

type FeaturedSectionProps = {
  featuredListings: MarketListingItem[];
  isLoading: boolean;
};

const FeaturedSection = ({ featuredListings, isLoading }: FeaturedSectionProps) => (
  <section className={classes.section}>
    <SectionHeader
      eyebrow="Handpicked"
      title="Featured"
      to="/market"
      linkText="Browse market →"
    />

    {isLoading ? (
      <p className={classes.loadingText}>Loading featured listings…</p>
    ) : featuredListings.length === 0 ? (
      <p className={classes.emptyText}>No listings available yet.</p>
    ) : (
      <StaggerGroup className={classes.grid} itemCount={featuredListings.length}>
        {featuredListings.map((item) => (
          <FeaturedListingCard key={item.listing.id} item={item} />
        ))}
      </StaggerGroup>
    )}
  </section>
);

type LiveNowItem = {
  creator: PublicCreatorItem["profile"];
  verified: boolean;
  stream: TwitchStream;
};

type LiveCreatorCardProps = LiveNowItem;

const LiveCreatorCard = ({ creator, verified, stream }: LiveCreatorCardProps) => {
  const thumb =
    stream.thumbnailUrl
      ?.replace("{width}", "640")
      .replace("{height}", "360") ?? "";

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      <div className={classes.media}>
        {thumb ? (
          <img src={thumb} alt="" className={classes.mediaImg} loading="lazy" />
        ) : (
          <div className={classes.heroTileFallback} />
        )}

        <div className={classes.mediaBadges}>
          <span className={classes.badgeLive}>Live</span>
          {verified && <span className={classes.badge}>Verified</span>}
        </div>
      </div>

      <div className={classes.cardBody}>
        <div className={classes.liveRow}>
          <div className={classes.liveTitle}>
            {creator.display_name ?? creator.handle ?? "Creator"}
          </div>
        </div>

        <p className={classes.liveDesc}>{stream.title ?? ""}</p>

        <p className={classes.liveMeta}>
          Twitch • {stream.viewerCount ?? 0} viewers
          {stream.gameName ? ` • ${stream.gameName}` : ""}
        </p>
      </div>
    </Link>
  );
};

type LiveNowSectionProps = {
  liveNow: LiveNowItem[];
  isFetching: boolean;
  errorMsg: string | null;
};

const LiveNowSection = ({ liveNow, isFetching, errorMsg }: LiveNowSectionProps) => (
  <section className={classes.section}>
    <SectionHeader
      eyebrow="On air"
      title="Live now"
      to="/live"
      linkText="View all →"
    />

    {errorMsg && (
      <div className={classes.liveErrorCard}>
        <div className={classes.liveErrorTitle}>Live status unavailable</div>
        <div className={classes.liveErrorBody}>{errorMsg}</div>
      </div>
    )}

    {liveNow.length === 0 ? (
      <p className={classes.emptyText}>
        {isFetching ? "Checking live status…" : "No one is live right now."}
      </p>
    ) : (
      <StaggerGroup className={classes.grid} itemCount={Math.min(liveNow.length, 6)}>
        {liveNow.slice(0, 6).map(({ creator, verified, stream }) => (
          <LiveCreatorCard
            key={creator.user_id}
            creator={creator}
            verified={verified}
            stream={stream}
          />
        ))}
      </StaggerGroup>
    )}
  </section>
);

const Home = () => {
  const { twitchByLogin, isFetching, error } = useTwitchStreams();
  const {
    data: marketItems = [],
    isLoading: isLoadingMarket,
  } = useMarketListings();
  const {
    data: creatorItems = [],
  } = usePublicCreators();

  const errorMsg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error
        ? String(error)
        : null;

  const liveNow = useMemo<LiveNowItem[]>(
    () =>
      creatorItems
        .map((item) => {
          const twitchAccount =
            item.platformAccounts.find((account) => account.platform === "twitch") ?? null;

          const loginRaw = twitchAccount?.platform_login ?? null;
          const login = loginRaw ? normalizeTwitchLogin(loginRaw) : null;
          const stream = login ? twitchByLogin[login] : undefined;

          return stream
            ? {
              creator: item.profile,
              verified: false,
              stream,
            }
            : null;
        })
        .filter((value): value is LiveNowItem => Boolean(value))
        .sort((a, b) => (b.stream.viewerCount ?? 0) - (a.stream.viewerCount ?? 0)),
    [creatorItems, twitchByLogin]
  );

  // Until listings have a dedicated featured flag in the db,
  // use the first public listings returned by the market query.
  const featuredListings = marketItems.slice(0, 6);


  return (
    <div className={classes.page}>
      <HeroParallax previewUrls={HERO_PLACEHOLDER_URLS} />
      <FeaturedSection
        featuredListings={featuredListings}
        isLoading={isLoadingMarket}
      />
      <LiveNowSection
        liveNow={liveNow}
        isFetching={isFetching}
        errorMsg={errorMsg}
      />
    </div>
  );
};

export default Home;
