import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { useMySalesSummary } from "../../hooks/payments/useSales";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  group: "space-y-3",
  stats: "grid grid-cols-2 gap-3 lg:grid-cols-4",
  stat: "card p-4",
  label: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  value: "mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-zinc-900",
  note: "mt-0.5 text-xs text-zinc-500",
  empty: "card p-4 text-sm text-zinc-500",
  error: "notice noticeError",
} as const;

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className={classes.stat}>
    <div className={classes.label}>{label}</div>
    <div className={classes.value}>{value}</div>
    {note && <div className={classes.note}>{note}</div>}
  </div>
);

// A month's numbers, one row of cards per currency because amounts in different
// currencies can't be added together.
const CreatorSalesTotals = ({ month }: { month: string }) => {
  const t = useT();
  const { data, error, isLoading } = useMySalesSummary(month);

  if (error) return <div className={classes.error}>{t("sales.loadFailed")}</div>;

  if (isLoading) return <p className={classes.empty}>{t("sales.loading")}</p>;

  if (!data || data.length === 0) return <p className={classes.empty}>{t("sales.noSales")}</p>;

  return (
    <div className={classes.group}>
      {data.map((totals) => {
        const money = (cents: number) => formatPaymentCents(cents, totals.currency);

        return (
          <div key={totals.currency} className={classes.stats}>
            <Stat
              label={t("sales.totalSales")}
              value={money(totals.sold_cents)}
              note={t("sales.completedCount", { count: totals.sales })}
            />
            <Stat
              label={t("sales.transactions")}
              value={money(totals.paid_cents)}
              note={[
                t("sales.paymentCount", { count: totals.transactions }),
                ...(totals.refunded_cents > 0
                  ? [t("sales.afterRefunds", { amount: money(totals.refunded_cents) })]
                  : []),
              ].join(" · ")}
            />
            <Stat
              label={t("sales.totalEarnings")}
              value={money(totals.earned_cents)}
              note={t("sales.beforeStripe")}
            />
            <Stat
              label={t("sales.totalFees")}
              value={money(totals.fee_cents)}
              note={
                totals.fee_tax_cents > 0
                  ? t("sales.feesIncludeTax", { amount: money(totals.fee_tax_cents) })
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
};

export default CreatorSalesTotals;
