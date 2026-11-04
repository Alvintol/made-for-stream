import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// A new page starts at the top. Starting or ending a guide tour (?tour=) is
// the same page, so it keeps its place, and a link to a spot on a page
// (#step-…) is left for that page to scroll to.
const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();
  const params = new URLSearchParams(search);
  params.delete("tour");
  const page = `${pathname}?${params.toString()}`;

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page, hash]);

  return null;
};

export default ScrollToTop;
