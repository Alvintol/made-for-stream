import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useT } from "../../lib/i18n/i18n";
import { Disclosure } from "../../lib/motion";
type ActionMenuProps = {
  // A function child receives `close`, so an item can dismiss the menu when chosen.
  children: ReactNode | ((close: () => void) => ReactNode);
  label?: ReactNode;
  // Needed when the label is an icon.
  ariaLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
  showCaret?: boolean;
};

const classes = {
  wrap: "relative",
  trigger: "btnOutline btnSm",
  panel:
    "absolute right-0 top-full z-30 mt-2 rounded-2xl border border-[var(--hairline-strong)] bg-[rgb(var(--surface))] shadow-[var(--shadow-lg)]",
  panelSize: "w-[min(22rem,calc(100vw-2rem))] space-y-3 p-4",
} as const;

// Shared classes for list-style menu items.
export const actionMenuItemClasses = {
  list: "w-56 space-y-0.5 p-1.5",
  item:
    "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
  danger:
    "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50",
} as const;

const ActionMenu = ({
  children,
  label,
  ariaLabel,
  triggerClassName = classes.trigger,
  panelClassName,
  showCaret = true,
}: ActionMenuProps) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={classes.wrap}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {label ?? t("common.manage")}
        {showCaret && <span aria-hidden="true">▾</span>}
      </button>

      <Disclosure
        open={open}
        id={panelId}
        className={`${classes.panel} ${panelClassName ?? classes.panelSize}`}
      >
        {typeof children === "function" ? children(close) : children}
      </Disclosure>
    </div>
  );
};

export default ActionMenu;
