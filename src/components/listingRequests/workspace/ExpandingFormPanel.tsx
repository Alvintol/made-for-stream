import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../../lib/i18n/i18n";
import { gsap, motion, prefersReducedMotion } from "../../../lib/motion";
type ExpandingFormPanelProps = {
  title: string;
  description: string;
  launchLabel: string;
  // A function child receives `close`, so a form can dismiss the sheet after a successful save.
  children: ReactNode | ((close: () => void) => ReactNode);
};

const classes = {
  launcher:
    "flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--hairline-strong)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
  launcherTitle: "text-sm font-semibold text-zinc-900",
  launcherText: "text-xs text-zinc-600",
  launchButton: "btnPrimary btnSm shrink-0 self-start sm:self-center",
  backdrop: "fixed inset-0 z-[60] bg-zinc-950/40 backdrop-blur-sm",
  sheet:
    "formSheet fixed inset-0 z-[61] flex flex-col overflow-hidden bg-[rgb(var(--surface))] shadow-[var(--shadow-lg)] outline-none sm:inset-4 sm:rounded-3xl sm:border sm:border-[var(--hairline-strong)] lg:inset-x-[max(2rem,calc((100vw-60rem)/2))] lg:inset-y-6",
  toolbar:
    "flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3 sm:px-6",
  toolbarLabel: "text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  close: "btnOutline btnSm shrink-0",
  body: "flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6",
} as const;

type Rect = { top: number; left: number; width: number; height: number };

// Clip the full sheet down to the launcher's box, so the card appears to grow out of the column.
const clipFrom = (from: Rect, to: Rect) =>
  `inset(${Math.max(from.top - to.top, 0)}px ${Math.max(to.left + to.width - (from.left + from.width), 0)}px ${Math.max(to.top + to.height - (from.top + from.height), 0)}px ${Math.max(from.left - to.left, 0)}px round 16px)`;

const clipFull = "inset(0px 0px 0px 0px round 24px)";

const ExpandingFormPanel = ({ title, description, launchLabel, children }: ExpandingFormPanelProps) => {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = () => {
    const sheet = sheetRef.current;
    const launcher = launcherRef.current;

    if (closingRef.current) return;

    const finish = () => {
      closingRef.current = false;
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    if (!sheet || !launcher || prefersReducedMotion()) {
      finish();
      return;
    }

    closingRef.current = true;
    gsap.to(sheet, {
      clipPath: clipFrom(launcher.getBoundingClientRect(), sheet.getBoundingClientRect()),
      duration: motion.duration.base,
      ease: motion.ease.inOut,
      onComplete: finish,
    });
    gsap.to(backdropRef.current, { autoAlpha: 0, duration: motion.duration.base });
  };

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const launcher = launcherRef.current;

    if (!isOpen || !sheet || !launcher) return undefined;

    sheet.focus({ preventScroll: true });

    if (prefersReducedMotion()) return undefined;

    const tween = gsap.fromTo(
      sheet,
      { clipPath: clipFrom(launcher.getBoundingClientRect(), sheet.getBoundingClientRect()) },
      {
        clipPath: clipFull,
        duration: motion.duration.slow,
        ease: motion.ease.out,
        clearProps: "clipPath",
      }
    );
    const fade = gsap.fromTo(
      backdropRef.current,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: motion.duration.base }
    );

    return () => {
      tween.kill();
      fade.kill();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
    // close only reads refs, so re-binding on each render isn't needed.
  }, [isOpen]);

  return (
    <>
      <div ref={launcherRef} className={classes.launcher}>
        <div className="min-w-0">
          <p className={classes.launcherTitle}>{title}</p>
          <p className={classes.launcherText}>{description}</p>
        </div>

        <button
          ref={buttonRef}
          type="button"
          className={classes.launchButton}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          {launchLabel}
        </button>
      </div>

      {isOpen &&
        createPortal(
          <>
            <div ref={backdropRef} className={classes.backdrop} aria-hidden="true" onClick={close} />

            <div
              ref={sheetRef}
              className={classes.sheet}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
            >
              <div className={classes.toolbar}>
                {/* The form supplies its own heading; the dialog is still labelled by title. */}
                <p className={classes.toolbarLabel}>{t("formPanel.workspace")}</p>
                <button type="button" className={classes.close} onClick={close}>
                  {t("formPanel.close")}
                </button>
              </div>

              <div className={classes.body}>
                {/* The form calls close only from its own handlers, never while rendering. */}
                {/* eslint-disable-next-line react-hooks/refs */}
                {typeof children === "function" ? children(close) : children}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};

export default ExpandingFormPanel;
