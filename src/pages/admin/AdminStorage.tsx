import { Link } from "react-router-dom";

import UsageMeter from "../../components/ui/UsageMeter";
import { useAdminStorageOverview } from "../../hooks/admin/useAdminStorageOverview";
import { formatFileSize } from "../../lib/listings/deliveryFiles";
import { hasErrorMessage } from "../../lib/errorMessage";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",
  grid: "grid gap-4 lg:grid-cols-2",
  card: "card space-y-4 p-6",
  title: "font-display text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  link: "font-semibold underline underline-offset-2",
  empty: "text-sm text-zinc-500",
  loading: "text-sm text-zinc-600",
  error: "notice noticeError",
} as const;

const bucketNames: Record<string, string> = {
  "delivery-files": "Delivery files",
  "milestone-previews": "Milestone previews",
  "listing-previews": "Listing images",
  "listing-animations": "Listing animations",
  "free-assets": "Free downloads",
};

// What the site stores and hands out, against what the Supabase plan
// includes. Delivery downloads are the ones the site records; Supabase's
// own usage page has the full egress, images and the API included.
const AdminStorage = () => {
  const { data, isLoading, error } = useAdminStorageOverview();

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Storage</h1>
        <p className={classes.sub}>
          Files stored and delivery files downloaded, against what the Supabase plan
          includes. Figures are as of when this page was opened.
        </p>
      </div>

      {isLoading && <p className={classes.loading}>Loading…</p>}
      {error && (
        <div className={classes.error}>
          {hasErrorMessage(error) ? error.message : "Storage figures could not be loaded."}
        </div>
      )}

      {data && (
        <>
          <div className={classes.grid}>
            <section className={classes.card}>
              <UsageMeter
                detail="Every stored file, all buckets. Over the included amount costs about $0.021 per GB a month."
                label="Stored"
                limitBytes={data.included_storage_bytes}
                usedBytes={data.stored_bytes}
              />
            </section>

            <section className={classes.card}>
              <UsageMeter
                detail={`${data.downloads_this_month.downloads} delivery downloads this month (UTC). Images and the rest of the site also use the allowance: check Supabase's usage page for the full figure.`}
                label="Delivery downloads this month"
                limitBytes={data.included_downloads_bytes}
                usedBytes={data.downloads_this_month.bytes}
              />
            </section>
          </div>

          <div className={classes.grid}>
            <section className={classes.card}>
              <h2 className={classes.title}>By bucket</h2>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th className={classes.th}>Bucket</th>
                    <th className={classes.th}>Files</th>
                    <th className={classes.th}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {data.buckets.map((bucket) => (
                    <tr key={bucket.bucket}>
                      <td className={classes.td}>{bucketNames[bucket.bucket] ?? bucket.bucket}</td>
                      <td className={classes.td}>{bucket.files}</td>
                      <td className={classes.td}>{formatFileSize(bucket.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className={classes.card}>
              <h2 className={classes.title}>Largest commissions</h2>
              {data.largest_commissions.length === 0 ? (
                <p className={classes.empty}>No delivery files yet.</p>
              ) : (
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.th}>Commission</th>
                      <th className={classes.th}>Files</th>
                      <th className={classes.th}>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.largest_commissions.map((row) => (
                      <tr key={row.listing_request_id}>
                        <td className={classes.td}>
                          <Link className={classes.link} to={`/admin/requests/${row.listing_request_id}`}>
                            {row.listing_request_id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className={classes.td}>{row.files}</td>
                        <td className={classes.td}>{formatFileSize(row.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className={classes.grid}>
            <section className={classes.card}>
              <h2 className={classes.title}>Uploads, last 30 days</h2>
              {data.uploads_by_day.length === 0 ? (
                <p className={classes.empty}>Nothing uploaded in the last 30 days.</p>
              ) : (
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.th}>Day (UTC)</th>
                      <th className={classes.th}>Files</th>
                      <th className={classes.th}>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.uploads_by_day.map((row) => (
                      <tr key={row.day}>
                        <td className={classes.td}>{row.day}</td>
                        <td className={classes.td}>{row.files}</td>
                        <td className={classes.td}>{formatFileSize(row.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={classes.card}>
              <h2 className={classes.title}>Delivery downloads, last 30 days</h2>
              {data.downloads_by_day.length === 0 ? (
                <p className={classes.empty}>No delivery downloads in the last 30 days.</p>
              ) : (
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.th}>Day (UTC)</th>
                      <th className={classes.th}>Downloads</th>
                      <th className={classes.th}>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.downloads_by_day.map((row) => (
                      <tr key={row.day}>
                        <td className={classes.td}>{row.day}</td>
                        <td className={classes.td}>{row.downloads}</td>
                        <td className={classes.td}>{formatFileSize(row.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className={classes.card}>
            <h2 className={classes.title}>Storage plans</h2>
            <p className={classes.text}>
              The storage each commission gets. Nothing sells a plan yet; a plan is given to
              a creator in SQL (playbook STO-002).
            </p>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Plan</th>
                  <th className={classes.th}>Per commission</th>
                  <th className={classes.th}>Creators on it now</th>
                </tr>
              </thead>
              <tbody>
                {data.plans.map((plan) => (
                  <tr key={plan.code}>
                    <td className={classes.td}>
                      {plan.label}
                      {plan.is_default ? " (everyone)" : ""}
                    </td>
                    <td className={classes.td}>{formatFileSize(plan.commission_limit_bytes)}</td>
                    <td className={classes.td}>{plan.is_default ? "—" : plan.active_creators}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminStorage;
