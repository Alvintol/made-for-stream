import { Link } from "react-router-dom";
import { formatListingPrice } from "../../lib/money/displayCurrency";
import { useMyListings, type MyListingRow } from "../../hooks/listings/useMyListings";
import { useDeleteListingDraft } from '../../hooks/listings/useDeleteListingDraft';
import { getListingVisibilityLabel, isAdminHiddenListing } from '../../domain/listings/listings';

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",
  backLink: "backLink",

  grid: "grid gap-4 lg:grid-cols-2",
  card: "card p-5",
  emptyCard: "card p-8 text-center",

  cardTop: "flex items-start justify-between gap-3",
  cardTitleWrap: "space-y-1",
  cardTitle: "font-display text-lg font-extrabold tracking-tight",
  cardText: "text-sm text-zinc-600",

  thumb:
    "h-40 w-full rounded-2xl border border-zinc-200 bg-zinc-100 object-cover",
  thumbEmpty:
    "flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-500",

  metaRow: "flex flex-wrap gap-2",
  pill: "chip",
  draftPill:
    "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",
  activePill:
    "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  inactivePill:
    "rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  adminHiddenPill:
    "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800",

  footer: "flex flex-wrap items-center justify-between gap-3",
  dateText: "text-xs text-zinc-500",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  btnDisabled:
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-500",
  btnDanger:
    "btnDangerOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",
  warningText:
    "notice noticeWarning",
} as const;

// Formats the listing price for creator-facing cards
const priceText = (listing: MyListingRow): string => formatListingPrice(listing);

// Formats the last updated date into a readable local date string
const updatedText = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const CreatorListings = () => {
  const { data, isLoading, error } = useMyListings();

  const deleteDraftMutation = useDeleteListingDraft();

  const handleDeleteDraft = async (listingId: string, title: string) => {
    const confirmed = window.confirm(
      `Delete draft listing "${title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteDraftMutation.mutateAsync(listingId);
    } catch {
      // Surface a generic message in the page instead of throwing
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  return (
    <div className={classes.page}>
      <Link to="/creator/dashboard" className={classes.backLink}>
        ← Back to creator dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>My listings</h1>

        <p className={classes.sub}>
          View your private drafts and future published listings in one place.
        </p>
      </div>

      <div className={classes.row}>
        <Link className={classes.btnPrimary} to="/creator/listings/new">
          Create listing
        </Link>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Your listings could not be loaded right now.
        </div>
      )}

      {deleteDraftMutation.error && (
        <div className={classes.errorCard}>
          This draft could not be deleted right now.
        </div>
      )}

      {!error && (data?.length ?? 0) === 0 && (
        <div className={classes.emptyCard}>
          <h2 className={classes.cardTitle}>No listings yet</h2>

          <p className={classes.cardText}>
            Your draft listings will appear here after you create them.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/creator/listings/new">
              Create your first listing
            </Link>
          </div>
        </div>
      )}

      {(data?.length ?? 0) > 0 && (
        <div className={classes.grid}>
          {data?.map((listing) => {
            const isAdminHidden = isAdminHiddenListing(listing);
            const canEditDraft =
              listing.status === "draft" && !listing.is_active && !isAdminHidden;

            return (
              <div key={listing.id} className={classes.card}>
                <div className={classes.cardTop}>
                  <div className={classes.cardTitleWrap}>
                    <h2 className={classes.cardTitle}>{listing.title}</h2>
                    <p className={classes.cardText}>{priceText(listing)}</p>
                  </div>

                  <div className={classes.metaRow}>
                    {listing.status === "draft" ? (
                      <span className={classes.draftPill}>Draft</span>
                    ) : (
                      <span className={classes.pill}>Published</span>
                    )}

                    {isAdminHidden ? (
                      <span className={classes.adminHiddenPill}>
                        {getListingVisibilityLabel(listing)}
                      </span>
                    ) : listing.is_active ? (
                      <span className={classes.activePill}>
                        {getListingVisibilityLabel(listing)}
                      </span>
                    ) : (
                      <span className={classes.inactivePill}>
                        {getListingVisibilityLabel(listing)}
                      </span>
                    )}
                  </div>
                </div>

                {listing.preview_url ? (
                  <img
                    src={listing.preview_url}
                    alt=""
                    className={classes.thumb}
                    loading="lazy"
                  />
                ) : (
                  <div className={classes.thumbEmpty}>No preview image</div>
                )}

                <p className={classes.cardText}>{listing.short}</p>

                {isAdminHidden && (
                  <p className={classes.warningText}>
                    This listing has been hidden by moderation and cannot be edited, restored,
                    published, or deleted until an admin reviews it.
                  </p>
                )}

                <div className={classes.metaRow}>
                  <span className={classes.pill}>{listing.offering_type}</span>
                  <span className={classes.pill}>{listing.category}</span>

                  {listing.video_subtype && (
                    <span className={classes.pill}>{listing.video_subtype}</span>
                  )}
                </div>

                <div className={classes.footer}>
                  <div className={classes.dateText}>
                    Updated: {updatedText(listing.updated_at)}
                  </div>

                  <div className={classes.row}>
                    <Link
                      className={classes.btnOutline}
                      to={`/creator/listings/${listing.id}`}
                    >
                      View details
                    </Link>

                    {isAdminHidden ? (
                      <button className={classes.btnDisabled} type="button" disabled>
                        Locked by admin
                      </button>
                    ) : canEditDraft ? (
                      <>
                        <Link
                          className={classes.btnOutline}
                          to={`/creator/listings/${listing.id}/edit`}
                        >
                          Edit draft
                        </Link>

                        <button
                          className={classes.btnDanger}
                          type="button"
                          onClick={() => handleDeleteDraft(listing.id, listing.title)}
                          disabled={deleteDraftMutation.isPending}
                        >
                          {deleteDraftMutation.isPending ? "Deleting…" : "Delete draft"}
                        </button>
                      </>
                    ) : (
                      <span className={classes.btnDisabled}>Edit later</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CreatorListings;