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
import { useMyCreatorRequests } from "../../hooks/creatorRequests/useMyCreatorRequests";
import { dateLocale, hasMessage, useLanguage, useT } from "../../lib/i18n/i18n";
import { StaggerGroup } from "../../lib/motion";
type CreatorRequestsProps = {
  view?: ListingRequestListView;
};

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",
  row: "flex flex-wrap items-center gap-3",
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
    title: "creatorRequests.activeTitle",
    description: "creatorRequests.activeText",
    emptyMessage: "buyerRequests.activeEmpty",
  },

  completed: {
    title: "creatorRequests.completedTitle",
    description: "creatorRequests.completedText",
    emptyMessage: "creatorRequests.completedEmpty",
  },

  archived: {
    title: "creatorRequests.archivedTitle",
    description: "buyerRequests.archivedText",
    emptyMessage: "creatorRequests.archivedEmpty",
  },
} as const satisfies Record<ListingRequestListView, Record<string, string>>;

// Prefers handle for buyer display, then display name, then user id.
const buyerText = (
  buyer: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  buyer?.handle
    ? `@${buyer.handle}`
    : buyer?.display_name ??
    fallbackUserId;

// Formats timestamps for creator request cards.
const dateText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(
      locale,
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

const CreatorRequests = ({
  view = "active",
}: CreatorRequestsProps) => {
  const t = useT();
  const locale = dateLocale(useLanguage());
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
  } = useMyCreatorRequests({
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
          to="/creator/requests"
        >
          {t("buyerRequests.tabActive")}
        </Link>

        <Link
          className={
            view === "completed"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/creator/requests/completed"
        >
          {t("buyerRequests.completedTitle")}
        </Link>

        <Link
          className={
            view === "archived"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/creator/requests/archived"
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
          {t("creatorRequests.loadFailed")}
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
                const fulfilmentKey = `fulfilment.${snapshot.fulfilment_mode}`;
                const offeringKey = `offering.${snapshot.offering_type}`;
                const categoryKey = `category.${snapshot.category}`;

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
                    {t("creatorRequests.buyer", {
                      name: buyerText(
                        item.buyer,
                        item.request.buyer_user_id
                      ),
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
                        {t(view === "completed"
                          ? "buyerRequests.completedOn"
                          : "creatorRequests.received")}
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
                          locale
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
                        {t("buyerRequests.priceSnapshot")}
                      </div>

                      <div
                        className={
                          classes.metaValue
                        }
                      >
                        {formatListingPrice(snapshot, t("price.from"))}
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
                        {t("snapshot.category")}
                      </div>

                      <div
                        className={
                          classes.metaValue
                        }
                      >
                        {hasMessage(categoryKey) ? t(categoryKey) : snapshot.category}
                      </div>
                    </div>
                  </div>

                  <div className={classes.pills}>
                    <span
                      className={classes.pill}
                    >
                      {hasMessage(fulfilmentKey) ? t(fulfilmentKey) : snapshot.fulfilment_mode}
                    </span>

                    <span
                      className={classes.pill}
                    >
                      {hasMessage(offeringKey) ? t(offeringKey) : snapshot.offering_type}
                    </span>
                  </div>

                  <div className={classes.row}>
                    <Link
                      className={
                        classes.btnPrimary
                      }
                      to={`/creator/requests/${item.request.id}`}
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

export default CreatorRequests;