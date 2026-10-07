import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminRequests,
  type AdminRequestsFilters,
  type AdminRequestItem,
} from "../../hooks/admin/useAdminRequests";
import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
  ListingRequestStatus,
} from "../../domain/listings/listingRequests";
import { getListingRequestDisplayPreview, getListingRequestDisplayTitle } from '../../domain/listings/listings';
import { useAdminStaleListingRequests } from "../../hooks/admin/useAdminStaleListingRequests";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  backLink: "backLink",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "sectionHeading",
  text: "text-sm text-zinc-600",

  filtersGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-5",
  field: "space-y-2",
  label: "formLabel",
  input:
    "formControl",
  select:
    "formControl",

  grid: "grid gap-4 lg:grid-cols-2",
  requestCard: "card p-5",
  title: "font-display text-lg font-extrabold tracking-tight",
  textMuted: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "metaLabel",
  metaValue: "metaValue",

  row: "flex flex-wrap items-center gap-3",
  pagerText: "text-sm text-zinc-600",

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
} as const;

const initialFilters: AdminRequestsFilters = {
  creatorHandle: "",
  buyerHandle: "",
  createdFrom: "",
  createdTo: "",
  status: "all",
};

const pageSize = 20;

const dateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

const getStatusPillClass = (
  status: ListingRequestStatus
) => {
  const tone = getListingRequestStatusTone(status);

  return tone === "review"
    ? `${classes.statusPillBase} ${classes.statusPillReview}`
    : tone === "success"
      ? `${classes.statusPillBase} ${classes.statusPillSuccess}`
      : tone === "danger"
        ? `${classes.statusPillBase} ${classes.statusPillDanger}`
        : `${classes.statusPillBase} ${classes.statusPillMuted}`;
};

const priceText = (item: AdminRequestItem) => {
  const snapshot = item.request.listing_snapshot;

  return snapshot.price_type === "fixed"
    ? `$${snapshot.price_min}`
    : snapshot.price_type === "starting_at"
      ? `From $${snapshot.price_min}`
      : `$${snapshot.price_min}–$${snapshot.price_max ?? snapshot.price_min}`;
};

const AdminRequests = () => {
  const [filters, setFilters] = useState<AdminRequestsFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAdminRequests({
    filters,
    page,
    pageSize,
  });

  // Sprint 6 checklist: "Staleness query surfaced in admin: requests not
  // advanced in 14+ days with a pending action on one side." REQ-003's db
  // signal (docs/support/requests/request-lifecycle.md).
  const staleRequestsQuery = useAdminStaleListingRequests(14);
  const staleRequests = staleRequestsQuery.data ?? [];

  const setField = <Key extends keyof AdminRequestsFilters>(
    key: Key,
    value: AdminRequestsFilters[Key]
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  };

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;

  return (
    <div className={classes.page}>
      <Link to="/admin/dashboard" className={classes.backLink}>
        ← Back to admin dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Admin commissions</h1>

        <p className={classes.sub}>
          Review commissions, creator responses, decline reasons, and frozen
          listing snapshots for dispute support.
        </p>
      </div>

      {staleRequests.length > 0 && (
        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>
              Stale commissions ({staleRequests.length})
            </h2>

            <p className={classes.text}>
              No activity in 14+ days on an active commission. May need a
              non-response notice.
            </p>

            <ul className="space-y-2 text-sm">
              {staleRequests.map((item) => (
                <li key={item.listing_request_id} className={classes.row}>
                  <Link
                    className={classes.btnOutline}
                    to={`/admin/requests/${item.listing_request_id}`}
                  >
                    View commission
                  </Link>

                  <span className={classes.textMuted}>
                    {item.days_since_activity} days inactive
                    {item.has_open_notice ? " · notice already open" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={classes.card}>
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Filters</h2>

          <div className={classes.filtersGrid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="creatorHandle">
                Creator username
              </label>

              <input
                id="creatorHandle"
                className={classes.input}
                type="text"
                value={filters.creatorHandle}
                onChange={(event) => setField("creatorHandle", event.target.value)}
                placeholder="@creatorname"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="buyerHandle">
                Buyer username
              </label>

              <input
                id="buyerHandle"
                className={classes.input}
                type="text"
                value={filters.buyerHandle}
                onChange={(event) => setField("buyerHandle", event.target.value)}
                placeholder="@buyername"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="createdFrom">
                Submitted from
              </label>

              <input
                id="createdFrom"
                className={classes.input}
                type="date"
                value={filters.createdFrom}
                onChange={(event) => setField("createdFrom", event.target.value)}
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="createdTo">
                Submitted to
              </label>

              <input
                id="createdTo"
                className={classes.input}
                type="date"
                value={filters.createdTo}
                onChange={(event) => setField("createdTo", event.target.value)}
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="status">
                Status
              </label>

              <select
                id="status"
                className={classes.select}
                value={filters.status}
                onChange={(event) =>
                  setField(
                    "status",
                    event.target.value as AdminRequestsFilters["status"]
                  )
                }
              >
                <option value="all">All</option>
                <option value="submitted">Under review</option>
                <option value="accepted">Accepted</option>
                <option value="completed">Completed</option>
                <option value="declined">Declined</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => {
                setFilters(initialFilters);
                setPage(1);
              }}
            >
              Reset filters
            </button>

            <div className={classes.pagerText}>
              {isLoading ? "Loading…" : `${totalCount} commission(s) found`}
            </div>

            {pageCount > 0 && (
              <div className={classes.pagerText}>
                Page {page} of {pageCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Commissions could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading commissions…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>No commissions matched the current filters.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.request.id} className={classes.requestCard}>
                <h2 className={classes.title}>
                  {getListingRequestDisplayTitle(item.request)}
                </h2>

                <p className={classes.textMuted}>
                  Listing: {item.request.listing_snapshot.title}
                </p>

                {getListingRequestDisplayPreview(item.request) && (
                  <p className={classes.textMuted}>
                    {getListingRequestDisplayPreview(item.request)}
                  </p>
                )}

                <p className={classes.textMuted}>
                  Buyer: {profileText(item.buyer, item.request.buyer_user_id)}
                </p>

                <p className={classes.textMuted}>
                  Creator: {profileText(item.creator, item.request.creator_user_id)}
                </p>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Status</div>
                    <div className={getStatusPillClass(item.request.status)}>
                      {getListingRequestStatusLabel(item.request.status, item.request, item.request)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      {item.request.status === "completed"
                        ? "Completed"
                        : "Submitted"}
                    </div>

                    <div className={classes.metaValue}>
                      {dateText(
                        item.request.status === "completed"
                          ? item.request.completed_at ??
                          item.request.updated_at
                          : item.request.created_at
                      )}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Purchase flow</div>
                    <div className={classes.metaValue}>
                      {item.request.listing_snapshot.fulfilment_mode}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Price snapshot</div>
                    <div className={classes.metaValue}>{priceText(item)}</div>
                  </div>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/admin/requests/${item.request.id}`}
                  >
                    View commission
                  </Link>

                  <Link
                    className={classes.btnOutline}
                    to={`/admin/listing-revisions/${item.request.listing_id}`}
                  >
                    Listing revisions
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              className={classes.btnOutline}
              type="button"
              disabled={pageCount === 0 || page >= pageCount}
              onClick={() =>
                setPage((current) =>
                  pageCount > 0 ? Math.min(pageCount, current + 1) : current
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

export default AdminRequests;