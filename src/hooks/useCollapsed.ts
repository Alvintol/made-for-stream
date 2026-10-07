import { useEffect, useState, type RefObject } from "react";

// Whether `content` at its natural width, the row's other children, and
// `reserve` pixels for the child marked data-flexible add up to more than
// the row has. Exported for its test.
export const needsCollapse = (input: {
  rowWidth: number;
  contentWidth: number;
  siblingWidths: number[];
  gap: number;
}): boolean =>
  input.contentWidth +
    input.siblingWidths.reduce((total, width) => total + width, 0) +
    input.gap * input.siblingWidths.length >
  input.rowWidth;

// How many of the items fit in `available` pixels. When they do not all
// fit, room is kept for the "more" button that stands in for the rest.
// Exported for its test.
export const countFitting = (input: {
  available: number;
  itemWidths: number[];
  moreWidth: number;
  gap: number;
}): number => {
  const { available, itemWidths, moreWidth, gap } = input;
  const all = itemWidths.reduce((total, width) => total + width, 0) +
    gap * Math.max(itemWidths.length - 1, 0);

  if (all <= available) return itemWidths.length;

  let used = moreWidth;
  let count = 0;

  for (const width of itemWidths) {
    if (used + gap + width > available) break;

    used += gap + width;
    count += 1;
  }

  return count;
};

// The row's width inside its padding, the widths of the children that share
// it with `content`, and the gap between them.
const measureRow = (row: HTMLElement, content: HTMLElement, reserve: number) => {
  const style = getComputedStyle(row);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);

  const siblingWidths = Array.from(row.children)
    .filter((child): child is HTMLElement => child !== content && child instanceof HTMLElement)
    // An open dialog or a drop-down sits over the row, not in it.
    .filter((child) => !["absolute", "fixed"].includes(getComputedStyle(child).position))
    .map((child) => (child.hasAttribute("data-flexible") ? reserve : child.offsetWidth))
    .filter((width) => width > 0);

  return {
    rowWidth: row.clientWidth - (padding || 0),
    siblingWidths,
    gap: parseFloat(style.columnGap) || 0,
  };
};

// True while `content` does not fit in `row` beside its siblings, so the
// caller can swap it for a menu button. The caller keeps `content` rendered
// (out of flow) while collapsed, so its natural width can still be measured
// and it can come back when there is room. Measures on resize only: no timer.
export const useCollapsed = (
  rowRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  reserve = 0,
): boolean => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    const content = contentRef.current;

    if (!row || !content || typeof ResizeObserver === "undefined") return;

    const measure = () =>
      setCollapsed(
        needsCollapse({ ...measureRow(row, content, reserve), contentWidth: content.scrollWidth }),
      );

    // Fires once on observe, then whenever the row or the content changes size.
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(content);

    return () => observer.disconnect();
  }, [rowRef, contentRef, reserve]);

  return collapsed;
};

// How many of a row's items fit beside its other children. `measureRef` is
// an unseen, out-of-flow copy holding every item followed by the "more"
// button, so natural widths are known whatever is on show. The element that
// shows the fitting items must be marked data-flexible. Starts at "all".
export const useFitCount = (
  rowRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
): number => {
  const [count, setCount] = useState(Number.POSITIVE_INFINITY);

  useEffect(() => {
    const row = rowRef.current;
    const measurer = measureRef.current;

    if (!row || !measurer || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const { rowWidth, siblingWidths, gap } = measureRow(row, measurer, 0);
      const widths = Array.from(measurer.children).map((child) => (child as HTMLElement).offsetWidth);

      setCount(
        countFitting({
          available:
            rowWidth -
            siblingWidths.reduce((total, width) => total + width, 0) -
            gap * siblingWidths.length,
          itemWidths: widths.slice(0, -1),
          moreWidth: widths.at(-1) ?? 0,
          gap: parseFloat(getComputedStyle(measurer).columnGap) || 0,
        }),
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(measurer);

    return () => observer.disconnect();
  }, [rowRef, measureRef]);

  return count;
};
