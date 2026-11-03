import type { ReactNode } from "react";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
import CreatorSalesTotals from "./CreatorSalesTotals";
import MonthPicker from "./MonthPicker";

const classes = {
  section: "space-y-3",
  header: "flex flex-wrap items-end justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  note: "mt-0.5 max-w-2xl text-sm text-zinc-500",
  side: "flex flex-wrap items-end gap-3",
} as const;

// A month's earnings cards with the month to show, for the dashboard and the
// Earnings page. `children` sits beside the month picker, such as a link.
const CreatorMonthEarnings = ({
  month,
  onMonthChange,
  children,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  children?: ReactNode;
}) => {
  const t = useT();
  const language = useLanguage();

  return (
    <section className={classes.section} aria-label={t("dashboard.earnings")}>
      <div className={classes.header}>
        <div>
          <h2 className={classes.title}>{t("dashboard.earnings")}</h2>
          <p className={classes.note}>{t("sales.monthNote")}</p>
        </div>

        <div className={classes.side}>
          {children}
          <MonthPicker
            value={month}
            onChange={onMonthChange}
            locale={dateLocale(language)}
            text={{
              label: t("sales.month"),
              previousYear: t("sales.previousYear"),
              nextYear: t("sales.nextYear"),
            }}
          />
        </div>
      </div>

      <CreatorSalesTotals month={month} />
    </section>
  );
};

export default CreatorMonthEarnings;
