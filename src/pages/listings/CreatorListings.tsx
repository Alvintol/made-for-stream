import { Link } from "react-router-dom";
import { formatListingPrice } from "../../lib/money/displayCurrency";
import { useMyListings, type MyListingRow } from "../../hooks/listings/useMyListings";
import { useDeleteListingDraft } from '../../hooks/listings/useDeleteListingDraft';
import { getListingVisibilityLabel, isAdminHiddenListing } from '../../domain/listings/listings';
import { dateLocale, useLanguage, useT, wordFor, type Translate } from "../../lib/i18n/i18n";
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
const priceText = (listing: MyListingRow, t: Translate): string =>
  formatListingPrice(listing, t("price.from"));

// Formats the last updated date into a readable local date string
const updatedText = (value: string, locale: string | undefined): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const CreatorListings = () => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const { data, isLoading, error } = useMyListings();

  const deleteDraftMutation = useDeleteListingDraft();

  const handleDeleteDraft = async (listingId: string, title: string) => {
    const confirmed = window.confirm(
      t("myListings.confirmDelete", { title })
    );

    if (!confirmed) return;

    try {
      await deleteDraftMutation.mutateAsync(listingId);
    } catch {
      // Surface a generic message in the page instead of throwing
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>{t("common.loading")}</div>;
  }

  return (
    <div className={classes.page}>
      <Link to="/creator/dashboard" className={classes.backLink}>
        ← {t("myListings.back")}
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>{t("dashboard.linkListings")}</h1>

        <p className={classes.sub}>{t("myListings.text")}</p>
      </div>

      <div className={classes.row}>
        <Link className={classes.btnPrimary} to="/creator/listings/new">
          {t("dashboard.create")}
        </Link>
      </div>

      {error && (
        <div className={classes.errorCard}>
          {t("myListings.loadFailed")}
        </div>
      )}

      {deleteDraftMutation.error && (
        <div className={classes.errorCard}>
          {t("myListings.deleteFailed")}
        </div>
      )}

      {!error && (data?.length ?? 0) === 0 && (
        <div className={classes.emptyCard}>
          <h2 className={classes.cardTitle}>{t("myListings.emptyTitle")}</h2>

          <p className={classes.cardText}>{t("myListings.emptyText")}</p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/creator/listings/new">
              {t("myListings.createFirst")}
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
                    <p className={classes.cardText}>{priceText(listing, t)}</p>
                  </div>

                  <div className={classes.metaRow}>
                    {listing.status === "draft" ? (
                      <span className={classes.draftPill}>{t("listingStatus.draft")}</span>
                    ) : (
                      <span className={classes.pill}>{t("listingStatus.published")}</span>
                    )}

                    {isAdminHidden ? (
                      <span className={classes.adminHiddenPill}>
                        {getListingVisibilityLabel(listing, t)}
                      </span>
                    ) : listing.is_active ? (
                      <span className={classes.activePill}>
                        {getListingVisibilityLabel(listing, t)}
                      </span>
                    ) : (
                      <span className={classes.inactivePill}>
                        {getListingVisibilityLabel(listing, t)}
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
                  <div className={classes.thumbEmpty}>{t("myListings.noPreview")}</div>
                )}

                <p className={classes.cardText}>{listing.short}</p>

                {isAdminHidden && (
                  <p className={classes.warningText}>
                    {t("myListings.hiddenWarning")}
                  </p>
                )}

                <div className={classes.metaRow}>
                  <span className={classes.pill}>{wordFor("offering", listing.offering_type, t)}</span>
                  <span className={classes.pill}>{wordFor("category", listing.category, t)}</span>

                  {listing.video_subtype && (
                    <span className={classes.pill}>{wordFor("video", listing.video_subtype, t)}</span>
                  )}
                </div>

                <div className={classes.footer}>
                  <div className={classes.dateText}>
                    {t("myListings.updated", { date: updatedText(listing.updated_at, locale) })}
                  </div>

                  <div className={classes.row}>
                    <Link
                      className={classes.btnOutline}
                      to={`/creator/listings/${listing.id}`}
                    >
                      {t("nextCard.viewDetails")}
                    </Link>

                    {isAdminHidden ? (
                      <button className={classes.btnDisabled} type="button" disabled>
                        {t("myListings.lockedByAdmin")}
                      </button>
                    ) : canEditDraft ? (
                      <>
                        <Link
                          className={classes.btnOutline}
                          to={`/creator/listings/${listing.id}/edit`}
                        >
                          {t("myListings.editDraft")}
                        </Link>

                        <button
                          className={classes.btnDanger}
                          type="button"
                          onClick={() => handleDeleteDraft(listing.id, listing.title)}
                          disabled={deleteDraftMutation.isPending}
                        >
                          {t(deleteDraftMutation.isPending ? "myListings.deleting" : "myListings.deleteDraft")}
                        </button>
                      </>
                    ) : (
                      <span className={classes.btnDisabled}>{t("myListings.editLater")}</span>
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