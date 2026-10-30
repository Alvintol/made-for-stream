import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../lib/i18n/i18n";
export type StatusHeaderStage = {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
};

type StatusTone = "review" | "success" | "danger" | "muted";

type StatusHeaderProps = {
  backTo: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  meta: ReactNode[];
  statusLabel: string;
  statusTone: StatusTone;
  stages: StatusHeaderStage[];
  actions?: ReactNode;
  notice?: ReactNode;
};

const statusToneClass: Record<StatusTone, string> = {
  review: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  danger: "border-red-200 bg-red-50 text-red-700",
  muted: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

const classes = {
  wrap: "card px-4 py-2.5 hover:shadow-[var(--shadow-md)] sm:px-5",
  // Symmetric outer columns keep the eyebrow centred on the card.
  grid: "grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1",
  backLink: "backLink col-start-1 row-start-1 justify-self-start",
  backText: "sr-only sm:not-sr-only",
  eyebrow: "col-start-2 row-start-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  // Phones: the wrapper dissolves so actions sit top-right and meta gets its own row.
  // From sm up it is one right-hand cell spanning the eyebrow and title rows.
  side: "contents sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:flex sm:items-center sm:justify-end sm:gap-4",
  actions: "col-start-3 row-start-1 justify-self-end",
  meta: "col-span-3 row-start-3 flex flex-wrap gap-x-3 text-xs text-zinc-600 sm:flex-col sm:items-end sm:gap-0",
  titleRow: "col-span-3 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-2",
  title: "min-w-0 font-display text-lg font-bold leading-tight tracking-tight text-zinc-900 sm:text-xl",
  status: "inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11px] font-semibold",
  notice: "mt-2.5",

  track: "mt-2.5 hidden grid-flow-col auto-cols-fr gap-2 sm:grid",
  stage: "border-t-2 pt-1 text-[11px] font-medium",
  stageDone: "border-[rgb(var(--accent)/0.55)] text-zinc-500",
  stageCurrent: "border-[rgb(var(--brand))] text-zinc-900",
  stageUpcoming: "border-zinc-200 text-zinc-400",

  // One line on phones: current stage, bar, step count.
  compact: "mt-2 flex items-center gap-2 text-[11px] font-medium text-zinc-600 sm:hidden",
  compactBar: "h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200",
  compactFill: "h-full rounded-full bg-gradient-to-r from-[rgb(var(--accent))] to-[rgb(var(--brand))]",
} as const;

const stageClass = (state: StatusHeaderStage["state"]) =>
  state === "done"
    ? classes.stageDone
    : state === "current"
      ? classes.stageCurrent
      : classes.stageUpcoming;

const StatusHeader = ({
  backTo,
  backLabel,
  eyebrow,
  title,
  meta,
  statusLabel,
  statusTone,
  stages,
  actions,
  notice,
}: StatusHeaderProps) => {
  const t = useT();
  const currentIndex = stages.findIndex((stage) => stage.state === "current");
  const doneCount = stages.filter((stage) => stage.state === "done").length;
  const position = currentIndex >= 0 ? currentIndex + 1 : doneCount;
  const current = stages[currentIndex] ?? stages[stages.length - 1];
  const progress = stages.length ? Math.round((Math.max(position, doneCount) / stages.length) * 100) : 0;

  return (
    <header className={classes.wrap}>
      <div className={classes.grid}>
        <Link to={backTo} className={classes.backLink}>
          ← <span className={classes.backText}>{backLabel}</span>
        </Link>

        <div className={classes.eyebrow}>{eyebrow}</div>

        <div className={classes.side}>
          {actions && <div className={classes.actions}>{actions}</div>}

          {meta.length > 0 && (
            <div className={classes.meta}>
              {meta.map((item, index) => (
                <span key={index}>{item}</span>
              ))}
            </div>
          )}
        </div>

        <div className={classes.titleRow}>
          <h1 className={classes.title}>{title}</h1>
          <span className={`${classes.status} ${statusToneClass[statusTone]}`}>{statusLabel}</span>
        </div>
      </div>

      {notice && <div className={classes.notice}>{notice}</div>}

      {stages.length > 0 && (
        <>
          <ol className={classes.track} aria-label={t("statusHeader.progress")}>
            {stages.map((stage) => (
              <li
                key={stage.key}
                className={`${classes.stage} ${stageClass(stage.state)}`}
                aria-current={stage.state === "current" ? "step" : undefined}
              >
                {stage.state === "done" && <span aria-hidden="true">✓ </span>}
                {stage.label}
              </li>
            ))}
          </ol>

          <div className={classes.compact} aria-hidden="true">
            <span>{current?.label}</span>
            <div className={classes.compactBar}>
              <div className={classes.compactFill} style={{ width: `${progress}%` }} />
            </div>
            <span>
              {Math.max(position, 1)}/{stages.length}
            </span>
          </div>
        </>
      )}
    </header>
  );
};

export default StatusHeader;
