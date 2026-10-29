import { Link } from "react-router-dom";
import { useT } from "../lib/i18n/i18n";
const classes = {
  wrap: "space-y-4",
  h1: "pageTitle",
  p: "text-sm text-zinc-600",
  btn: "btnPrimary",
} as const;

const NotFound = () => {
  const t = useT();

  return (
  <div className={classes.wrap}>
    <h1 className={classes.h1}>404</h1>
    <p className={classes.p}>{t("notFound.text")}</p>
    <Link to="/" className={classes.btn}>
      {t("notFound.home")}
    </Link>
  </div>
  );
};


export default NotFound;