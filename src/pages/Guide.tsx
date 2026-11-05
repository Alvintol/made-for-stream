import { useEffect } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";

import BackLink from "../components/layout/BackLink";
import {
  canTakeTour,
  guideProgressCount,
  guideSteps,
  guideTracks,
  isGuideTrack,
  type GuideStepState,
  type GuideTrack,
} from "../domain/guide/guide";
import { tourHref } from "../domain/guide/tours";
import { useGuideFacts } from "../hooks/guide/useGuide";
import { useT } from "../lib/i18n/i18n";
import type { MessageKey } from "../lib/i18n/messages/en";
import type { ThemePreference } from "../lib/theme/theme";
import { useTheme } from "../providers/ThemeProvider";

const classes = {
  shell: "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6",
  title: "pageTitle",
  lead: "text-sm leading-6 text-zinc-600",
  tracks: "grid gap-4 sm:grid-cols-2",
  track: "card flex flex-col gap-2 p-5 transition hover:shadow-[var(--shadow-md)]",
  trackTitle: "font-display text-lg font-extrabold tracking-tight",
  trackCount: "text-xs font-semibold text-zinc-500",
  steps: "flex flex-col gap-4",
  step: "card scroll-mt-28 space-y-3 p-5",
  stepHead: "flex items-start gap-3",
  number:
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--hairline-strong)] text-xs font-bold text-zinc-600",
  numberDone: "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white",
  stepTitle: "font-display text-base font-extrabold tracking-tight",
  badge: "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
  body: "space-y-2 pl-10 text-sm leading-6 text-zinc-700",
  actions: "flex flex-wrap gap-2 pl-10",
  other: "text-sm font-semibold text-[rgb(var(--accent-text))] hover:underline",
} as const;

const badgeTone: Record<Exclude<GuideStepState, "read">, string> = {
  done: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  waiting: "border border-amber-200 bg-amber-50 text-amber-800",
  todo: "border border-[var(--hairline-strong)] text-zinc-600",
};

const themeChoices: readonly ThemePreference[] = ["light", "dark", "system"];

// The same setting as the sun/moon button in the top bar, plus "match my
// device". Saved on this device only.
const ThemeChoice = () => {
  const t = useT();
  const { preference, setPreference } = useTheme();

  return (
    <div className={classes.actions} role="group" aria-label={t("guide.theme.label")}>
      {themeChoices.map((choice) => (
        <button
          key={choice}
          type="button"
          className={preference === choice ? "btnPrimary btnSm" : "btnOutline btnSm"}
          aria-pressed={preference === choice}
          onClick={() => setPreference(choice)}
        >
          {t(`guide.theme.${choice}`)}
        </button>
      ))}
    </div>
  );
};

// /guide: the two guides. /guide/creators and /guide/buyers: the steps, each
// ticked from what the account has done, with "Show me" for a spotlight tour
// of the page it's about. Open to everyone; ticks and tours need signing in.
// Playbook: docs/support/site/guide.md.
const Guide = () => {
  const t = useT();
  const { track } = useParams();
  const { hash } = useLocation();
  const { facts } = useGuideFacts();

  // A link to one step (#step-…) lands on it once the page is drawn.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash, track]);

  if (track !== undefined && !isGuideTrack(track)) return <Navigate to="/guide" replace />;

  if (!track) {
    return (
      <div className={classes.shell}>
        <h1 className={classes.title}>{t("guide.title")}</h1>
        <p className={classes.lead}>{t("guide.lead")}</p>

        <div className={classes.tracks}>
          {guideTracks.map((entry) => {
            const count = guideProgressCount(entry, facts);
            return (
              <Link key={entry} className={classes.track} to={`/guide/${entry}`}>
                <span className={classes.trackTitle}>{t(`guide.${entry}Title`)}</span>
                <span className={classes.lead}>{t(`guide.${entry}Lead`)}</span>
                {facts.signedIn && (
                  <span className={classes.trackCount}>{t("guide.progress", count)}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const other: GuideTrack = track === "creators" ? "buyers" : "creators";
  const count = guideProgressCount(track, facts);

  return (
    <div className={classes.shell}>
      <BackLink fallback="/guide" />
      <h1 className={classes.title}>{t(`guide.${track}Title`)}</h1>
      <p className={classes.lead}>{t(`guide.${track}Intro`)}</p>
      {facts.signedIn ? (
        <p className={classes.trackCount}>{t("guide.progress", count)}</p>
      ) : (
        <p className={classes.lead}>{t("guide.signInForProgress")}</p>
      )}

      <ol className={classes.steps}>
        {guideSteps[track].map((entry, index) => {
          const state = facts.signedIn ? entry.state(facts) : "read";
          const base = `guide.${track}.${entry.key}`;

          return (
            <li key={entry.key} id={`step-${entry.key}`} className={classes.step}>
              <div className={classes.stepHead}>
                <span className={state === "done" ? classes.numberDone : classes.number} aria-hidden="true">
                  {state === "done" ? "✓" : index + 1}
                </span>
                <h2 className={classes.stepTitle}>{t(`${base}.title` as MessageKey)}</h2>
                {state !== "read" && (
                  <span className={`${classes.badge} ${badgeTone[state]}`}>{t(`guide.state.${state}`)}</span>
                )}
              </div>

              <div className={classes.body}>
                {t(`${base}.body` as MessageKey)
                  .split("\n\n")
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
              </div>

              {entry.control === "theme" && <ThemeChoice />}

              {(entry.tour || entry.link) && (
                <div className={classes.actions}>
                  {entry.tour && canTakeTour(entry.tour, facts) && (
                    <Link className="btnPrimary btnSm" to={tourHref(entry.tour)}>
                      {t("guide.showMe")}
                    </Link>
                  )}
                  {entry.link && (
                    <Link className="btnOutline btnSm" to={entry.link.to}>
                      {t(entry.link.label)}
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <Link className={classes.other} to={`/guide/${other}`}>
        {t(`guide.switchTo.${other}`)} →
      </Link>
    </div>
  );
};

export default Guide;
