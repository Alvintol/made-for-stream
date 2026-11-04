import { Fragment } from "react";
import { Link } from "react-router-dom";
import BackLink from "../layout/BackLink";

/**
 * Shared renderer for the `{ title, body: string[] }[]` shape used by every
 * module in `src/domain/legal/`. The existing Terms/Privacy/CreatorTerms
 * pages render paragraphs directly and are left untouched here (no existing
 * behaviour or tests change); this component is opt-in for the new policy
 * pages and can be adopted by the older three later if useful.
 *
 * Two small upgrades over a plain `<p>` per string, both flagged as needed
 * in the legal-policy review notes:
 *  - bare "(https://...)" URLs become real links instead of dead text
 *  - a "Label: value; Label: value" line (used deliberately by the new
 *    drafts for fee tables, retention schedules, content-example tables,
 *    etc.) renders as a small definition table instead of a run-on sentence
 */

export type LegalSection = {
  title: string;
  body: readonly string[];
};

type LegalPolicySectionsProps = {
  title: string;
  subtitle: string;
  sections: readonly LegalSection[];
  version: string;
};

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  draftBanner:
    "rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900",

  card: "card p-6",
  meta: "text-xs text-zinc-500",
  sectionList: "space-y-5",
  section: "rounded-2xl border border-zinc-200 bg-white p-5",
  sectionTitle: "sectionHeading",
  sectionBody: "mt-3 space-y-3 text-sm text-zinc-700",

  table: "grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]",
  tableLabel: "font-semibold text-zinc-900",
  tableValue: "text-zinc-700",
} as const;

// External URLs, and site paths under /policies/ (e.g. the Service Provider
// Register, which the Privacy Policy points to).
const LINK_PATTERN = /^(https?:\/\/[^\s)]+|\/policies\/[a-z-]+)$/;
const LINK_SPLIT_PATTERN = /(https?:\/\/[^\s)]+|\/policies\/[a-z-]+)/g;

const linkClassName =
  "font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900";

// Renders a paragraph, turning any bare URLs and policy paths into real links.
const LinkedText = ({ text }: { text: string }) => {
  const parts = text.split(LINK_SPLIT_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        LINK_PATTERN.test(part) && part.startsWith("/") ? (
          <Link key={index} to={part} className={linkClassName}>
            {part}
          </Link>
        ) : LINK_PATTERN.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className={linkClassName}
          >
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
};

// A line like "Label: value; Label: value; Label: value" (2+ pairs) renders
// as a small definition table instead of a run-on sentence.
const parseTableRow = (line: string): Array<[string, string]> | null => {
  const segments = line.split(";").map((segment) => segment.trim());

  if (segments.length < 2) return null;

  const pairs: Array<[string, string]> = [];

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex <= 0) return null;

    const label = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!label || !value) return null;

    pairs.push([label, value]);
  }

  return pairs;
};

const Paragraph = ({ text }: { text: string }) => {
  const tableRow = parseTableRow(text);

  if (tableRow) {
    return (
      <div className={classes.table}>
        {tableRow.map(([label, value]) => (
          <Fragment key={label}>
            <div className={classes.tableLabel}>{label}</div>
            <div className={classes.tableValue}>
              <LinkedText text={value} />
            </div>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <p>
      <LinkedText text={text} />
    </p>
  );
};

const LegalPolicySections = ({
  title,
  subtitle,
  sections,
  version,
}: LegalPolicySectionsProps) => {
  const isDraft = version.includes("draft");

  return (
    <div className={classes.page}>
      <BackLink fallback="/legal" />

      <div className={classes.header}>
        <h1 className={classes.h1}>{title}</h1>
        <p className={classes.sub}>{subtitle}</p>
      </div>

      {isDraft && (
        <div className={classes.draftBanner}>
          Review draft — not yet in effect. Contains placeholder fields
          (shown in brackets) that must be resolved before this policy is
          published or linked publicly.
        </div>
      )}

      <div className={classes.card}>
        <div className={classes.sectionList}>
          {sections.map((section) => (
            <section key={section.title} className={classes.section}>
              <h2 className={classes.sectionTitle}>{section.title}</h2>

              <div className={classes.sectionBody}>
                {section.body.map((paragraph) => (
                  <Paragraph key={paragraph} text={paragraph} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className={classes.meta}>Version: {version}</div>
      </div>
    </div>
  );
};

export default LegalPolicySections;
