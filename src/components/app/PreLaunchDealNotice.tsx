import { Link } from "react-router-dom";
import { usePaymentsLive } from "../../hooks/site/usePaymentsLive";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  notice: "notice noticeWarning",
  link: "font-semibold underline underline-offset-2",
} as const;

// For both people in a commission or chat, until payments open: there is no
// date for their region, and any deal they make anyway is theirs alone
// (Terms section 4).
const PreLaunchDealNotice = () => {
  const t = useT();
  const live = usePaymentsLive();

  if (live) return null;

  return (
    <div className={classes.notice} role="note">
      {t("launch.dealNotice")}{" "}
      <Link className={classes.link} to="/terms">
        {t("launch.dealNoticeTerms")}
      </Link>
    </div>
  );
};

export default PreLaunchDealNotice;
