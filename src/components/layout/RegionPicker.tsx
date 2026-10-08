import { useRef } from "react";
import { useDisplayCurrency } from "../../hooks/money/useDisplayCurrency";
import { DEFAULT_LANGUAGE } from "../../lib/i18n/languages";
import DisplayCurrencySettings from "../settings/DisplayCurrencySettings";

const classes = {
  button: "regionButton",
  dialog: "regionDialog",
  body: "flex flex-col gap-4 p-5",
  header: "flex items-center justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight",
  close: "themeToggle",
} as const;

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
  </svg>
);

// The language and currency button in the top bar, and the dialog it opens.
// The dialog holds the same form as Settings → Preferences.
// On a small screen it sits in the hamburger menu instead of the top bar.
const RegionPicker = () => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { displayCurrency } = useDisplayCurrency();

  const label = [DEFAULT_LANGUAGE, displayCurrency]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();

  return (
    <>
      <button
        type="button"
        className={classes.button}
        aria-haspopup="dialog"
        aria-label={`Language and currency (${label})`}
        title="Language and currency"
        onClick={() => dialogRef.current?.showModal()}
      >
        <GlobeIcon />
        <span>{label}</span>
      </button>

      <dialog
        ref={dialogRef}
        className={classes.dialog}
        aria-labelledby="region-dialog-title"
        // A click on the backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className={classes.body}>
          <div className={classes.header}>
            <h2 id="region-dialog-title" className={classes.title}>
              Language and currency
            </h2>

            <button
              type="button"
              className={classes.close}
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
            >
              ✕
            </button>
          </div>

          <DisplayCurrencySettings />
        </div>
      </dialog>
    </>
  );
};

export default RegionPicker;
