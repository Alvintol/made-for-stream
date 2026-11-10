import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "../../hooks/notifications/useNotifications";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
import { actionMenuItemClasses } from "../ui/ActionMenu";

// The bell on the top bar: the latest commission updates, the same ones that
// are emailed (NOTIF-006, docs/support/messaging/commission-notifications.md).
// The list drops down over the page, so the bar never changes size beyond the
// number on the bell, like the inbox's.
const classes = {
  wrap: "relative shrink-0",
  button: "navPill navPillIdle inline-flex items-center justify-center whitespace-nowrap",
  count: "navPillCount",
  panel: "navMenu right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)]",
  heading: "px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500",
  item: `${actionMenuItemClasses.item} flex-col !items-start gap-0.5`,
  fresh: "bg-[rgb(var(--accent-soft))]",
  title: "line-clamp-2 font-medium",
  when: "text-xs font-normal text-zinc-500",
  empty: "px-3 py-2 text-sm text-zinc-500",
} as const;

const BellIcon = () => (
  <svg
    aria-hidden="true"
    className="navIcon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const NotificationBell = () => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  // What was unread when the bell opened, still marked while it stays open.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());

  const unread = notifications.filter((notification) => !notification.read_at);
  const label =
    unread.length > 0
      ? t("nav.notificationsUnread", { count: unread.length })
      : t("nav.notifications");

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setFreshIds(new Set(unread.map((notification) => notification.id)));
    setOpen(true);

    if (unread.length > 0) markRead.mutate();
  };

  return (
    <div
      className={classes.wrap}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className={classes.button}
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon />

        {unread.length > 0 && (
          <span className={classes.count}>{unread.length > 9 ? "9+" : unread.length}</span>
        )}
      </button>

      {open && (
        <div className={classes.panel} role="region" aria-label={t("nav.notifications")}>
          <p className={classes.heading}>{t("nav.notifications")}</p>

          {notifications.length === 0 ? (
            <p className={classes.empty}>{t("notifications.empty")}</p>
          ) : (
            notifications.map((notification) => {
              const body = (
                <>
                  <span className={classes.title}>{notification.title}</span>
                  <span className={classes.when}>
                    {new Date(notification.created_at).toLocaleString(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </>
              );
              const className = `${classes.item} ${freshIds.has(notification.id) ? classes.fresh : ""}`;

              return notification.link_path ? (
                <Link
                  key={notification.id}
                  to={notification.link_path}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {body}
                </Link>
              ) : (
                <div key={notification.id} className={className}>
                  {body}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
