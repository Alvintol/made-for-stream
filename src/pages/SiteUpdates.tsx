import { siteUpdates, siteVersion } from "../domain/site/siteUpdates";

const classes = {
  shell: "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6",
  title: "pageTitle",
  text: "text-sm leading-6 text-zinc-600",
  card: "card space-y-3 p-6",
  entryTitle: "font-display text-base font-extrabold tracking-tight",
  meta: "text-xs text-zinc-500",
  current: "ml-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800",
  list: "list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700",
} as const;

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00.000Z`),
  );

// Every update to the site, newest first. Linked from the footer and from
// the "what's new" window. Open to everyone, signed in or not.
const SiteUpdates = () => (
  <div className={classes.shell}>
    <div>
      <h1 className={classes.title}>What&rsquo;s new</h1>
      <p className={classes.text}>
        Made for Stream is in beta and changes often. Every update is listed here, newest
        first. The current version is {siteVersion}. Updates are never sent by email; if
        you would like to be shown the latest changes once, the next time you sign in
        after an update, turn that on in Settings, under Preferences.
      </p>
    </div>

    {siteUpdates.map((update) => (
      <section className={classes.card} key={update.version}>
        <div>
          <h2 className={classes.entryTitle}>
            {update.title}
            {update.version === siteVersion && (
              <span className={classes.current}>Current version</span>
            )}
          </h2>
          <p className={classes.meta}>
            Version {update.version} &middot; {formatDate(update.date)}
          </p>
        </div>

        <ul className={classes.list}>
          {update.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);

export default SiteUpdates;
