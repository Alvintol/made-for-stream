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

    const measure = () => {
      const style = getComputedStyle(row);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);

      const siblingWidths = Array.from(row.children)
        .filter((child): child is HTMLElement => child !== content && child instanceof HTMLElement)
        // An open dialog or a drop-down sits over the row, not in it.
        .filter((child) => !["absolute", "fixed"].includes(getComputedStyle(child).position))
        .map((child) => (child.hasAttribute("data-flexible") ? reserve : child.offsetWidth))
        .filter((width) => width > 0);

      setCollapsed(
        needsCollapse({
          rowWidth: row.clientWidth - (padding || 0),
          contentWidth: content.scrollWidth,
          siblingWidths,
          gap: parseFloat(style.columnGap) || 0,
        }),
      );
    };

    // Fires once on observe, then whenever the row or the content changes size.
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(content);

    return () => observer.disconnect();
  }, [rowRef, contentRef, reserve]);

  return collapsed;
};
