import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { useAdminSalesSummary } from "../../hooks/payments/useSales";

const classes = {
  group: "space-y-3",
  stats: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
  stat: "card p-4",
  label: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  value: "mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-zinc-900",
  note: "mt-0.5 text-xs text-zinc-500",
  empty: "card p-4 text-sm text-zinc-500",
  error: "notice noticeError",
} as const;

const Stat = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className={classes.stat}>
    <div className={classes.label}>{label}</div>
    <div className={classes.value}>{value}</div>
    <div className={classes.note}>{note}</div>
  </div>
);

// The whole site's month, one row of cards per currency.
const AdminSalesTotals = ({ month }: { month: string }) => {
  const { data, error, isLoading } = useAdminSalesSummary(month);

  if (error) return <div className={classes.error}>Sales could not be loaded.</div>;

  if (isLoading) return <p className={classes.empty}>Loading…</p>;

  if (!data || data.totals.length === 0) {
    return <p className={classes.empty}>No sales this month.</p>;
  }

  return (
    <div className={classes.group}>
      {data.totals.map((totals) => {
        const money = (cents: number) => formatPaymentCents(cents, totals.currency);

        return (
          <div key={totals.currency} className={classes.stats}>
            <Stat
              label="Total sales"
              value={money(totals.sold_cents)}
              note={`${totals.sales} completed`}
            />
            <Stat
              label="Transactions"
              value={money(totals.paid_cents)}
              note={`${totals.transactions} payment${totals.transactions === 1 ? "" : "s"}, ${money(totals.refunded_cents)} refunded`}
            />
            <Stat label="Fees and support" value={money(totals.kept_cents)} note="What Made for Stream kept" />
            <Stat label="Tax to set aside" value={money(totals.tax_cents)} note="GST/HST inside those fees" />
            <Stat label="Total earnings" value={money(totals.earned_cents)} note="After tax, before your costs" />
          </div>
        );
      })}
    </div>
  );
};

export default AdminSalesTotals;
