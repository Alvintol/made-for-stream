import { useState } from "react";
import { Link } from "react-router-dom";

import { siteUpdates, siteVersion } from "../../domain/site/siteUpdates";
import {
  useMarkSiteUpdatesSeen,
  useSiteUpdatePreferenceAtSignIn,
} from "../../hooks/settings/useSiteUpdatePreference";

const classes = {
  wrap: "fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:inset-x-auto sm:right-4 sm:justify-end",
  card: "card max-h-[70vh] w-full max-w-md space-y-3 overflow-y-auto p-5 shadow-lg",
  header: "flex items-start justify-between gap-3",
  title: "font-display text-base font-extrabold tracking-tight",
  version: "text-xs text-zinc-500",
  list: "list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700",
  footer: "flex flex-wrap items-center justify-between gap-3",
  link: "text-sm font-semibold underline underline-offset-2",
  btn: "btnOutline btnSm",
} as const;

// The closable "what's new" window. Shown once per update, the next time a
// person signs in, and only to people who asked for it in Settings ->
// Preferences. Closing it (or following the link) records the version in
// the database, so it does not come back on another device.
const SiteUpdatesNotice = () => {
  const preferenceQuery = useSiteUpdatePreferenceAtSignIn();
  const markSeen = useMarkSiteUpdatesSeen();
  const [closed, setClosed] = useState(false);

  const preference = preferenceQuery.data;
  const latest = siteUpdates[0];

  if (
    closed ||
    !latest ||
    !preference?.showSiteUpdates ||
    preference.lastSeenVersion === siteVersion
  ) {
    return null;
  }

  const close = () => {
    setClosed(true);
    markSeen.mutate(siteVersion);
  };

  return (
    <div className={classes.wrap}>
      <section className={classes.card} role="dialog" aria-label="What's new on Made for Stream">
        <div className={classes.header}>
          <div>
            <h2 className={classes.title}>What&rsquo;s new: {latest.title}</h2>
            <p className={classes.version}>{latest.version}</p>
          </div>

          <button className={classes.btn} type="button" onClick={close}>
            Close
          </button>
        </div>

        <ul className={classes.list}>
          {latest.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>

        <div className={classes.footer}>
          <Link className={classes.link} to="/updates" onClick={close}>
            See all updates
          </Link>
        </div>
      </section>
    </div>
  );
};

export default SiteUpdatesNotice;
