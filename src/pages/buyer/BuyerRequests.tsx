import { useState } from "react";
import { formatListingPrice } from "../../lib/money/displayCurrency";
import { Link } from "react-router-dom";

import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
  type ListingRequestListView,
  type ListingRequestStatus,
} from "../../domain/listings/listingRequests";
import {
  getListingRequestDisplayPreview,
  getListingRequestDisplayTitle,
} from "../../domain/listings/listings";
import { useMyBuyerRequests } from "../../hooks/creatorRequests/useMyBuyerRequests";
import { StaggerGroup } from "../../lib/motion";
import { hasMessage, useLanguage, useT } from "../../lib/i18n/i18n";
type BuyerRequestsProps = {
  view?: ListingRequestListView;
};

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",
  grid: "grid gap-4 lg:grid-cols-2",
  card: "card p-5",
  title: "font-display text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel:
    "metaLabel",
  metaValue: "metaValue",
  pills: "flex flex-wrap gap-2",
  pill: "chip",
  statusPillBase:
    "rounded-full border px-3 py-1 text-xs font-semibold",
  statusPillReview:
    "border-amber-200 bg-amber-50 text-amber-800",
  statusPillSuccess:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  statusPillDanger:
    "border-red-200 bg-red-50 text-red-800",
  statusPillMuted:
    "border-zinc-200 bg-zinc-100 text-zinc-700",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",
  pagerText: "text-sm text-zinc-600",
  unreadPill:
    "inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800",
  titleRow:
    "flex flex-wrap items-start justify-between gap-3",
} as const;

const pageSize = 12;

// Translation keys (lib/i18n) for each tab.
const viewContent = {
  active: {
    title: "buyerRequests.activeTitle",
    description: "buyerRequests.activeText",
    emptyMessage: "buyerRequests.activeEmpty",
  },
  completed: {
    title: "buyerRequests.completedTitle",
    description: "buyerRequests.completedText",
    emptyMessage: "buyerRequests.completedEmpty",
  },
  archived: {
    title: "buyerRequests.archivedTitle",
    description: "buyerRequests.archivedText",
    emptyMessage: "buyerRequests.archivedEmpty",
  },
} as const satisfies Record<ListingRequestListView, Record<string, string>>;

// Prefers handle for creator display, then display name, then user id.
const creatorText = (
  creator: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  creator?.handle
    ? `@${creator.handle}`
    : creator?.display_name ??
    fallbackUserId;

// Formats request timestamps for buyer cards.
const dateText = (value: string, language: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(
      language,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
};

const getStatusPillClass = (
  status: ListingRequestStatus
) => {
  const tone =
    getListingRequestStatusTone(status);

  return tone === "review"
    ? `${classes.statusPillBase} ${classes.statusPillReview}`
    : tone === "success"
      ? `${classes.statusPillBase} ${classes.statusPillSuccess}`
      : tone === "danger"
        ? `${classes.statusPillBase} ${classes.statusPillDanger}`
        : `${classes.statusPillBase} ${classes.statusPillMuted}`;
};

const BuyerRequests = ({
  view = "active",
}: BuyerRequestsProps) => {
  const t = useT();
  const language = useLanguage();
  const [page, setPage] = useState(1);
  const [pageView, setPageView] = useState(view);
  const content = viewContent[view];

  // Another tab starts on page 1 (reset while rendering, not in an effect).
  if (pageView !== view) {
    setPageView(view);
    setPage(1);
  }

  const {
    data,
    isLoading,
    error,
  } = useMyBuyerRequests({
    view,
    page,
    pageSize,
  });

  const items = data?.items ?? [];
  const totalCount =
    data?.totalCount ?? 0;
  const pageCount =
    data?.pageCount ?? 0;

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>
          {t(content.title)}
        </h1>

        <p className={classes.sub}>
          {t(content.description)}
        </p>
      </div>

      <div className={classes.row}>
        <Link
          className={
            view === "active"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/requests"
        >
          {t("buyerRequests.tabActive")}
        </Link>

        <Link
          className={
            view === "completed"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/requests/completed"
        >
          {t("buyerRequests.completedTitle")}
        </Link>

        <Link
          className={
            view === "archived"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/requests/archived"
        >
          {t("buyerRequests.archivedTitle")}
        </Link>

        <div className={classes.pagerText}>
          {isLoading
            ? t("common.loading")
            : t("buyerRequests.found", { count: totalCount })}
        </div>

        {pageCount > 0 && (
          <div className={classes.pagerText}>
            {t("buyerRequests.page", { page, pageCount })}
          </div>
        )}
      </div>

      {error && (
        <div className={classes.errorCard}>
          {t("buyerRequests.loadFailed")}
        </div>
      )}

      {isLoading && (
        <div className={classes.loadingText}>
          {t("buyerRequests.loading")}
        </div>
      )}

      {!isLoading &&
        !error &&
        items.length === 0 && (
          <div className={classes.card}>
            <p className={classes.text}>
              {t(content.emptyMessage)}
            </p>
          </div>
        )}

      {!isLoading &&
        !error &&
        items.length > 0 && (
          <>
            <StaggerGroup className={classes.grid} itemCount={items.length} resetKey={String(page)}>
              {items.map((item) => {
                const snapshot = item.request.listing_snapshot;
                const offeringKey = `offering.${snapshot.offering_type}`;
                const categoryKey = `category.${snapshot.category}`;
                const fulfilmentKey = `fulfilment.${snapshot.fulfilment_mode}`;

                return (
                <div
                  className={classes.card}
                  key={item.request.id}
                >
                  <div
                    className={
                      classes.titleRow
                    }
                  >
                    <h2
                      className={classes.title}
                    >
                      {getListingRequestDisplayTitle(
                        item.request,
                        t
                      )}
                    </h2>

                    <p className={classes.text}>
                      {t("buyerRequests.listing", { title: snapshot.title })}
                    </p>

                    {getListingRequestDisplayPreview(
                      item.request
                    ) && (
                        <p
                          className={
                            classes.text
                          }
                        >
                          {getListingRequestDisplayPreview(
                            item.request
                          )}
                        </p>
                      )}

                    {item.conversation
                      .has_unread && (
                        <span
                          className={
                            classes.unreadPill
                          }
                        >
                          {t("buyerRequests.newMessage")}
                        </span>
                      )}
                  </div>

                  <p className={classes.text}>
                    {t("buyerRequests.creator", {
                      name: creatorText(item.creator, item.request.creator_user_id),
                    })}
                  </p>

                  <div
                    className={
                      classes.metaGrid
                    }
                  >
                    <div
                      className={
                        classes.metaBlock
                      }
                    >
                      <div
                        className={
                          classes.metaLabel
                        }
                      >
                        {t("buyerRequests.status")}
                      </div>

                      <div
                        className={getStatusPillClass(
                          item.request.status
                        )}
                      >
                        {getListingRequestStatusLabel(
                          item.request.status,
                          item.request,
                          item.request,
                          t
                        )}
                      </div>
                    </div>

                    <div
                      className={
                        classes.metaBlock
                      }
                    >
                      <div
                        className={
                          classes.metaLabel
                        }
                      >
                        {view === "completed"
                          ? t("buyerRequests.completedOn")
                          : t("buyerRequests.submittedOn")}
                      </div>

                      <div
                        className={
                          classes.metaValue
                        }
                      >
                        {dateText(
                          view ===
                            "completed"
                            ? item.request
                              .completed_at ??
                            item.request
                              .updated_at
                            : item.request
                              .created_at,
                          language
                        )}
                      </div>
                    </div>

                    <div
                      className={
                        classes.metaBlock
                      }
                    >
                      <div
                        className={
                          classes.metaLabel
                        }
                      >
                        {t("buyerRequests.purchaseFlow")}
                      </div>

                      <div
                        className={
                          classes.metaValue
                        }
                      >
                        {hasMessage(fulfilmentKey) ? t(fulfilmentKey) : snapshot.fulfilment_mode}
                      </div>
                    </div>

                    <div
                      className={
                        classes.metaBlock
                      }
                    >
                      <div
                        className={
                          classes.metaLabel
                        }
                      >
                        {t("buyerRequests.priceSnapshot")}
                      </div>

                      <div
                        className={
                          classes.metaValue
                        }
                      >
                        {formatListingPrice(item.request.listing_snapshot)}
                      </div>
                    </div>
                  </div>

                  <div className={classes.pills}>
                    <span
                      className={classes.pill}
                    >
                      {hasMessage(offeringKey) ? t(offeringKey) : snapshot.offering_type}
                    </span>

                    <span
                      className={classes.pill}
                    >
                      {hasMessage(categoryKey) ? t(categoryKey) : snapshot.category}
                    </span>
                  </div>

                  <div className={classes.row}>
                    <Link
                      className={
                        classes.btnPrimary
                      }
                      to={`/requests/${item.request.id}`}
                    >
                      {t("buyerRequests.view")}
                    </Link>
                  </div>
                </div>
                );
              })}
            </StaggerGroup>

            <div className={classes.row}>
              <button
                className={
                  classes.btnOutline
                }
                disabled={page <= 1}
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                  )
                }
              >
                {t("common.previous")}
              </button>

              <button
                className={
                  classes.btnOutline
                }
                disabled={
                  pageCount === 0 ||
                  page >= pageCount
                }
                type="button"
                onClick={() =>
                  setPage((current) =>
                    pageCount > 0
                      ? Math.min(
                        pageCount,
                        current + 1
                      )
                      : current
                  )
                }
              >
                {t("common.next")}
              </button>
            </div>
          </>
        )}
    </div>
  );
};

export default BuyerRequests;