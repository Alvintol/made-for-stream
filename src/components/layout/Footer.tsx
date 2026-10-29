import { Link } from "react-router-dom";
import { siteVersion } from "../../domain/site/siteUpdates";
import { useT } from "../../lib/i18n/i18n";
import { useCookiePreferences } from "../../providers/CookiePreferencesProvider";

const classes = {
  footer: "mt-16 border-t border-[var(--hairline)] bg-[rgb(var(--surface)/0.55)]",
  inner: "container mx-auto grid gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]",
  brand: "space-y-3",
  brandRow: "inline-flex items-center gap-2.5",
  brandMark: "brandMark h-8 w-8",
  brandText: "font-display text-lg font-extrabold tracking-tight",
  brandAccent: "text-[rgb(var(--brand))]",
  tagline: "max-w-xs text-sm leading-6 text-zinc-600",
  column: "space-y-3",
  columnTitle: "text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500",
  nav: "flex flex-col gap-2 text-sm",
  link: "text-zinc-600 transition hover:text-[rgb(var(--accent-text))]",
  linkButton: "text-left text-zinc-600 transition hover:text-[rgb(var(--accent-text))]",
  bottom:
    "container mx-auto flex flex-col gap-2 border-t border-[var(--hairline)] px-4 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6",
  credit: "text-zinc-500",
  creditLink: "font-medium text-zinc-600 underline-offset-2 transition hover:text-[rgb(var(--accent-text))] hover:underline",
} as const;

const Footer = () => {
  const t = useT();
  const year = new Date().getFullYear();
  const { openSettings } = useCookiePreferences();

  return (
    <footer className={classes.footer}>
      <div className={classes.inner}>
        <div className={classes.brand}>
          <Link to="/" className={classes.brandRow} aria-label={t("footer.home")}>
            <img src="/made-for-stream-mark.svg" alt="" className={classes.brandMark} draggable={false} />
            <span className={classes.brandText}>
              Made for <span className={classes.brandAccent}>Stream</span>
            </span>
          </Link>

          <p className={classes.tagline}>{t("footer.tagline")}</p>
        </div>

        <div className={classes.column}>
          <div className={classes.columnTitle}>{t("footer.explore")}</div>
          <nav className={classes.nav} aria-label={t("footer.exploreNav")}>
            <Link className={classes.link} to="/market">{t("nav.market")}</Link>
            <Link className={classes.link} to="/creators">{t("nav.creators")}</Link>
            <Link className={classes.link} to="/live">{t("footer.liveNow")}</Link>
            <Link className={classes.link} to="/about">{t("footer.about")}</Link>
          </nav>
        </div>

        <div className={classes.column}>
          <div className={classes.columnTitle}>{t("footer.legal")}</div>
          <nav className={classes.nav} aria-label={t("footer.legalNav")}>
            <Link className={classes.link} to="/legal">
              {t("footer.legal")}
            </Link>

            <Link className={classes.link} to="/terms">
              {t("footer.terms")}
            </Link>

            <Link className={classes.link} to="/privacy">
              {t("footer.privacy")}
            </Link>

            <Link className={classes.link} to="/terms/creator">
              {t("footer.creatorTerms")}
            </Link>

            <button className={classes.linkButton} type="button" onClick={openSettings}>
              {t("footer.cookieSettings")}
            </button>
          </nav>
        </div>
      </div>

      <div className={classes.bottom}>
        <div>{t("footer.copyright", { year })}</div>

        <div className={classes.credit}>
          {siteVersion} •{" "}
          <Link className={classes.creditLink} to="/updates">
            {t("footer.whatsNew")}
          </Link>
        </div>

        <div className={classes.credit}>
          {t("footer.builtBy")}{" "}
          <a
            className={classes.creditLink}
            href="https://www.twitch.tv/ImAllBeans"
            target="_blank"
            rel="noreferrer"
          >
            @ImAllBeans
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
