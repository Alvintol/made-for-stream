import DisplayCurrencySettings from "../components/settings/DisplayCurrencySettings";
import { useMarketingEmails, useSaveMarketingEmails } from "../hooks/settings/useAccountDetails";
import {
  useSaveSiteUpdatePreference,
  useSiteUpdatePreference,
} from "../hooks/settings/useSiteUpdatePreference";

const classes = {
  page: "space-y-4",
  card: "card space-y-4 p-5 hover:shadow-[var(--shadow-md)]",
  title: "font-display text-lg font-bold tracking-tight text-zinc-900",
  checkboxRow: "flex items-start gap-3",
  checkbox: "mt-1 h-4 w-4 shrink-0 rounded border-zinc-300",
  checkboxLabel: "text-sm font-semibold text-zinc-900",
  hint: "formHint",
  status: "text-xs font-medium text-emerald-700",
  error: "notice noticeError",
} as const;

// Settings → Preferences: language and display currency, and the opt-in for
// promotional email (public.user_email_preferences, 20261008_150).
const PreferencesSettings = () => {
  const marketingQuery = useMarketingEmails();
  const saveMarketing = useSaveMarketingEmails();
  const siteUpdatesQuery = useSiteUpdatePreference();
  const saveSiteUpdates = useSaveSiteUpdatePreference();

  return (
    <div className={classes.page}>
      <section className={classes.card}>
        <h1 className={classes.title}>Language and currency</h1>
        <DisplayCurrencySettings />
      </section>

      <section className={classes.card}>
        <h2 className={classes.title}>Emails</h2>

        {/* Never ticked for anyone: the person turns it on themselves. */}
        <label className={classes.checkboxRow}>
          <input
            type="checkbox"
            className={classes.checkbox}
            checked={marketingQuery.data ?? false}
            disabled={marketingQuery.isLoading || saveMarketing.isPending}
            onChange={(event) => saveMarketing.mutate(event.currentTarget.checked)}
          />
          <span>
            <span className={classes.checkboxLabel}>
              Send me Made for Stream news, offers and monthly updates by email
            </span>
            <span className={`block ${classes.hint}`}>
              Optional. You can turn this off here at any time. Emails about your account, your
              commissions and your payments are sent either way.
            </span>
          </span>
        </label>

        {saveMarketing.isSuccess && !saveMarketing.isPending && (
          <div className={classes.status} role="status">
            Saved.
          </div>
        )}

        {saveMarketing.error && (
          <div className={classes.error} role="alert">
            Your choice could not be saved. Please try again.
          </div>
        )}
      </section>

      <section className={classes.card}>
        <h2 className={classes.title}>Site updates</h2>

        {/* Never ticked for anyone: the person turns it on themselves. */}
        <label className={classes.checkboxRow}>
          <input
            type="checkbox"
            className={classes.checkbox}
            checked={siteUpdatesQuery.data?.showSiteUpdates ?? false}
            disabled={siteUpdatesQuery.isLoading || saveSiteUpdates.isPending}
            onChange={(event) => saveSiteUpdates.mutate(event.currentTarget.checked)}
          />
          <span>
            <span className={classes.checkboxLabel}>
              Show me what&rsquo;s new after the site is updated
            </span>
            <span className={`block ${classes.hint}`}>
              Optional. Once per update, the next time you sign in, a small window lists the
              latest changes; you can close it straight away. Site updates are never sent by
              email. The full list is always on the{" "}
              <a className="underline underline-offset-2" href="/updates">
                What&rsquo;s new
              </a>{" "}
              page.
            </span>
          </span>
        </label>

        {saveSiteUpdates.isSuccess && !saveSiteUpdates.isPending && (
          <div className={classes.status} role="status">
            Saved.
          </div>
        )}

        {saveSiteUpdates.error && (
          <div className={classes.error} role="alert">
            Your choice could not be saved. Please try again.
          </div>
        )}
      </section>
    </div>
  );
};

export default PreferencesSettings;
