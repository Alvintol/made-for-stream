import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useInfiniteListingRevisions,
  type ListingRevisionRow,
} from "../../hooks/listings/useListingRevisions";
import { useMyListing } from "../../hooks/listings/useMyListing";
import {
  getListingRevisionChanges,
  revisionPriceText,
  revisionStatusText,
} from '../../lib/listings/listingRevisionDiff';
import { dateLocale, useLanguage, useT, wordFor } from "../../lib/i18n/i18n";
import ListingRevisionChangeText from "../../components/listings/ListingRevisionChangeText";

const classes = {
  page: "space-y-6",
  backLink: "backLink",

  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "sectionHeading",
  text: "text-sm text-zinc-600",

  revisionList: "space-y-3",
  revisionItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  revisionTop: "flex flex-wrap items-center justify-between gap-3",
  revisionTitle: "text-sm font-bold text-zinc-900",
  revisionMeta: "text-xs text-zinc-500",
  revisionBody: "mt-3 space-y-2",
  revisionText: "text-sm text-zinc-700",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",

  changeList: "mt-3 space-y-2",
  changeItem:
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700",
} as const;

const revisionEventKey = (eventType: ListingRevisionRow["event_type"]) =>
  eventType === "created"
    ? "revision.event.created"
    : eventType === "updated"
      ? "revision.event.updated"
      : eventType === "published"
        ? "revision.event.published"
        : eventType === "deactivated"
          ? "revision.event.deactivated"
          : eventType === "reactivated"
            ? "revision.event.reactivated"
            : "revision.event.moved";

const revisionDateText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const CreatorListingRevisions = () => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const { id } = useParams<{ id: string }>();

  const { data: listing, isLoading: isLoadingListing, error: listingError } =
    useMyListing(id ?? null);

  const {
    data,
    isLoading: isLoadingRevisions,
    error: revisionsError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteListingRevisions(id ?? null, 3);

  const revisionRows = useMemo(
    () => data?.pages.flatMap((page) => page.rows) ?? [],
    [data]
  );

  if (isLoadingListing) {
    return <div className={classes.loadingText}>{t("common.loading")}</div>;
  }

  if (listingError || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← {t("listingForm.back")}
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>{t("listingForm.notFound")}</h1>
          <p className={classes.sub}>{t("listingForm.notFoundText")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <Link to={`/creator/listings/${listing.id}`} className={classes.backLink}>
        ← {t("revision.back")}
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>{t("revision.title")}</h1>

        <p className={classes.sub}>{t("revision.sub", { title: listing.title })}</p>
      </div>

      <div className={classes.card}>
        {revisionsError && (
          <div className={classes.errorCard}>
            {t("revision.loadFailed")}
          </div>
        )}

        {isLoadingRevisions && revisionRows.length === 0 && (
          <div className={classes.loadingText}>{t("revision.loading")}</div>
        )}

        {!isLoadingRevisions && !revisionsError && revisionRows.length === 0 && (
          <p className={classes.text}>{t("revision.none")}</p>
        )}

        {revisionRows.length > 0 && (
          <div className={classes.section}>
            <div className={classes.revisionList}>
              {revisionRows.map((revision, index) => {
                const previousRevision = revisionRows[index + 1] ?? null;
                const changes = getListingRevisionChanges(revision, previousRevision, t);

                return (
                  <div key={revision.id} className={classes.revisionItem}>
                    <div className={classes.revisionTop}>
                      <div className={classes.revisionTitle}>
                        {t(revisionEventKey(revision.event_type))}
                      </div>

                      <div className={classes.revisionMeta}>
                        {revisionDateText(revision.created_at, locale)}
                      </div>
                    </div>

                    <div className={classes.revisionBody}>
                      <div className={classes.revisionText}>
                        <strong>{t("revision.titleLabel")}</strong> {revision.snapshot.title}
                      </div>

                      <div className={classes.revisionText}>
                        <strong>{t("revision.priceLabel")}</strong>{" "}
                        {revisionPriceText(
                          revision.snapshot.price_type,
                          revision.snapshot.price_min,
                          revision.snapshot.price_max,
                          t
                        )}
                      </div>

                      <div className={classes.revisionText}>
                        <strong>{t("chat.statusLabel")}</strong>{" "}
                        {revisionStatusText(revision.snapshot.status, revision.snapshot.is_active, t)}
                      </div>

                      <div className={classes.revisionText}>
                        <strong>{t("revision.categoryLabel")}</strong> {wordFor("category", revision.snapshot.category, t)}
                      </div>

                      <div className={classes.changeList}>
                        {changes.map((change) => (
                          <div
                            key={`${revision.id}-${change.key}-${change.label}`}
                            className={classes.changeItem}
                          >
                            <ListingRevisionChangeText change={change} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={classes.row}>
              {hasNextPage && (
                <button
                  className={classes.btnPrimary}
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? t("common.loading") : t("inbox.loadMore", { count: 3 })}
                </button>
              )}

              <Link
                className={classes.btnOutline}
                to={`/creator/listings/${listing.id}`}
              >
                {t("revision.back")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorListingRevisions;