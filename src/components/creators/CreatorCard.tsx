import { Link } from "react-router-dom";
import FavouriteButton from '../layout/FavouriteButton';
import { useT } from "../../lib/i18n/i18n";
import type { MessageKey } from "../../lib/i18n/messages/en";
const classes = {
  card: "card group relative flex flex-col overflow-hidden hover:-translate-y-0.5",
  favWrap: "absolute right-3 top-3 z-10",

  cover:
    "h-16 bg-[radial-gradient(120%_140%_at_0%_0%,rgb(var(--accent)/0.3),transparent_60%),radial-gradient(120%_140%_at_100%_0%,rgb(var(--brand)/0.22),transparent_55%)] transition duration-500 group-hover:opacity-90",
  body: "flex flex-1 flex-col px-4 pb-4",
  avatar:
    "-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-[rgb(var(--surface))] bg-gradient-to-br from-[rgb(var(--primary-strong))] to-[rgb(var(--primary))] font-display text-lg font-bold uppercase text-[rgb(var(--on-primary))] shadow-sm",

  titleRow: "mt-3 flex flex-wrap items-center gap-2",
  h3: "font-display text-base font-bold tracking-tight",

  badgeBase: "badge",
  badgeVerified: "badgeFeatured",
  badgeLive: "badgeLive",

  bio: "mt-1.5 line-clamp-2 text-sm leading-6 text-zinc-600",

  metaRow: "mt-auto flex flex-wrap items-center gap-2 pt-4",
  statusBase:
    "inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] px-2.5 py-1 text-xs font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current",

  tagsWrap: "flex flex-wrap gap-1.5",
  tag: "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700",
} as const;

export type CreatorCardModel = {
  id: string;
  handle: string;
  displayName: string;
  verified: boolean;
  bio: string;
  tags?: string[];
  specialties?: string[];
  commissionStatus: string;
  platforms?: {
    twitch?: {
      login: string;
      userId?: string;
    };
    youtube?: {
      channelId: string;
      handle?: string;
    };
  };
  links?: {
    twitch?: string;
    youtube?: string;
  };
  live?: {
    isLive: boolean;
    title?: string;
    platform?: "twitch" | "youtube";
  };
};

// Maps commission status to its matching text colour
const getCommissionStatusClass = (status: CreatorCardModel["commissionStatus"]): string =>
  status === "open"
    ? "text-emerald-600"
    : status === "limited"
      ? "text-amber-700"
      : "text-rose-700";

type CreatorCardProps = {
  creator: CreatorCardModel;
};

const CreatorCard = ({ creator }: CreatorCardProps) => {
  const isLive = Boolean(creator.live?.isLive);
  const t = useT();
  const commissionClass = `${classes.statusBase} ${getCommissionStatusClass(
    creator.commissionStatus
  )}`;

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      <div className={classes.favWrap}>
        {/* Favourites must use the stable internal creator id, not the handle */}
        <FavouriteButton kind="creator" targetId={creator.id} />
      </div>

      <div className={classes.cover} aria-hidden="true" />

      <div className={classes.body}>
        <div className={classes.avatar} aria-hidden="true">
          {creator.displayName.charAt(0)}
        </div>

        <div className={classes.titleRow}>
          <h3 className={classes.h3}>{creator.displayName}</h3>

          {creator.verified && (
            <span className={`${classes.badgeBase} ${classes.badgeVerified}`}>
              {t("common.verified")}
            </span>
          )}

          {isLive && (
            <span className={`${classes.badgeBase} ${classes.badgeLive}`}>
              {t("common.live")}
            </span>
          )}
        </div>

        <p className={classes.bio}>{creator.bio}</p>

        <div className={classes.metaRow}>
          <span className={commissionClass}>
            {t("creatorCard.commissions", {
              status: ["open", "limited", "closed"].includes(creator.commissionStatus)
                ? t(`commissionStatus.${creator.commissionStatus}` as MessageKey)
                : creator.commissionStatus,
            })}
          </span>

          <div className={classes.tagsWrap}>
            {(creator.tags ?? []).slice(0, 4).map((tag) => (
              <span key={tag} className={classes.tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CreatorCard;