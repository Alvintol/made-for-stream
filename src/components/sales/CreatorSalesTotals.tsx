import { Link } from "react-router-dom";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { useMySalesSummary } from "../../hooks/payments/useSales";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  group: "space-y-3",
  stats: "grid gap-3 sm:grid-cols-2",
  stacked: "grid gap-3",
  more: "text-xs font-semibold text-[rgb(var(--accent-text))] hover:underline",
  stat: "card p-4",
  label: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  value: "mt-1 font-display text-2xl font-bold tracking-tight text-zinc-900",
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

// A month's earnings and how many commissions and downloads were completed,
// one row of cards per currency because amounts in different currencies
// can't be added together. Fees stay in the list of each sale.
//
// `stacked` is the dashboard's fixed corner: always the same two cards, one
// above the other, whether loading, empty or full. It shows one currency;
// any others are a link to the Earnings page, never more cards.
const CreatorSalesTotals = ({ month, stacked = false }: { month: string; stacked?: boolean }) => {
  const t = useT();
  const { data, error, isLoading } = useMySalesSummary(month);

  if (error) return <div className={classes.error}>{t("sales.loadFailed")}</div>;

  if (stacked) {
    const first = data?.[0];

    return (
      <div className={classes.stacked}>
        <Stat
          label={t("sales.totalEarnings")}
          value={first ? formatPaymentCents(first.earned_cents, first.currency) : "–"}
          note={t("sales.beforeStripe")}
        />
        <Stat
          label={t("sales.completed")}
          value={first ? String(first.sales) : "–"}
          note={
            first
              ? t("sales.completedSplit", {
                  commissions: first.commissions ?? first.sales,
                  downloads: first.downloads ?? 0,
                })
              : t(isLoading ? "sales.loading" : "sales.noSales")
          }
        />
        {data && data.length > 1 && (
          <Link className={classes.more} to="/creator/earnings">
            {t("sales.otherCurrencies", { count: data.length - 1 })}
          </Link>
        )}
      </div>
    );
  }

  if (isLoading) return <p className={classes.empty}>{t("sales.loading")}</p>;

  if (!data || data.length === 0) return <p className={classes.empty}>{t("sales.noSales")}</p>;

  return (
    <div className={classes.group}>
      {data.map((totals) => (
        <div key={totals.currency} className={classes.stats}>
          <Stat
            label={t("sales.totalEarnings")}
            value={formatPaymentCents(totals.earned_cents, totals.currency)}
            note={t("sales.beforeStripe")}
          />
          <Stat
            label={t("sales.completed")}
            value={String(totals.sales)}
            note={t("sales.completedSplit", {
              commissions: totals.commissions ?? totals.sales,
              downloads: totals.downloads ?? 0,
            })}
          />
        </div>
      ))}
    </div>
  );
};

export default CreatorSalesTotals;
