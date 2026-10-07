import {
  useEffect,
  useState,
} from "react";
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

const viewContent: Record<
  ListingRequestListView,
  {
    title: string;
    description: string;
    emptyMessage: string;
  }
> = {
  active: {
    title: "My commissions",
    description:
      "Review active commissions you have submitted to creators.",
    emptyMessage:
      "You do not have any active commissions.",
  },

  completed: {
    title: "Completed projects",
    description:
      "Review projects whose final delivery you approved.",
    emptyMessage:
      "You do not have any completed projects.",
  },

  archived: {
    title: "Archived commissions",
    description:
      "Review declined, cancelled, and archived commissions.",
    emptyMessage:
      "You do not have any archived commissions.",
  },
};

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
const dateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(
      undefined,
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
  const [page, setPage] = useState(1);
  const content = viewContent[view];

  useEffect(() => {
    setPage(1);
  }, [view]);

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
          {content.title}
        </h1>

        <p className={classes.sub}>
          {content.description}
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
          Active commissions
        </Link>

        <Link
          className={
            view === "completed"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/requests/completed"
        >
          Completed projects
        </Link>

        <Link
          className={
            view === "archived"
              ? classes.btnPrimary
              : classes.btnOutline
          }
          to="/requests/archived"
        >
          Archived commissions
        </Link>

        <div className={classes.pagerText}>
          {isLoading
            ? "Loading…"
            : `${totalCount} commission(s) found`}
        </div>

        {pageCount > 0 && (
          <div className={classes.pagerText}>
            Page {page} of {pageCount}
          </div>
        )}
      </div>

      {error && (
        <div className={classes.errorCard}>
          Your commissions could not be loaded
          right now.
        </div>
      )}

      {isLoading && (
        <div className={classes.loadingText}>
          Loading commissions…
        </div>
      )}

      {!isLoading &&
        !error &&
        items.length === 0 && (
          <div className={classes.card}>
            <p className={classes.text}>
              {content.emptyMessage}
            </p>
          </div>
        )}

      {!isLoading &&
        !error &&
        items.length > 0 && (
          <>
            <StaggerGroup className={classes.grid} itemCount={items.length} resetKey={String(page)}>
              {items.map((item) => (
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
                        item.request
                      )}
                    </h2>

                    <p className={classes.text}>
                      Listing:{" "}
                      {
                        item.request
                          .listing_snapshot
                          .title
                      }
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
                          New message
                        </span>
                      )}
                  </div>

                  <p className={classes.text}>
                    Creator:{" "}
                    {creatorText(
                      item.creator,
                      item.request
                        .creator_user_id
                    )}
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
                        Status
                      </div>

                      <div
                        className={getStatusPillClass(
                          item.request.status
                        )}
                      >
                        {getListingRequestStatusLabel(
                          item.request.status,
                          item.request,
                          item.request
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
                          ? "Completed"
                          : "Submitted"}
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
                              .created_at
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
                        Purchase flow
                      </div>

                      <div
                        className={
                          classes.metaValue
                        }
                      >
                        {
                          item.request
                            .listing_snapshot
                            .fulfilment_mode
                        }
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
                        Price snapshot
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
                      {
                        item.request
                          .listing_snapshot
                          .offering_type
                      }
                    </span>

                    <span
                      className={classes.pill}
                    >
                      {
                        item.request
                          .listing_snapshot
                          .category
                      }
                    </span>
                  </div>

                  <div className={classes.row}>
                    <Link
                      className={
                        classes.btnPrimary
                      }
                      to={`/requests/${item.request.id}`}
                    >
                      View commission
                    </Link>
                  </div>
                </div>
              ))}
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
                Previous
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
                Next
              </button>
            </div>
          </>
        )}
    </div>
  );
};

export default BuyerRequests;