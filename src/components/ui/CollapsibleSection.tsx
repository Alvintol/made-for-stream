import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Disclosure, prefersReducedMotion } from "../../lib/motion";

type CollapsibleSectionProps = {
  // DOM id, so other controls can link or scroll to the section.
  id?: string;
  title: ReactNode;
  summary?: ReactNode;
  // Extra content beside the chevron, e.g. a status pill.
  badge?: ReactNode;
  attention?: boolean;
  attentionLabel?: string;
  defaultOpen?: boolean;
  // Changing this to a new truthy value opens the section and scrolls it into view.
  focusKey?: number | string | null;
  headingLevel?: "h2" | "h3";
  panelClassName?: string;
  children: ReactNode;
};

const classes = {
  // Clears the sticky site header, plus the mobile tab bars below lg.
  section: "scroll-mt-36 lg:scroll-mt-24",
  toggle:
    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[rgb(var(--ink)/0.03)] focus-visible:bg-[rgb(var(--accent-soft))] focus-visible:outline-none sm:px-5",
  heading: "min-w-0 flex-1",
  title: "block font-display text-sm font-bold tracking-tight text-zinc-900",
  summary: "mt-0.5 block truncate text-xs text-zinc-500",
  aside: "flex shrink-0 items-center gap-2",
  attention:
    "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800",
  chevron: "h-4 w-4 text-zinc-500 transition-transform duration-200",
  panel: "workspacePanel space-y-4 px-4 pb-5 sm:px-5",
} as const;

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={`${classes.chevron} ${open ? "rotate-180" : ""}`}
    aria-hidden="true"
  >
    <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A header row that expands its panel in place; content stays mounted while closed.
const CollapsibleSection = ({
  id,
  title,
  summary,
  badge,
  attention = false,
  attentionLabel = "Needs attention",
  defaultOpen = false,
  focusKey = null,
  headingLevel: Heading = "h2",
  panelClassName = classes.panel,
  children,
}: CollapsibleSectionProps) => {
  const panelId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  // null follows defaultOpen (which can flip once data loads); a click pins the viewer's choice.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [openedForKey, setOpenedForKey] = useState<typeof focusKey>(null);
  const isOpen = openOverride ?? (defaultOpen || attention);

  // A new focus request opens the section (while rendering, not in an
  // effect); the effect only scrolls to it.
  if (focusKey && focusKey !== openedForKey) {
    setOpenedForKey(focusKey);
    setOpenOverride(true);
  }

  useEffect(() => {
    if (!focusKey) return undefined;

    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView?.({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusKey]);

  return (
    <section ref={sectionRef} id={id} className={classes.section}>
      <Heading>
        <button
          type="button"
          className={classes.toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpenOverride(!isOpen)}
        >
          <span className={classes.heading}>
            <span className={classes.title}>{title}</span>
            {summary && <span className={classes.summary}>{summary}</span>}
          </span>

          <span className={classes.aside}>
            {attention && <span className={classes.attention}>{attentionLabel}</span>}
            {badge}
            <Chevron open={isOpen} />
          </span>
        </button>
      </Heading>

      <Disclosure open={isOpen} id={panelId} className={panelClassName}>
        {children}
      </Disclosure>
    </section>
  );
};

export default CollapsibleSection;
