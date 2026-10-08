import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getListingRequestStatusLabel } from "../../domain/listings/listingRequests";
import { useMessagesInbox } from "../../hooks/conversations/useMessagesInbox";
import { useCreatorDashboardCounts } from "../../hooks/creatorRequests/useCreatorDashboardCounts";
import { useMyCreatorRequests } from "../../hooks/creatorRequests/useMyCreatorRequests";
import {
  getCreatorPaymentAccountIsReady,
  useCreatorPaymentAccount,
} from "../../hooks/payments/useCreatorPaymentAccount";

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

  columns: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]",
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

  links: "grid gap-1 border-t border-[var(--hairline)] p-2",
  link: "rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-[rgb(var(--ink)/0.04)] hover:text-zinc-900",
} as const;

// The dashboard downloads only the few commissions it lists. Every number on
// it is a count worked out by the database (useCreatorDashboardCounts), so
// opening it costs the same for a creator with five commissions or five
// thousand. The full lists are a click away and are paged.
const LISTED_COMMISSIONS = 5;

const Stat = ({ to, label, value, note }: { to: string; label: string; value: ReactNode; note: string }) => (
  <Link className={classes.stat} to={to}>
    <div className={classes.statLabel}>{label}</div>
    <div className={classes.statValue}>{value}</div>
    <div className={classes.statNote}>{note}</div>
  </Link>
);

const count = (value: number | undefined) => (value === undefined ? "–" : value);

const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

// The creator's home page: what is waiting on them, what is in progress,
// and the way to everything else.
const CreatorDashboard = () => {
  const counts = useCreatorDashboardCounts().data;
  const activeRequests = useMyCreatorRequests({
    view: "active",
    page: 1,
    pageSize: LISTED_COMMISSIONS,
  });
  const inbox = useMessagesInbox();
  const { data: paymentAccount = null, isLoading: isPaymentAccountLoading } = useCreatorPaymentAccount();

  const active = activeRequests.data?.items ?? [];
  const unreadMessages = inbox.data?.totalUnreadCount ?? 0;
  const payoutsReady = getCreatorPaymentAccountIsReady(paymentAccount);

  // What needs the creator, most urgent first.
  const attention: Array<{ key: string; to: string; title: string; detail: string }> = [
    ...(!isPaymentAccountLoading && !payoutsReady
      ? [
          {
            key: "payouts",
            to: "/settings/profile",
            title: "Finish payout setup",
            detail: "You cannot publish paid listings or be paid until Stripe is ready.",
          },
        ]
      : []),
    ...(counts && counts.newRequests > 0
      ? [
          {
            key: "new-requests",
            to: "/creator/requests",
            title: plural(counts.newRequests, "new commission request", "new commission requests"),
            detail: "Waiting for you to accept or decline.",
          },
        ]
      : []),
    ...(unreadMessages > 0
      ? [
          {
            key: "unread",
            to: "/messages",
            title: plural(unreadMessages, "unread message", "unread messages"),
            detail: "Open your inbox to read them.",
          },
        ]
      : []),
  ];

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div>
          <h1 className={classes.h1}>Creator dashboard</h1>
          <p className={classes.sub}>What is waiting on you, and what is in progress.</p>
        </div>

        <Link className="btnPrimary" to="/creator/listings/new">
          Create listing
        </Link>
      </div>

      <div className={classes.stats}>
        <Stat
          to="/creator/requests"
          label="New requests"
          value={count(counts?.newRequests)}
          note="Waiting for your answer"
        />
        <Stat
          to="/creator/requests"
          label="In progress"
          value={count(counts?.inProgress)}
          note={`${count(counts?.completed)} completed so far`}
        />
        <Stat
          to="/messages"
          label="Unread messages"
          value={count(inbox.data?.totalUnreadCount)}
          note="Across all conversations"
        />
        <Stat
          to="/creator/listings"
          label="Live listings"
          value={count(counts?.liveListings)}
          note={plural(counts?.draftListings ?? 0, "draft", "drafts")}
        />
      </div>

      <div className={classes.columns}>
        <div className="space-y-4">
          <section className={classes.card} aria-label="Needs your attention">
            <div className={classes.cardHead}>
              <h2 className={classes.cardTitle}>Needs your attention</h2>
            </div>

            {attention.length > 0 ? (
              <ul className={classes.rows}>
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
                {counts ? "Nothing is waiting on you." : "Checking…"}
              </p>
            )}
          </section>

          <section className={classes.card} aria-label="Active commissions">
            <div className={classes.cardHead}>
              <h2 className={classes.cardTitle}>Latest active commissions</h2>
              <Link className={classes.cardLink} to="/creator/requests">
                View all
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
                          {item.buyer?.handle ? `@${item.buyer.handle}` : item.buyer?.display_name ?? "Buyer"}
                          {" · "}
                          {item.request.listing_snapshot.title}
                        </span>
                      </span>
                      {item.conversation.has_unread && <span className={classes.pillNew}>New message</span>}
                      <span className={classes.pill}>
                        {getListingRequestStatusLabel(item.request.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={classes.empty}>
                {activeRequests.isLoading
                  ? "Loading commissions…"
                  : "No active commissions. New requests from buyers appear here."}
              </p>
            )}
          </section>
        </div>

        <nav className={classes.card} aria-label="Creator pages">
          <div className={classes.cardHead}>
            <h2 className={classes.cardTitle}>Go to</h2>
          </div>
          <div className={classes.links}>
            <Link className={classes.link} to="/creator/listings">My listings</Link>
            <Link className={classes.link} to="/creator/requests">Commissions</Link>
            <Link className={classes.link} to="/creator/requests/completed">Completed commissions</Link>
            <Link className={classes.link} to="/messages">Inbox</Link>
            <Link className={classes.link} to="/settings/profile">Profile and payouts</Link>
            <Link className={classes.link} to="/apply/creator">Creator application</Link>
            <Link className={classes.link} to="/market">Browse the market</Link>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default CreatorDashboard;
