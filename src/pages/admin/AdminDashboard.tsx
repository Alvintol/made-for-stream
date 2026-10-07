import { Link } from "react-router-dom";
import { useAdminListingMetrics } from "../../hooks/admin/useAdminListingMetrics";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  statsGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
  statCard: "card p-6",
  statLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  statValue: "mt-2 text-3xl font-extrabold tracking-tight text-zinc-900",
  statHelp: "mt-2 text-sm text-zinc-600",

  toolsGrid: "grid gap-4 lg:grid-cols-2",
  toolCard: "card p-6",
  toolTitle: "font-display text-lg font-extrabold tracking-tight",
  toolText: "mt-2 text-sm text-zinc-600",
  row: "mt-4 flex flex-wrap items-center gap-3",

  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",
} as const;

const AdminDashboard = () => {
  const { data, isLoading, error } = useAdminListingMetrics();

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Admin dashboard</h1>

        <p className={classes.sub}>
          Review creator applications, monitor listings, and investigate listing
          revision history from one place.
        </p>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Dashboard metrics could not be loaded right now.
        </div>
      )}

      {isLoading && (
        <div className={classes.loadingText}>Loading dashboard metrics…</div>
      )}

      <div className={classes.statsGrid}>
        <div className={classes.statCard}>
          <div className={classes.statLabel}>Total listings</div>
          <div className={classes.statValue}>{data?.totalListings ?? 0}</div>
          <div className={classes.statHelp}>
            All listings across draft and published states.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Published listings</div>
          <div className={classes.statValue}>{data?.publishedListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings currently in published status.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Draft listings</div>
          <div className={classes.statValue}>{data?.draftListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings still in private creator draft mode.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Active listings</div>
          <div className={classes.statValue}>{data?.activeListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings currently visible through public listing reads.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Inactive listings</div>
          <div className={classes.statValue}>{data?.inactiveListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings hidden from the public market.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Listing revisions</div>
          <div className={classes.statValue}>{data?.totalRevisions ?? 0}</div>
          <div className={classes.statHelp}>
            Private audit trail entries for creator and admin review.
          </div>
        </div>
      </div>

      <div className={classes.toolsGrid}>
        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Creator applications</h2>

          <p className={classes.toolText}>
            Review incoming creator applications and continue the approval flow.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/creator-applications">
              Review applications
            </Link>
          </div>
        </div>

        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Listings and revisions</h2>

          <p className={classes.toolText}>
            Search listings by username, dates, types, pricing, and visibility,
            then drill into revision history for dispute support.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/listings">
              Browse listings
            </Link>
          </div>
        </div>

        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Commissions and snapshots</h2>

          <p className={classes.toolText}>
            Review commissions, creator responses, decline reasons, and frozen
            listing snapshots for dispute support.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/requests">
              Review commissions
            </Link>
          </div>
        </div>

        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Reports and moderation</h2>

          <p className={classes.toolText}>
            Review reports across conversations, messages, listings, and profiles,
            then track status updates for reporter visibility.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/reports">
              Review reports
            </Link>
          </div>
        </div>

        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Payment issues</h2>

          <p className={classes.toolText}>
            Payments Stripe has recorded a refund or dispute against. Status is
            not derived from these yet, so check each one against what Stripe
            actually shows.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/payment-issues">
              Review payment issues
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;