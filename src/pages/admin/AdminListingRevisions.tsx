import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminListingDetails } from "../../hooks/admin/useAdminListingDetails";
import {
  useInfiniteListingRevisions,
  type ListingRevisionRow,
} from "../../hooks/listings/useListingRevisions";
import { getListingRevisionChanges } from "../../lib/listings/listingRevisionDiff";
import ListingRevisionChangeText from "../../components/listings/ListingRevisionChangeText";

const classes = {
  page: "space-y-6",
  backLink: "backLink",

  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  grid: "grid gap-6 lg:grid-cols-[0.9fr_1.1fr]",
  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "sectionHeading",
  text: "text-sm text-zinc-600",

  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "metaLabel",
  metaValue: "metaValue",

  revisionList: "space-y-3",
  revisionItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  revisionTop: "flex flex-wrap items-center justify-between gap-3",
  revisionTitle: "text-sm font-bold text-zinc-900",
  revisionMeta: "text-xs text-zinc-500",
  revisionBody: "mt-3 space-y-2",
  revisionText: "text-sm text-zinc-700",
  changeList: "mt-3 space-y-2",
  changeItem:
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",
} as const;

const revisionEventLabel = (eventType: ListingRevisionRow["event_type"]) =>
  eventType === "created"
    ? "Created"
    : eventType === "updated"
      ? "Updated"
      : eventType === "published"
        ? "Published"
        : eventType === "deactivated"
          ? "Deactivated"
          : eventType === "reactivated"
            ? "Reactivated"
            : "Moved to draft";

const revisionDateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const priceText = (
  priceType: "fixed" | "starting_at" | "range",
  priceMin: number,
  priceMax: number | null
) =>
  priceType === "fixed"
    ? `$${priceMin}`
    : priceType === "starting_at"
      ? `From $${priceMin}`
      : `$${priceMin}–$${priceMax ?? priceMin}`;

const AdminListingRevisions = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: details,
    isLoading: isLoadingDetails,
    error: detailsError,
  } = useAdminListingDetails(id ?? null);

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

  if (isLoadingDetails) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  const listing = details?.listing ?? null;
  const creator = details?.creator ?? null;

  if (detailsError || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/admin/listings" className={classes.backLink}>
          ← Back to admin listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing not found</h1>
          <p className={classes.sub}>
            This listing could not be loaded for admin review.
          </p>
        </div>
      </div>
    );
  }

  const creatorUsername = creator?.handle
    ? `@${creator.handle}`
    : creator?.display_name ?? listing.user_id;

  return (
    <div className={classes.page}>
      <Link to="/admin/listings" className={classes.backLink}>
        ← Back to admin listings
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Listing revision review</h1>

        <p className={classes.sub}>
          Read-only admin-side listing history for dispute support.
        </p>
      </div>

      <div className={classes.grid}>
        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Current listing state</h2>

            <div className={classes.metaGrid}>
              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Title</div>
                <div className={classes.metaValue}>{listing.title}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Creator username</div>
                <div className={classes.metaValue}>{creatorUsername}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Display name</div>
                <div className={classes.metaValue}>
                  {creator?.display_name ?? "None"}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Creator user id</div>
                <div className={classes.metaValue}>{listing.user_id}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Price</div>
                <div className={classes.metaValue}>
                  {priceText(listing.price_type, listing.price_min, listing.price_max)}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Category</div>
                <div className={classes.metaValue}>{listing.category}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Status</div>
                <div className={classes.metaValue}>
                  {listing.status} • {listing.is_active ? "Active" : "Inactive"}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Purchase flow</div>
                <div className={classes.metaValue}>{listing.fulfilment_mode}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Last updated</div>
                <div className={classes.metaValue}>{listing.updated_at}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Revision history</h2>
            <p className={classes.text}>
              Buyers do not see this audit trail.
            </p>
          </div>

          {revisionsError && (
            <div className={classes.errorCard}>
              Revision history could not be loaded right now.
            </div>
          )}

          {isLoadingRevisions && revisionRows.length === 0 && (
            <div className={classes.loadingText}>Loading revision history…</div>
          )}

          {!isLoadingRevisions && !revisionsError && revisionRows.length === 0 && (
            <p className={classes.text}>No revisions have been recorded yet.</p>
          )}

          {revisionRows.length > 0 && (
            <div className={classes.section}>
              <div className={classes.revisionList}>
                {revisionRows.map((revision, index) => {
                  const previousRevision = revisionRows[index + 1] ?? null;
                  const changes = getListingRevisionChanges(revision, previousRevision);

                  return (
                    <div key={revision.id} className={classes.revisionItem}>
                      <div className={classes.revisionTop}>
                        <div className={classes.revisionTitle}>
                          {revisionEventLabel(revision.event_type)}
                        </div>

                        <div className={classes.revisionMeta}>
                          {revisionDateText(revision.created_at)}
                        </div>
                      </div>

                      <div className={classes.revisionBody}>
                        <div className={classes.revisionText}>
                          <strong>Title:</strong> {revision.snapshot.title}
                        </div>

                        <div className={classes.revisionText}>
                          <strong>Price:</strong>{" "}
                          {priceText(
                            revision.snapshot.price_type,
                            revision.snapshot.price_min,
                            revision.snapshot.price_max
                          )}
                        </div>

                        <div className={classes.revisionText}>
                          <strong>Status:</strong> {revision.snapshot.status}
                          {revision.snapshot.is_active ? " • Active" : " • Inactive"}
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
                    {isFetchingNextPage ? "Loading…" : "Load 3 more"}
                  </button>
                )}

                <Link className={classes.btnOutline} to="/admin/listings">
                  Back to admin listings
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminListingRevisions;