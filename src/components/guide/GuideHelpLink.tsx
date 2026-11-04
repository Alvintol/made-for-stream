import { Link, useLocation } from "react-router-dom";

import type { GuideTrack } from "../../domain/guide/guide";
import { tourHref, type TourId } from "../../domain/guide/tours";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  row: "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold",
  link: "text-[rgb(var(--accent-text))] underline-offset-2 hover:underline",
} as const;

// "How this works" on a page, to its step in the guide, and "Show me around"
// to start that page's spotlight tour right here.
const GuideHelpLink = ({ track, step, tour }: { track: GuideTrack; step: string; tour?: TourId }) => {
  const t = useT();
  const { pathname, search } = useLocation();

  return (
    <div className={classes.row}>
      <Link className={classes.link} to={`/guide/${track}#step-${step}`}>
        ⓘ {t("guide.howThisWorks")}
      </Link>
      {tour && (
        <Link className={classes.link} to={tourHref(tour, pathname, search)} replace>
          {t("guide.showAround")}
        </Link>
      )}
    </div>
  );
};

export default GuideHelpLink;
