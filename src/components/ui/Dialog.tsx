import { useEffect, useId, useRef, type ReactNode } from "react";

const classes = {
  body: "flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5",
  header: "flex items-center justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight",
  close: "themeToggle",
} as const;

// A modal over the page. Anything a page has no fixed room for, such as a
// table or extra choices, opens in one of these, so the page itself never
// grows or moves. Escape, the ✕ and a click on the backdrop all close it.
const Dialog = ({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) return;

    // Test environments without <dialog> support just get the attribute.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="appDialog"
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={classes.body}>
          <div className={classes.header}>
            <h2 id={titleId} className={classes.title}>
              {title}
            </h2>
            <button type="button" className={classes.close} aria-label={closeLabel} onClick={onClose}>
              ✕
            </button>
          </div>

          {children}
        </div>
      )}
    </dialog>
  );
};

export default Dialog;
