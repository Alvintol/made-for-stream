import { creatorTermsSections, creatorTermsVersion } from "../../domain/legal/creatorTerms";
import BackLink from "../../components/layout/BackLink";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  card: "card p-6",
  meta: "text-xs text-zinc-500",
  sectionList: "space-y-5",
  section: "rounded-2xl border border-zinc-200 bg-white p-5",
  sectionTitle: "sectionHeading",
  sectionBody: "mt-3 space-y-3 text-sm text-zinc-700",
} as const;

const CreatorTerms = () => {
  return (
    <div className={classes.page}>
      <BackLink fallback="/legal" />

      <div className={classes.header}>
        <h1 className={classes.h1}>Creator Terms</h1>
        <p className={classes.sub}>
          Rules and obligations for creator applicants and approved creators.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.sectionList}>
          {creatorTermsSections.map((section) => (
            <section key={section.title} className={classes.section}>
              <h2 className={classes.sectionTitle}>{section.title}</h2>

              <div className={classes.sectionBody}>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className={classes.meta}>Version: {creatorTermsVersion}</div>
      </div>

    </div>
  );
};

export default CreatorTerms;