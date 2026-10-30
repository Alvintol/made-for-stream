import type {
  RequestNextStep,
  RequestWorkspaceViewer,
} from "../../../domain/listings/requestWorkspace";
import { useT } from "../../../lib/i18n/i18n";
import { FadeIn } from "../../../lib/motion";
import { useWorkspace } from "./WorkspaceContext";

type RequestNextStepCardProps = {
  step: RequestNextStep;
  viewer: RequestWorkspaceViewer;
  buyerLabel: string;
  creatorLabel: string;
  // True while the queries the step depends on are still loading.
  isLoading?: boolean;
};

const classes = {
  base: "rounded-2xl border px-4 py-4 sm:px-5",
  action: "border-amber-200 bg-amber-50 text-amber-950",
  waiting: "border-[var(--hairline-strong)] bg-[rgb(var(--surface))] text-zinc-900 shadow-[var(--shadow-sm)]",
  done: "border-emerald-200 bg-emerald-50 text-emerald-950",
  closed: "border-zinc-200 bg-zinc-50 text-zinc-800",
  row: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
  eyebrow: "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80",
  pulse: "h-2 w-2 shrink-0 rounded-full bg-current opacity-70 motion-safe:animate-pulse",
  title: "mt-1 font-display text-base font-bold tracking-tight sm:text-lg",
  description: "mt-0.5 text-sm opacity-85",
  button: "btnPrimary shrink-0 self-start sm:self-center",
  skeleton: "mt-2 h-4 w-2/3 rounded-full bg-zinc-200 motion-safe:animate-pulse",
} as const;

const RequestNextStepCard = ({
  step,
  viewer,
  buyerLabel,
  creatorLabel,
  isLoading = false,
}: RequestNextStepCardProps) => {
  const t = useT();
  const { focusSection } = useWorkspace();
  if (isLoading) {
    return (
      <section aria-label={t("nextCard.label")} aria-busy="true" className={`${classes.base} ${classes.waiting}`}>
        <div className={classes.eyebrow}>{t("nextCard.checking")}</div>
        <div className={classes.skeleton} />
      </section>
    );
  }

  const isMine = step.owner !== null && step.owner === viewer;
  const ownerLabel = step.owner === "buyer" ? buyerLabel : creatorLabel;
  const tone = step.tone !== "action" ? step.tone : isMine ? "action" : "waiting";

  const eyebrow =
    step.tone === "done"
      ? t("nextCard.allDone")
      : step.tone === "closed"
        ? t("nextCard.closed")
        : isMine
          ? t("nextCard.mine")
          : t("nextCard.waitingOn", { name: ownerLabel });

  const title =
    step.tone !== "action" || isMine
      ? step.actionTitle
      : viewer === "admin"
        ? t(step.owner === "buyer" ? "nextCard.buyerStep" : "nextCard.creatorStep", {
            title: step.actionTitle,
          })
        : step.waitingTitle;

  const description =
    step.tone !== "action" || isMine || viewer === "admin"
      ? step.actionDescription
      : step.waitingDescription;

  const showButton = Boolean(step.sectionId) && (isMine || viewer === "admin");

  return (
    <FadeIn key={step.key}>
      <section aria-label={t("nextCard.label")} className={`${classes.base} ${classes[tone]}`}>
        <div className={classes.row}>
          <div className="min-w-0">
            <div className={classes.eyebrow}>
              {tone === "waiting" && <span className={classes.pulse} aria-hidden="true" />}
              {eyebrow}
            </div>
            <p className={classes.title}>{title}</p>
            <p className={classes.description}>{description}</p>
          </div>

          {showButton && step.sectionId && (
            <button
              type="button"
              className={classes.button}
              onClick={() => step.sectionId && focusSection(step.sectionId)}
            >
              {isMine ? step.actionLabel ?? t("nextCard.open") : t("nextCard.viewDetails")}
            </button>
          )}
        </div>
      </section>
    </FadeIn>
  );
};

export default RequestNextStepCard;
