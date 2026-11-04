import { useState } from "react";
import { Link } from "react-router-dom";
import GuideHelpLink from "../../components/guide/GuideHelpLink";
import {
  instantLicenceLabel,
  isInstantLicence,
  productFileDisplayName,
} from "../../domain/listings/instantDownloads";
import { getProductFileDownloadUrl, useMyDownloads } from "../../hooks/listings/useInstantDownloads";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
import { productFileMeta } from "../../components/listings/productFileMeta";

const classes = {
  page: "space-y-6",
  h1: "pageTitle",
  sub: "pageSub",
  note: "notice noticeNeutral",
  card: "card space-y-3 p-6",
  head: "flex flex-wrap items-start justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  meta: "text-sm text-zinc-500",
  links: "flex flex-wrap gap-3 text-sm",
  link: "font-semibold text-[rgb(var(--accent-text))] hover:underline",
  list: "divide-y divide-zinc-200 rounded-2xl border border-zinc-200",
  item: "flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm",
  name: "min-w-0 break-all font-medium text-zinc-900",
  row: "flex items-center gap-3",
  size: "text-xs text-zinc-500",
  btn: "btnPrimary btnSm",
  empty: "card p-6 text-sm text-zinc-500",
  error: "notice noticeError",
} as const;

// Everything the buyer has bought to download. Each file can be downloaded
// again whenever they need it, for as long as the purchase isn't refunded.
const Downloads = () => {
  const t = useT();
  const language = useLanguage();
  const downloads = useMyDownloads();
  const [preparing, setPreparing] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const download = async (path: string) => {
    setFailed(null);
    setPreparing(path);

    try {
      window.location.assign(await getProductFileDownloadUrl(path));
      void downloads.refetch();
    } catch {
      setFailed(path);
    } finally {
      setPreparing(null);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale(language), {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className={classes.page}>
      <div>
        <h1 className={classes.h1}>{t("downloads.title")}</h1>
        <p className={classes.sub}>{t("downloads.sub")}</p>
        <GuideHelpLink track="buyers" step="downloads" tour="downloads" />
      </div>

      <p className={classes.note}>{t("downloads.finalNote")}</p>

      {downloads.isError && <div className={classes.error}>{t("downloads.loadFailed")}</div>}

      {downloads.isLoading && <p className={classes.empty}>{t("common.loading")}</p>}

      {downloads.data && downloads.data.length === 0 && (
        <p className={classes.empty} data-tour="downloads-list">{t("downloads.empty")}</p>
      )}

      {downloads.data?.map((item, index) => (
        <section
          key={item.listing_request_id}
          className={classes.card}
          data-tour={index === 0 ? "downloads-list" : undefined}
        >
          <div className={classes.head}>
            <div>
              <h2 className={classes.title}>{item.title ?? t("sales.untitled")}</h2>
              <p className={classes.meta}>
                {t("downloads.boughtOn", { date: formatDate(item.paid_at) })}
                {isInstantLicence(item.licence) &&
                  ` · ${t("downloads.licence", { licence: t(instantLicenceLabel(item.licence)) })}`}
              </p>
            </div>

            <div className={classes.links}>
              <Link className={classes.link} to={`/listing/${item.listing_id}`}>
                {t("downloads.listing")}
              </Link>
              <Link className={classes.link} to={`/payments/invoice/${item.payment_id}`}>
                {t("invoice.title")}
              </Link>
            </div>
          </div>

          {item.files.length === 0 ? (
            <p className={classes.meta}>{t("downloads.noFiles")}</p>
          ) : (
            <ul className={classes.list}>
              {item.files.map((file) => (
                <li key={file.path ?? file.name} className={classes.item}>
                  <span className={classes.name}>{productFileDisplayName(file.name)}</span>
                  <span className={classes.row}>
                    <span className={classes.size}>{productFileMeta(file, t)}</span>
                    {file.path && (
                      <button
                        type="button"
                        className={classes.btn}
                        disabled={preparing !== null}
                        onClick={() => void download(file.path ?? "")}
                      >
                        {preparing === file.path ? t("downloads.preparing") : t("downloads.download")}
                      </button>
                    )}
                  </span>
                  {failed === file.path && (
                    <span className={classes.error}>{t("downloads.failed")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};

export default Downloads;
