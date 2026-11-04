import { useLocation, useNavigate } from "react-router-dom";

import { useGuideWelcomeSeen, useMarkGuideWelcomeSeen } from "../../hooks/guide/useGuide";
import { useT } from "../../lib/i18n/i18n";
import Dialog from "../ui/Dialog";

const classes = {
  text: "text-sm leading-6 text-zinc-700",
  choices: "grid gap-3 sm:grid-cols-2",
  choice: "card flex flex-col gap-1 p-4 text-left transition hover:shadow-[var(--shadow-md)]",
  choiceTitle: "font-display text-base font-bold tracking-tight",
  choiceText: "text-sm leading-6 text-zinc-600",
  later: "btnOutline btnSm self-start",
} as const;

// Shown once per account, the first time someone signs in after the guide
// exists: a choice of the creator or buyer guide, or neither. Any choice
// records that it was seen (useMarkGuideWelcomeSeen), on every device.
const GuideWelcome = () => {
  const t = useT();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const seen = useGuideWelcomeSeen();
  const markSeen = useMarkGuideWelcomeSeen();

  // Not over the guide itself, nor over a tour that's already running.
  const elsewhere =
    pathname.startsWith("/guide") || pathname === "/signin" || new URLSearchParams(search).has("tour");
  if (seen.data !== false || elsewhere) return null;

  const choose = (to: string | null) => {
    markSeen.mutate();
    if (to) navigate(to);
  };

  return (
    <Dialog open onClose={() => choose(null)} title={t("guide.welcomeTitle")} closeLabel={t("guide.welcomeLater")}>
      <p className={classes.text}>{t("guide.welcomeText")}</p>

      <div className={classes.choices}>
        <button type="button" className={classes.choice} onClick={() => choose("/guide/creators")}>
          <span className={classes.choiceTitle}>{t("guide.creatorsTitle")}</span>
          <span className={classes.choiceText}>{t("guide.creatorsLead")}</span>
        </button>
        <button type="button" className={classes.choice} onClick={() => choose("/guide/buyers")}>
          <span className={classes.choiceTitle}>{t("guide.buyersTitle")}</span>
          <span className={classes.choiceText}>{t("guide.buyersLead")}</span>
        </button>
      </div>

      <p className={classes.text}>{t("guide.welcomeLaterText")}</p>
      <button type="button" className={classes.later} onClick={() => choose(null)}>
        {t("guide.welcomeLater")}
      </button>
    </Dialog>
  );
};

export default GuideWelcome;
