import { useEffect, useRef, useState } from "react";
import { currentSalesMonth, formatSalesMonth } from "../../domain/payments/sales";

const classes = {
  wrap: "relative space-y-1",
  label: "formLabel block",
  button: "formControl flex min-w-44 items-center justify-between gap-3 text-left",
  panel:
    "absolute right-0 z-20 mt-1 w-72 rounded-2xl border border-[var(--hairline-strong)] bg-[rgb(var(--surface-raised))] p-3 shadow-lg",
  head: "mb-2 flex items-center justify-between",
  year: "font-display text-sm font-bold text-zinc-900",
  nav: "btnOutline btnSm px-2",
  grid: "grid grid-cols-3 gap-1",
  month: "rounded-lg px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
  monthOn: "bg-[rgb(var(--chart))] text-white",
  monthOff: "text-zinc-700 hover:bg-[rgb(var(--ink)/0.05)]",
} as const;

export type MonthPickerText = { label: string; previousYear: string; nextYear: string };

// A year of months to click, instead of a typed month: some browsers show a
// month field as plain text, which let "2026-13" through. Later months than
// `max` can't be chosen.
const MonthPicker = ({
  value,
  onChange,
  text,
  locale,
  max = currentSalesMonth(),
}: {
  value: string;
  onChange: (month: string) => void;
  text: MonthPickerText;
  locale?: string;
  max?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const wrap = useRef<HTMLDivElement>(null);
  const maxYear = Number(max.slice(0, 4));

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrap.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={classes.wrap} ref={wrap}>
      <span className={classes.label}>{text.label}</span>
      <button
        type="button"
        className={classes.button}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setYear(Number(value.slice(0, 4)));
          setOpen((current) => !current);
        }}
      >
        <span>{formatSalesMonth(value, locale)}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={classes.panel} role="dialog" aria-label={text.label}>
          <div className={classes.head}>
            <button
              type="button"
              className={classes.nav}
              aria-label={text.previousYear}
              onClick={() => setYear((current) => current - 1)}
            >
              ‹
            </button>
            <span className={classes.year}>{year}</span>
            <button
              type="button"
              className={classes.nav}
              aria-label={text.nextYear}
              disabled={year >= maxYear}
              onClick={() => setYear((current) => current + 1)}
            >
              ›
            </button>
          </div>

          <div className={classes.grid}>
            {Array.from({ length: 12 }, (_, index) => {
              const month = `${year}-${String(index + 1).padStart(2, "0")}`;
              const chosen = month === value;

              return (
                <button
                  key={month}
                  type="button"
                  className={`${classes.month} ${chosen ? classes.monthOn : classes.monthOff}`}
                  aria-pressed={chosen}
                  aria-label={formatSalesMonth(month, locale)}
                  disabled={month > max}
                  onClick={() => {
                    onChange(month);
                    setOpen(false);
                  }}
                >
                  {formatSalesMonth(month, locale, "short")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthPicker;
