type ListingRequestSubmissionDetailsProps = {
  requestTitle?: string | null;
  requestDetails?: string | null;
  fallbackMessage?: string | null;
  requestedTimeline?: string | null;
  budgetAmount?: number | string | null;
  referenceLinks?: string[] | null;
};

const classes = {
  body: "space-y-3",
  title: "font-display text-base font-bold tracking-tight text-zinc-900",
  details: "whitespace-pre-wrap text-sm leading-6 text-zinc-700",
  facts: "grid grid-cols-2 divide-x divide-[var(--hairline)] rounded-xl border border-[var(--hairline)] text-sm",
  fact: "space-y-0.5 px-3 py-2",
  factLabel: "metaLabel",
  factValue: "metaValue",
  linksLabel: "metaLabel",
  links: "flex flex-wrap gap-1.5",
  link:
    "max-w-full truncate rounded-full border border-[var(--hairline-strong)] px-3 py-1 text-xs font-medium text-[rgb(var(--accent-text))] transition hover:bg-[rgb(var(--accent-soft))]",
  none: "text-xs text-zinc-500",
} as const;

const cleanText = (value?: string | null): string => value?.trim() ?? "";

const cleanLinks = (links?: string[] | null): string[] =>
  (links ?? []).map((link) => link.trim()).filter(Boolean);

const formatBudgetAmount = (value?: number | string | null): string => {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Not provided";
  }

  return numericValue % 1 === 0 ? `$${numericValue}` : `$${numericValue.toFixed(2)}`;
};

// Rendered inside a workspace section, which supplies the title and collapse.
const ListingRequestSubmissionDetails = ({
  requestTitle,
  requestDetails,
  fallbackMessage,
  requestedTimeline,
  budgetAmount,
  referenceLinks,
}: ListingRequestSubmissionDetailsProps) => {
  const titleText = cleanText(requestTitle);
  const detailsText = cleanText(requestDetails) || cleanText(fallbackMessage);
  const timelineText = cleanText(requestedTimeline);
  const links = cleanLinks(referenceLinks);

  return (
    <div className={classes.body}>
      <p className={classes.title}>{titleText || "No commission summary provided."}</p>

      <p className={classes.details}>{detailsText || "No commission details provided."}</p>

      <dl className={classes.facts}>
        <div className={classes.fact}>
          <dt className={classes.factLabel}>Timeline</dt>
          <dd className={classes.factValue}>{timelineText || "Not provided"}</dd>
        </div>

        <div className={classes.fact}>
          <dt className={classes.factLabel}>Budget</dt>
          <dd className={classes.factValue}>{formatBudgetAmount(budgetAmount)}</dd>
        </div>
      </dl>

      <div className="space-y-1.5">
        <div className={classes.linksLabel}>References</div>

        {links.length > 0 ? (
          <div className={classes.links}>
            {links.map((link) => (
              <a key={link} className={classes.link} href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            ))}
          </div>
        ) : (
          <p className={classes.none}>No Reference Links Provided.</p>
        )}
      </div>
    </div>
  );
};

export default ListingRequestSubmissionDetails;
