import { Link } from "react-router-dom";
import { usePaymentsLive } from "../../hooks/site/usePaymentsLive";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  bar: "border-b border-[var(--hairline)] bg-[rgb(var(--brand)/0.08)] px-4 py-2 text-center text-xs text-zinc-700 sm:text-sm",
  link: "font-semibold text-[rgb(var(--accent-text))] underline underline-offset-2",
} as const;

// Shown on every page until payments open. Never dismissed, so nothing
// below it moves once the page has loaded.
const LaunchBanner = () => {
  const t = useT();
  const live = usePaymentsLive();

  if (live) return null;

  return (
    <div className={classes.bar} role="note">
      {t("launch.banner")}{" "}
      <Link className={classes.link} to="/apply/creator">
        {t("launch.bannerApply")}
      </Link>
    </div>
  );
};

export default LaunchBanner;
