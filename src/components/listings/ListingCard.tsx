import FavouriteButton from "../layout/FavouriteButton";
import ListingPriceText from "./ListingPriceText";
import { Link } from "react-router-dom";

const classes = {
  card: "card group relative flex flex-col overflow-hidden hover:-translate-y-0.5",
  favWrap: "absolute right-3 top-3 z-10",

  media: "relative aspect-[16/10] overflow-hidden bg-zinc-100",
  img: "h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]",
  placeholder:
    "h-full w-full bg-[radial-gradient(120%_120%_at_0%_0%,rgb(var(--accent)/0.28),transparent_60%),radial-gradient(120%_120%_at_100%_100%,rgb(var(--brand)/0.22),transparent_55%)]",
  shade:
    "pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition duration-300 group-hover:opacity-100",
  badges: "absolute left-3 top-3 flex flex-wrap gap-1.5",
  badge: "badge capitalize",
  liveBadge: "badge badgeLive",

  body: "flex flex-1 flex-col p-4",
  h3: "font-display line-clamp-1 text-base font-bold tracking-tight",
  desc: "mt-1.5 line-clamp-2 text-sm leading-6 text-zinc-600",

  bottomRow: "mt-auto flex items-center justify-between gap-3 pt-4",
  price:
    "rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-sm font-semibold text-[rgb(var(--accent-text))]",
  freePrice:
    "rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-800",
  creatorWrap: "flex min-w-0 items-center gap-2",
  avatar:
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold uppercase text-zinc-700",
  creator: "truncate text-sm text-zinc-600",
} as const;

export type ListingCardListing = {
  id: string;
  title: string;
  short: string;
  offering_type: string;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  currency?: string | null;
  preview_url: string | null;
  is_free?: boolean;
};

export type ListingCardCreator = {
  name: string;
  isLive?: boolean;
};

type ListingCardProps = {
  listing: ListingCardListing;
  creator: ListingCardCreator;
};

const ListingCard = ({ listing, creator }: ListingCardProps) => {
  const creatorLabel = creator.isLive ? `${creator.name} • Live` : creator.name;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.card}>
      <div className={classes.favWrap}>
        <FavouriteButton kind="listing" targetId={listing.id} />
      </div>

      <div className={classes.media}>
        {listing.preview_url ? (
          <img
            src={listing.preview_url}
            alt=""
            className={classes.img}
            loading="lazy"
          />
        ) : (
          <div className={classes.placeholder} />
        )}

        <div className={classes.shade} />

        <div className={classes.badges}>
          <span className={classes.badge}>{listing.offering_type}</span>

          {listing.is_free && <span className={classes.badge}>Free</span>}

          {creator.isLive && <span className={classes.liveBadge}>Live</span>}
        </div>
      </div>

      <div className={classes.body}>
        <h3 className={classes.h3}>{listing.title}</h3>

        <p className={classes.desc}>{listing.short}</p>

        <div className={classes.bottomRow}>
          <span className={classes.creatorWrap}>
            <span className={classes.avatar} aria-hidden="true">
              {creator.name.charAt(0)}
            </span>
            <span className={classes.creator}>{creatorLabel}</span>
          </span>

          {listing.is_free ? (
            <span className={classes.freePrice}>$0</span>
          ) : (
            <span className={classes.price}>
              <ListingPriceText listing={listing} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;