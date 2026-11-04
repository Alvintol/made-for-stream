import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import CreatorEarningsChart from "../../components/sales/CreatorEarningsChart";
import CreatorSalesTotals from "../../components/sales/CreatorSalesTotals";
import { currentSalesMonth } from "../../domain/payments/sales";
import { getListingRequestStatusLabel } from "../../domain/listings/listingRequests";
import { useUnreadMessageCount } from "../../hooks/conversations/useUnreadMessageCount";
import { useCreatorDashboardCounts } from "../../hooks/creatorRequests/useCreatorDashboardCounts";
import { useMyCreatorRequests } from "../../hooks/creatorRequests/useMyCreatorRequests";
import {
  getCreatorPaymentAccountIsReady,
  useCreatorPaymentAccount,
} from "../../hooks/payments/useCreatorPaymentAccount";
import { useT } from "../../lib/i18n/i18n";
const classes = {
  page: "space-y-4",
  header: "flex flex-wrap items-end justify-between gap-3",
  h1: "pageTitle",
  sub: "pageSub",

  stats: "grid grid-cols-2 gap-3 lg:grid-cols-4",
  stat: "card block p-4 transition hover:shadow-[var(--shadow-md)]",
  statLabel: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  statValue: "mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-zinc-900",
  statNote: "mt-0.5 text-xs text-zinc-500",

  // Creator pages the top bar doesn't link to.
  pages: "card flex flex-wrap gap-1 p-1.5",
  pageLink: "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-[rgb(var(--ink)/0.04)] hover:text-zinc-900",

  // The chart sets the height of the first row; the column beside it fills
  // that height without adding to it, so This month's sales lines up with the
  // bottom of the chart. Latest commissions run full width below.
  columns: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]",
  // On a phone, what needs the creator comes before the chart.
  side: "order-first flex flex-col gap-4 lg:order-none lg:h-0 lg:min-h-full",
  // Needs your attention takes the room left, and scrolls if it runs out.
  attention: "card flex min-h-0 flex-col overflow-hidden hover:shadow-[var(--shadow-md)] lg:flex-1",
  attentionRows: "min-h-0 divide-y divide-[var(--hairline)] overflow-y-auto border-t border-[var(--hairline)]",
  latest: "card overflow-hidden hover:shadow-[var(--shadow-md)] lg:col-span-2",
  earnings: "min-w-0 space-y-3",
  earningsTitle: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  earningsNote: "mt-0.5 max-w-2xl text-sm text-zinc-500",
  month: "space-y-3",
  monthTitle: "font-display text-sm font-bold tracking-tight text-zinc-900",
  card: "card overflow-hidden hover:shadow-[var(--shadow-md)]",
  cardHead: "flex items-center justify-between gap-3 px-4 py-3",
  cardTitle: "font-display text-sm font-bold tracking-tight text-zinc-900",
  cardLink: "text-xs font-semibold text-[rgb(var(--accent-text))] hover:underline",
  rows: "divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]",
  row: "flex items-center gap-3 px-4 py-3 transition hover:bg-[rgb(var(--ink)/0.03)]",
  rowMain: "min-w-0 flex-1",
  rowTitle: "truncate text-sm font-semibold text-zinc-900",
  rowSub: "truncate text-xs text-zinc-500",
  pill: "shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700",
  pillNew: "shrink-0 rounded-full bg-[rgb(var(--brand-deep))] px-2 py-0.5 text-[11px] font-semibold text-white",
  empty: "border-t border-[var(--hairline)] px-4 py-6 text-sm text-zinc-500",

} as const;

// The dashboard downloads only the few commissions it lists. Every number on
// it is worked out by the database (useCreatorDashboardCounts, the unread
// count the top bar already reads, and the sales totals), so opening it costs
// the same for a creator with five commissions or five thousand. The full
// lists are a click away and are paged.
const LISTED_COMMISSIONS = 5;

const Stat = ({ to, label, value, note }: { to: string; label: string; value: ReactNode; note: string }) => (
  <Link className={classes.stat} to={to}>
    <div className={classes.statLabel}>{label}</div>
    <div className={classes.statValue}>{value}</div>
    <div className={classes.statNote}>{note}</div>
  </Link>
);

const count = (value: number | undefined) => (value === undefined ? "–" : value);
// The creator's home page: what is waiting on them, what is in progress,
// and the way to everything else.
const CreatorDashboard = () => {
  const t = useT();
  const counts = useCreatorDashboardCounts().data;
  const activeRequests = useMyCreatorRequests({
    view: "active",
    page: 1,
    pageSize: LISTED_COMMISSIONS,
  });
  const unread = useUnreadMessageCount();
  const { data: paymentAccount = null, isLoading: isPaymentAccountLoading } = useCreatorPaymentAccount();

  const active = activeRequests.data?.items ?? [];
  const unreadMessages = unread.data ?? 0;
  const payoutsReady = getCreatorPaymentAccountIsReady(paymentAccount);

  // What needs the creator, most urgent first.
  const attention: Array<{ key: string; to: string; title: string; detail: string }> = [
    ...(!isPaymentAccountLoading && !payoutsReady
      ? [
          {
            key: "payouts",
            to: "/settings/profile",
            title: t("dashboard.payoutsTitle"),
            detail: t("dashboard.payoutsDetail"),
          },
        ]
      : []),
    ...(counts && counts.newRequests > 0
      ? [
          {
            key: "new-requests",
            to: "/creator/requests",
            title: t("dashboard.newRequests", { count: counts.newRequests }),
            detail: t("dashboard.newRequestsDetail"),
          },
        ]
      : []),
    ...(unreadMessages > 0
      ? [
          {
            key: "unread",
            to: "/messages",
            title: t("dashboard.unread", { count: unreadMessages }),
            detail: t("dashboard.unreadDetail"),
          },
        ]
      : []),
  ];

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div>
          <h1 className={classes.h1}>{t("dashboard.title")}</h1>
          <p className={classes.sub}>{t("dashboard.sub")}</p>
        </div>

        <Link className="btnPrimary" to="/creator/listings/new">
          {t("dashboard.create")}
        </Link>
      </div>

      <nav className={classes.pages} aria-label={t("dashboard.pages")}>
        <Link className={classes.pageLink} to="/creator/listings">{t("dashboard.linkListings")}</Link>
        <Link className={classes.pageLink} to="/creator/requests">{t("dashboard.linkCommissions")}</Link>
        <Link className={classes.pageLink} to="/creator/earnings">{t("dashboard.linkSales")}</Link>
        <Link className={classes.pageLink} to="/apply/creator">{t("dashboard.linkApplication")}</Link>
      </nav>

      <div className={classes.stats}>
        <Stat
          to="/creator/requests"
          label={t("dashboard.statNew")}
          value={count(counts?.newRequests)}
          note={t("dashboard.statNewNote")}
        />
        <Stat
          to="/creator/requests"
          label={t("dashboard.statProgress")}
          value={count(counts?.inProgress)}
          note={t("dashboard.statProgressNote", { count: count(counts?.completed) })}
        />
        <Stat
          to="/messages"
          label={t("dashboard.statUnread")}
          value={count(unread.data)}
          note={t("dashboard.statUnreadNote")}
        />
        <Stat
          to="/creator/listings"
          label={t("dashboard.statLive")}
          value={count(counts?.liveListings)}
          note={t("dashboard.drafts", { count: counts?.draftListings ?? 0 })}
        />
      </div>

      <div className={classes.columns}>
        <section className={classes.earnings} aria-label={t("dashboard.earnings")}>
          <div>
            <h2 className={classes.earningsTitle}>{t("dashboard.earnings")}</h2>
            <p className={classes.earningsNote}>{t("sales.monthNote")}</p>
          </div>

          <CreatorEarningsChart />
        </section>

        <div className={classes.side}>
          <section className={classes.attention} aria-label={t("dashboard.attention")}>
            <div className={classes.cardHead}>
              <h2 className={classes.cardTitle}>{t("dashboard.attention")}</h2>
            </div>

            {attention.length > 0 ? (
              <ul className={classes.attentionRows}>
                {attention.map((entry) => (
                  <li key={entry.key}>
                    <Link className={classes.row} to={entry.to}>
                      <span className={classes.rowMain}>
                        <span className={`block ${classes.rowTitle}`}>{entry.title}</span>
                        <span className={`block ${classes.rowSub}`}>{entry.detail}</span>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={classes.empty}>
                {t(counts ? "dashboard.nothing" : "dashboard.checking")}
              </p>
            )}
          </section>

          {/* Always this month: the chart beside it covers any other period. */}
          <section className={classes.month} aria-label={t("dashboard.thisMonth")}>
            <h2 className={classes.monthTitle}>{t("dashboard.thisMonth")}</h2>
            <CreatorSalesTotals month={currentSalesMonth()} stacked />
          </section>
        </div>

        <section className={classes.latest} aria-label={t("buyerRequests.tabActive")}>
          <div className={classes.cardHead}>
            <h2 className={classes.cardTitle}>{t("dashboard.latest")}</h2>
            <Link className={classes.cardLink} to="/creator/requests">
              {t("dashboard.viewAll")}
            </Link>
          </div>

          {active.length > 0 ? (
            <ul className={classes.rows}>
              {active.map((item) => (
                <li key={item.request.id}>
                  <Link className={classes.row} to={`/creator/requests/${item.request.id}`}>
                    <span className={classes.rowMain}>
                      <span className={`block ${classes.rowTitle}`}>
                        {item.request.request_title || item.request.listing_snapshot.title}
                      </span>
                      <span className={`block ${classes.rowSub}`}>
                        {item.buyer?.handle ? `@${item.buyer.handle}` : item.buyer?.display_name ?? t("dashboard.buyerFallback")}
                        {" · "}
                        {item.request.listing_snapshot.title}
                      </span>
                    </span>
                    {item.conversation.has_unread && <span className={classes.pillNew}>{t("buyerRequests.newMessage")}</span>}
                    <span className={classes.pill}>
                      {getListingRequestStatusLabel(item.request.status, undefined, undefined, t)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={classes.empty}>
              {t(activeRequests.isLoading ? "buyerRequests.loading" : "dashboard.noActive")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default CreatorDashboard;
