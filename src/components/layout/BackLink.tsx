import { Link, useLocation, useNavigate } from "react-router-dom";
import { useT } from "../../lib/i18n/i18n";

// "← Back" for a page reached from many places, such as a policy or an
// invoice: it returns to the page the person came from on the site. Opened
// directly (a new tab, a shared link) there is nowhere to go back to, so it
// goes to `fallback` instead. Phones without a back button rely on it.
const BackLink = ({ fallback }: { fallback: string }) => {
  const t = useT();
  const navigate = useNavigate();
  // React Router gives the first page of a visit the key "default".
  const cameFromSite = useLocation().key !== "default";

  return (
    <Link
      className="backLink self-start print:hidden"
      to={fallback}
      onClick={(event) => {
        if (!cameFromSite) return;

        event.preventDefault();
        navigate(-1);
      }}
    >
      ← {t("common.back")}
    </Link>
  );
};

export default BackLink;
