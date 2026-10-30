import { Link } from "react-router-dom";
import { useT } from "../lib/i18n/i18n";
const classes = {
  page: "space-y-8",

  hero: "card p-6",
  h1: "pageTitle",
  lead: "mt-2 text-sm text-zinc-600",
  heroActions: "mt-5 flex flex-wrap gap-3",

  grid: "grid gap-4 lg:grid-cols-2",
  section: "card p-6 space-y-3",
  h2: "font-display text-xl font-extrabold tracking-tight",
  p: "text-sm text-zinc-700 leading-6",

  list: "space-y-2 text-sm text-zinc-700",
  li: "flex gap-2",
  bullet: "mt-1 h-2 w-2 rounded-full bg-[rgb(var(--brand))] shrink-0",

  chipRow: "flex flex-wrap gap-2",
  chip: "chip",

  note: "card p-5 border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.12)]",
  noteTitle: "text-sm font-extrabold text-zinc-900",
  noteText: "mt-1 text-sm text-zinc-700",

  link: "underline underline-offset-2 hover:text-zinc-900",
} as const;

const About = () => {
  const t = useT();

  return (
    <div className={classes.page}>
      <section className={classes.hero}>
        <h1 className={classes.h1}>{t("about.title")}</h1>
        <p className={classes.lead}>{t("about.lead")}</p>

        <div className={classes.heroActions}>
          <Link to="/market" className="btnPrimary">
            {t("about.browse")}
          </Link>
          <Link to="/creators" className="btnOutline">
            {t("about.creators")}
          </Link>
          <Link to="/live" className="btnOutline">
            {t("about.live")}
          </Link>
        </div>
      </section>

      <section className={classes.grid}>
        <div className={classes.section}>
          <h2 className={classes.h2}>{t("about.whatTitle")}</h2>
          <p className={classes.p}>{t("about.whatText")}</p>

          <div className={classes.chipRow}>
            <span className={classes.chip}>{t("category.emotes")}</span>
            <span className={classes.chip}>{t("category.overlays")}</span>
            <span className={classes.chip}>PNG/VTuber</span>
            <span className={classes.chip}>{t("about.chipRigging")}</span>
            <span className={classes.chip}>{t("category.video-editing")}</span>
            <span className={classes.chip}>{t("category.audio-tech-help")}</span>
          </div>
        </div>

        <div className={classes.section}>
          <h2 className={classes.h2}>{t("about.doTitle")}</h2>
          <ul className={classes.list}>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.do1")}
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.do2")}
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.do3")}
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.do4")}
            </li>
          </ul>
          <p className={classes.p}>{t("about.beta")}</p>
        </div>
      </section>

      <section className={classes.grid}>
        <div className={classes.section}>
          <h2 className={classes.h2}>{t("about.policyTitle")}</h2>
          <p className={classes.p}>
            <strong>{t("about.policyHuman")}</strong> {t("about.policyHumanText")}
          </p>
          <p className={classes.p}>{t("about.policyReports")}</p>
        </div>

        <div className={classes.section}>
          <h2 className={classes.h2}>{t("about.trustTitle")}</h2>
          <ul className={classes.list}>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.trust1")}
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.trust2")}
            </li>
            <li className={classes.li}>
              <span className={classes.bullet} />
              {t("about.trust3")}
            </li>
          </ul>
        </div>
      </section>

      <section className={classes.note}>
        <div className={classes.noteTitle}>{t("about.builtBy")}</div>
        <p className={classes.noteText}>
          {t("about.follow")}{" "}
          <a
            className={classes.link}
            href="https://www.twitch.tv/ImAllBeans"
            target="_blank"
            rel="noreferrer"
          >
            @ImAllBeans
          </a>
          {t("about.followEnd")}
        </p>
      </section>
    </div>
  );
};

export default About;