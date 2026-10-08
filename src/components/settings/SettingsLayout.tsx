import { Link, NavLink, Outlet } from "react-router-dom";
import { getProfileAvatarUrl } from "../../domain/profileMedia";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";
import { useMyModerationReports } from "../../hooks/moderation/useMyModerationReports";
import { useMyProfile } from "../../hooks/profile/useMyProfile";
import { useAccountDetails } from "../../hooks/settings/useAccountDetails";
import { useProfilePlatformAccounts } from "../../hooks/profile/useProfilePlatformAccounts";

const classes = {
  page: "space-y-4",
  header: "card px-4 py-3 hover:shadow-[var(--shadow-md)] sm:px-5",
  // A column of pages beside the content on wide screens, a scrolling row
  // above it on narrow ones.
  body: "grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]",
  content: "min-w-0",
  identity: "flex items-center gap-3",
  avatar:
    "h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--hairline-strong)] bg-zinc-100",
  avatarImage: "h-full w-full object-cover",
  avatarFallback:
    "flex h-full w-full items-center justify-center font-display text-sm font-bold text-zinc-600",
  names: "min-w-0 flex-1",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  nameRow: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5",
  name: "truncate font-display text-lg font-bold leading-tight tracking-tight text-zinc-900",
  handle: "block truncate text-xs text-zinc-500 hover:text-zinc-800",
  status: "inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11px] font-semibold",
  statusCreator:
    "border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  statusMember: "border-zinc-200 bg-zinc-100 text-zinc-700",
  // Phones reach the public profile through the @handle link instead.
  profileLink: "btnOutline btnSm hidden shrink-0 sm:inline-flex",

  tabs: "card flex gap-1 overflow-x-auto p-1.5 hover:shadow-[var(--shadow-md)] lg:sticky lg:top-24 lg:flex-col",
  tab: "inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
  tabActive: "bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  tabIdle: "text-zinc-600 hover:bg-[rgb(var(--ink)/0.04)] hover:text-zinc-900",
  count:
    "rounded-full bg-[rgb(var(--accent-soft))] px-1.5 py-px text-[10px] font-bold text-[rgb(var(--accent-text))]",
} as const;

const tabs = [
  { to: "/settings/profile", label: "Profile and setup" },
  { to: "/settings/personal", label: "Personal details" },
  { to: "/settings/preferences", label: "Preferences" },
  { to: "/settings/reports", label: "My reports" },
] as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

// Shared frame for settings pages: a compact identity card, then the list of
// settings pages beside whichever one is open.
const SettingsLayout = () => {
  const { data: profile } = useMyProfile();
  const { data: platformAccounts = [] } = useProfilePlatformAccounts();
  const { data: reports = [] } = useMyModerationReports();
  const { isCreatorApproved } = useSellerAccess();
  const accountDetails = useAccountDetails();
  const needsAccountDetails = accountDetails.isSuccess && !accountDetails.data;

  const twitchAccount = platformAccounts.find((account) => account.platform === "twitch") ?? null;
  const avatarUrl = getProfileAvatarUrl(profile, twitchAccount);
  const handle = profile?.handle?.trim() ?? "";
  const displayName = profile?.display_name?.trim() || handle || "Your account";
  const unreadReports = reports.filter((report) => report.has_unread_update).length;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.identity}>
          <div className={classes.avatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={classes.avatarImage} />
            ) : (
              <div className={classes.avatarFallback} aria-hidden="true">
                {initials(displayName)}
              </div>
            )}
          </div>

          <div className={classes.names}>
            <div className={classes.eyebrow}>Settings</div>
            <div className={classes.nameRow}>
              <span className={classes.name}>{displayName}</span>
              <span
                className={`${classes.status} ${isCreatorApproved ? classes.statusCreator : classes.statusMember}`}
              >
                {isCreatorApproved ? "Creator" : "Member"}
              </span>
            </div>
            {handle && (
              <Link className={classes.handle} to={`/creator/${handle}`}>
                @{handle}
              </Link>
            )}
          </div>

          {handle && (
            <Link className={classes.profileLink} to={`/creator/${handle}`}>
              View profile
            </Link>
          )}
        </div>
      </header>

      <div className={classes.body}>
        <nav className={classes.tabs} aria-label="Settings pages">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `${classes.tab} ${isActive ? classes.tabActive : classes.tabIdle}`
              }
            >
              {tab.label}
              {tab.to === "/settings/personal" && needsAccountDetails && (
                <span className={classes.count}>Required</span>
              )}
              {tab.to === "/settings/reports" && unreadReports > 0 && (
                <span className={classes.count}>
                  {unreadReports}
                  <span className="sr-only"> new updates</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={classes.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
