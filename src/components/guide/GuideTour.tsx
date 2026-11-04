import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

import { isTourId, tours, type TourId } from "../../domain/guide/tours";
import { useT } from "../../lib/i18n/i18n";
import type { MessageKey } from "../../lib/i18n/messages/en";

const classes = {
  blocker: "fixed inset-0 z-[70]",
  // The dim, the ring and the glow are all its shadow (ui.css).
  spot: "tourSpot pointer-events-none fixed z-[71] rounded-xl",
  // Between steps the spotlight and card slide to their new places. While
  // the page scrolls under a settled step they follow it straight away.
  glide:
    "transition-[top,left,width,height,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
  card: "card fixed z-[72] w-[min(22rem,calc(100vw-2rem))] space-y-3 p-5 shadow-lg outline-none",
  text: "tourStepIn space-y-3",
  count: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  title: "font-display text-base font-extrabold tracking-tight",
  body: "text-sm leading-6 text-zinc-700",
  row: "flex items-center justify-between gap-2",
  buttons: "flex gap-2",
  end: "text-xs font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-800",
} as const;

const pad = 6;
const gap = 12;

type Box = { top: number; left: number; width: number; height: number };

const findTarget = (selector: string | null) => {
  if (!selector) return null;
  // The first one on screen: hidden ones (display: none, or a collapsed
  // phone menu) have no boxes. The nav draws some links twice.
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) => element.getClientRects().length > 0,
    ) ?? null
  );
};

const boxOf = (element: HTMLElement): Box => {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
};

// Below the spotlight if it fits, else above it, else pinned to the bottom.
// Phones pin it to the top or bottom edge, whichever is away from the
// spotlight (near the end of a page it can't scroll to the middle).
const cardPosition = (box: Box | null, card: { width: number; height: number }) => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (!box) return { top: Math.max(16, (height - card.height) / 2), left: (width - card.width) / 2 };
  if (width < 640) {
    const spotInLowerHalf = box.top + box.height / 2 > height / 2;
    return { top: spotInLowerHalf ? 16 : height - card.height - 16, left: 16 };
  }

  const left = Math.min(Math.max(16, box.left), width - card.width - 16);
  if (box.top + box.height + gap + card.height <= height - 16) return { top: box.top + box.height + gap, left };
  if (box.top - gap - card.height >= 16) return { top: box.top - gap - card.height, left };
  return { top: height - card.height - 16, left };
};

const TourRunner = ({ id, onClose }: { id: TourId; onClose: () => void }) => {
  const t = useT();
  const titleId = useId();
  const tour = tours[id];
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [gliding, setGliding] = useState(true);
  const [cardSize, setCardSize] = useState({ width: 352, height: 200 });
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const step = tour.steps[index];
  const last = index === tour.steps.length - 1;

  // Find this step's element. Pages load their data after they appear, so
  // look again for a moment before settling for a centred card. The old
  // spotlight stays put meanwhile, so it slides from there.
  useEffect(() => {
    let tries = 0;
    let timer = 0;
    let settle = 0;
    targetRef.current = null;

    // Long enough for the page's own smooth scroll to finish.
    const arrive = (next: Box | null) => {
      setBox(next);
      settle = window.setTimeout(() => setGliding(false), 900);
    };

    const look = () => {
      const element = findTarget(step.target);

      if (element) {
        targetRef.current = element;
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" });
        return arrive(boxOf(element));
      }

      tries += 1;
      if (step.target && tries < 10) timer = window.setTimeout(look, 150);
      else arrive(null);
    };

    timer = window.setTimeout(look, 0);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
    };
  }, [step.target]);

  // Follow the element while the page scrolls, resizes or settles.
  useEffect(() => {
    const follow = () => {
      if (targetRef.current?.isConnected) setBox(boxOf(targetRef.current));
    };

    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    const timer = window.setInterval(follow, 400);

    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      window.clearInterval(timer);
    };
  }, []);

  // The card's size decides where it fits.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setCardSize({ width: card.offsetWidth, height: card.offsetHeight }),
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // Each step takes the focus, so a screen reader reads it and the keyboard
  // starts from its buttons.
  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const back = useCallback(() => {
    if (index === 0) return;
    setGliding(true);
    setIndex(index - 1);
  }, [index]);
  const next = useCallback(() => {
    if (last) return onClose();
    setGliding(true);
    setIndex((current) => current + 1);
  }, [last, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, next, back]);

  const position = cardPosition(box, cardSize);
  const glide = gliding ? classes.glide : "";
  // With nothing to point at, the spotlight shrinks to a point in the middle
  // and its shadow dims the whole page, so it can grow out again.
  const spot = box ?? { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };

  return createPortal(
    <>
      {/* The page stays visible but can't be clicked until the tour ends. */}
      <div className={classes.blocker} aria-hidden="true" />
      <div
        className={`${classes.spot} ${box ? "isLit" : ""} ${glide}`}
        aria-hidden="true"
        data-spotlight=""
        style={spot}
      >
        {/* Once it lands, a ripple draws the eye; a new key per step replays it. */}
        {box && !gliding && <div key={index} className="tourSpotPulse" data-spotlight-pulse="" />}
      </div>

      <div
        ref={cardRef}
        className={`${classes.card} ${glide}`}
        style={{ top: position.top, left: position.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={classes.row}>
          <span className={classes.count}>
            {t("tour.step", { current: index + 1, total: tour.steps.length })}
          </span>
          <button type="button" className={classes.end} onClick={onClose}>
            {t("tour.end")}
          </button>
        </div>

        {/* A new key per step replays the fade-in. */}
        <div key={index} className={classes.text}>
          <h2 id={titleId} className={classes.title}>
            {t(`tour.${id}.${step.key}` as MessageKey)}
          </h2>
          <p className={classes.body}>{t(`tour.${id}.${step.key}Text` as MessageKey)}</p>
        </div>

        <div className={classes.row}>
          <span />
          <div className={classes.buttons}>
            {index > 0 && (
              <button type="button" className="btnOutline btnSm" onClick={back}>
                {t("tour.back")}
              </button>
            )}
            <button type="button" className="btnPrimary btnSm" onClick={next}>
              {t(last ? "tour.done" : "tour.next")}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

// Runs the tour named in the address (?tour=<id>), on any page. Ending it
// takes the name back out, so a reload doesn't start it again.
const GuideTour = () => {
  const [params, setParams] = useSearchParams();
  const id = params.get("tour");

  const close = useCallback(() => {
    setParams(
      (current) => {
        const nextParams = new URLSearchParams(current);
        nextParams.delete("tour");
        return nextParams;
      },
      { replace: true },
    );
  }, [setParams]);

  if (!isTourId(id)) return null;

  return <TourRunner key={id} id={id} onClose={close} />;
};

export default GuideTour;
