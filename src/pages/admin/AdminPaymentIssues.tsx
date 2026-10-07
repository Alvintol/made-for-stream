import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminPaymentIssues,
  type AdminPaymentIssueItem,
  type AdminPaymentIssuesFilters,
} from "../../hooks/admin/useAdminPaymentIssues";
import {
  formatPaymentCents,
  getListingRequestPaymentStatusLabel,
  getListingRequestPaymentTypeLabel,
} from "../../domain/payments/listingRequestPaymentDisplay";
import { getListingRequestDisplayTitle } from "../../domain/listings/listings";
import type { ListingRequestPaymentStatus, ListingRequestPaymentType } from "../../hooks/payments/useListingRequestPayments";

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

  filtersGrid: "grid gap-4 md:grid-cols-3",
  field: "space-y-2",
  label: "formLabel",
  select: "formControl",

  row: "flex flex-wrap items-center gap-3",
  pagerText: "text-sm text-zinc-600",

  grid: "grid gap-4 lg:grid-cols-2",
  itemCard: "card p-5",
  title: "font-display text-lg font-extrabold tracking-tight",
  textMuted: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "metaLabel",
  metaValue: "metaValue",

  pillBase: "rounded-full border px-3 py-1 text-xs font-semibold",
  pillDispute: "border-red-200 bg-red-50 text-red-800",
  pillRefund: "border-amber-200 bg-amber-50 text-amber-800",
  pillMuted: "border-zinc-200 bg-zinc-100 text-zinc-700",

  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard: "notice noticeError",
} as const;

const initialFilters: AdminPaymentIssuesFilters = {
  type: "all",
};

const pageSize = 20;

const dateText = (value: string | null) => {
  if (!value) return "—";

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

const profileText = (
  profile: { handle: string | null; display_name: string | null } | null,
  fallbackUserId: string
) =>
  profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

const requestTitle = (item: AdminPaymentIssueItem) =>
  item.request ? getListingRequestDisplayTitle(item.request) : "Commission not found";

// status is never written by the refund/dispute webhook handlers
// (docs/support/payments/refunds-and-disputes.md) -- a payment can be
// recorded here as refunded or disputed while status still reads "paid".
// This is the gap the whole page exists to surface, so it is called out
// per row rather than only in the page description.
const StatusDivergenceNote = ({
  payment,
}: {
  payment: AdminPaymentIssueItem["payment"];
}) => {
  if (payment.status !== "paid") return null;

  return (
    <p className={classes.textMuted}>
      Status still reads <strong>Paid</strong> — this is recorded from Stripe but
      not yet reflected in the commission workflow. Reconcile manually.
    </p>
  );
};

const AdminPaymentIssues = () => {
  const [filters, setFilters] = useState<AdminPaymentIssuesFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAdminPaymentIssues({
    filters,
    page,
    pageSize,
  });

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;

  return (
    <div className={classes.page}>
      <Link to="/admin/dashboard" className={classes.backLink}>
        ← Back to admin dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Payment issues</h1>

        <p className={classes.sub}>
          Payments Stripe has recorded a refund or dispute against
          (<code>charge.refunded</code>, <code>charge.dispute.created</code>,{" "}
          <code>charge.dispute.closed</code>). The payment's own{" "}
          <strong>status</strong> is not updated by those events yet — that
          derivation lands with the refund ledger — so check each row's status
          against what Stripe actually shows before assuming the commission
          workflow already reflects it.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Filters</h2>

          <div className={classes.filtersGrid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="type">
                Type
              </label>

              <select
                id="type"
                className={classes.select}
                value={filters.type}
                onChange={(event) => {
                  setFilters({
                    type: event.target.value as AdminPaymentIssuesFilters["type"],
                  });
                  setPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="disputed">Disputed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div className={classes.row}>
            <div className={classes.pagerText}>
              {isLoading ? "Loading…" : `${totalCount} payment(s) found`}
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
          Payment issues could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading payment issues…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>
            No refunded or disputed payments matched the current filter.
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.payment.id} className={classes.itemCard}>
                <h2 className={classes.title}>{requestTitle(item)}</h2>

                <p className={classes.textMuted}>
                  {getListingRequestPaymentTypeLabel(
                    item.payment.payment_type as ListingRequestPaymentType
                  )}{" "}
                  ·{" "}
                  {formatPaymentCents(
                    item.payment.base_amount_cents,
                    item.payment.currency
                  )}
                </p>

                <p className={classes.textMuted}>
                  Buyer: {profileText(item.buyer, item.payment.payer_user_id)}
                </p>

                <p className={classes.textMuted}>
                  Creator: {profileText(item.creator, item.payment.creator_user_id)}
                </p>

                <div className={classes.row}>
                  {item.payment.stripe_dispute_id && (
                    <span className={`${classes.pillBase} ${classes.pillDispute}`}>
                      Disputed
                    </span>
                  )}

                  {item.payment.stripe_refund_id && (
                    <span className={`${classes.pillBase} ${classes.pillRefund}`}>
                      Refunded
                    </span>
                  )}

                  <span className={`${classes.pillBase} ${classes.pillMuted}`}>
                    Status: {getListingRequestPaymentStatusLabel(
                      item.payment.status as ListingRequestPaymentStatus
                    )}
                  </span>
                </div>

                <StatusDivergenceNote payment={item.payment} />

                <div className={classes.metaGrid}>
                  {item.payment.stripe_dispute_id && (
                    <div className={classes.metaBlock}>
                      <div className={classes.metaLabel}>Dispute recorded</div>
                      <div className={classes.metaValue}>
                        {dateText(item.payment.disputed_at)}
                      </div>
                    </div>
                  )}

                  {item.payment.stripe_refund_id && (
                    <div className={classes.metaBlock}>
                      <div className={classes.metaLabel}>Refund recorded</div>
                      <div className={classes.metaValue}>
                        {dateText(item.payment.refunded_at)}
                      </div>
                    </div>
                  )}

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Stripe charge</div>
                    <div className={classes.metaValue}>
                      {item.payment.stripe_charge_id ?? "—"}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Last updated</div>
                    <div className={classes.metaValue}>
                      {dateText(item.payment.updated_at)}
                    </div>
                  </div>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/admin/requests/${item.payment.listing_request_id}`}
                  >
                    View commission
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

export default AdminPaymentIssues;
