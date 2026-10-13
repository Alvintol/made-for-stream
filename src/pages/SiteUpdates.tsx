import { useState } from "react";

import { siteUpdates, siteUpdatesPageSize, siteVersion } from "../domain/site/siteUpdates";

const classes = {
  shell: "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6",
  title: "pageTitle",
  text: "text-sm leading-6 text-zinc-600",
  versions: "card divide-y divide-zinc-200 p-0",
  summary:
    "flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-6 py-4 text-sm font-semibold",
  date: "font-normal text-zinc-500",
  chevron: "ml-auto text-xl leading-none text-zinc-400 transition-transform group-open:rotate-90",
  current: "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800",
  body: "space-y-3 px-6 pb-5",
  entryTitle: "font-display text-base font-extrabold tracking-tight",
  list: "list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700",
  pager: "flex items-center justify-between gap-3",
  pagerText: "text-xs text-zinc-500",
  btn: "btnOutline btnSm",
} as const;

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00.000Z`),
  );

// Every version of the site, newest first, ten at a time. Each row is a
// version number and its date; choosing one shows what changed in it, and
// the latest is open on arrival. Linked from the footer and from the
// "what's new" window. Open to everyone, signed in or not.
//
// ponytail: the whole list ships with the page and only ten rows are drawn;
// move it to a fetched file if it ever grows past a few hundred versions.
const SiteUpdates = () => {
  const [page, setPage] = useState(0);

  const first = page * siteUpdatesPageSize;
  const shown = siteUpdates.slice(first, first + siteUpdatesPageSize);
  const last = first + shown.length;

  return (
    <div className={classes.shell}>
      <div>
        <h1 className={classes.title}>What&rsquo;s new</h1>
        <p className={classes.text}>
          Made for Stream is in beta and changes often. Every version is listed here,
          newest first: choose one to see what changed in it. The current version is{" "}
          {siteVersion}. Updates are never sent by email; if you would like to be shown
          the latest changes once, the next time you sign in after an update, turn that
          on in Settings, under Preferences.
        </p>
      </div>

      <div className={classes.versions}>
        {shown.map((update) => (
          // Sharing a name lets the browser keep one version open at a time.
          <details
            className="group"
            key={update.version}
            name="site-version"
            open={update.version === siteVersion}
          >
            <summary className={classes.summary}>
              <span>{update.version}</span>
              <span className={classes.date}>{formatDate(update.date)}</span>
              {update.version === siteVersion && (
                <span className={classes.current}>Current version</span>
              )}
              <span className={classes.chevron} aria-hidden="true">
                &rsaquo;
              </span>
            </summary>

            <div className={classes.body}>
              <h2 className={classes.entryTitle}>{update.title}</h2>
              <ul className={classes.list}>
                {update.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>

      {siteUpdates.length > siteUpdatesPageSize && (
        <nav className={classes.pager} aria-label="More versions">
          <button
            className={classes.btn}
            type="button"
            aria-label="Newer versions"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            &larr;
          </button>
          <span className={classes.pagerText}>
            Versions {first + 1} to {last} of {siteUpdates.length}
          </span>
          <button
            className={classes.btn}
            type="button"
            aria-label="Older versions"
            disabled={last >= siteUpdates.length}
            onClick={() => setPage(page + 1)}
          >
            &rarr;
          </button>
        </nav>
      )}
    </div>
  );
};

export default SiteUpdates;
