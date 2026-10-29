import { hasErrorMessage } from "../../../lib/errorMessage";
import {
  getListingRequestFinalDeliveryStatusLabel,
  getListingRequestFinalDeliveryStatusSummary,
  getListingRequestFinalDeliveryStatusTone,
  isListingRequestFinalDeliveryBuyerVisible,
} from "../../../domain/listings/listingRequestFinalDeliveries";
import { describeOffSiteDelivery } from "../../../domain/listings/offSiteDelivery";
import DeliveryFileDownloads from "./DeliveryFileDownloads";
import type { ListingRequestFinalDeliveryRow } from "../../../hooks/creatorRequests/useListingRequestFinalDeliveries";
import { useLanguage, useT, type Translate } from "../../../lib/i18n/i18n";
type ListingRequestFinalDeliveryViewer =
  | "buyer"
  | "creator"
  | "admin";

type ListingRequestFinalDeliverySummaryProps = {
  finalDeliveries: ListingRequestFinalDeliveryRow[];
  viewer: ListingRequestFinalDeliveryViewer;
  isLoading?: boolean;
  error?: unknown;
};

const classes = {
  section: "space-y-4",
  loading:
    "notice noticeNeutral",
  empty:
    "notice noticeNeutral",
  error:
    "notice noticeError",
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemVersion: "text-xs text-zinc-500",
  status:
    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
  statusMuted:
    "border-zinc-200 bg-zinc-100 text-zinc-700",
  statusReview:
    "border-amber-200 bg-amber-50 text-amber-800",
  statusSuccess:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  statusDanger:
    "border-red-200 bg-red-50 text-red-700",
  statusSummary: "mt-2 text-sm text-zinc-600",
  body: "mt-4 whitespace-pre-wrap text-sm text-zinc-700",
  metaGrid: "mt-4 grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel:
    "metaLabel",
  metaValue: "text-sm font-semibold text-zinc-900",
  links: "mt-4 space-y-2",
  link:
    "block rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100",
  noLinks:
    "notice noticeNeutral mt-4",
  revision:
    "notice noticeError mt-4",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("deliveries.loadFailed");

const formatDate = (
  value: string | null | undefined,
  language: string,
  t: Translate
): string =>
  value
    ? new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
      }).format(new Date(value))
    : t("deliveries.notSubmitted");

const getStatusClass = (
  finalDelivery: ListingRequestFinalDeliveryRow
): string => {
  const tone =
    getListingRequestFinalDeliveryStatusTone(
      finalDelivery.status
    );

  return tone === "review"
    ? `${classes.status} ${classes.statusReview}`
    : tone === "success"
      ? `${classes.status} ${classes.statusSuccess}`
      : tone === "danger"
        ? `${classes.status} ${classes.statusDanger}`
        : `${classes.status} ${classes.statusMuted}`;
};

const getVisibleFinalDeliveries = (
  finalDeliveries: ListingRequestFinalDeliveryRow[],
  viewer: ListingRequestFinalDeliveryViewer
): ListingRequestFinalDeliveryRow[] => {
  const visibleFinalDeliveries =
    viewer === "buyer"
      ? finalDeliveries.filter((finalDelivery) =>
          isListingRequestFinalDeliveryBuyerVisible({
            status: finalDelivery.status,
            submittedAt:
              finalDelivery.submitted_at,
          })
        )
      : finalDeliveries;

  return [...visibleFinalDeliveries].sort(
    (firstDelivery, secondDelivery) =>
      secondDelivery.version_number -
      firstDelivery.version_number
  );
};

const ListingRequestFinalDeliverySummary = ({
  finalDeliveries,
  viewer,
  isLoading = false,
  error,
}: ListingRequestFinalDeliverySummaryProps) => {
  const t = useT();
  const language = useLanguage();
  const hasError = Boolean(error);

  const visibleFinalDeliveries =
    getVisibleFinalDeliveries(
      finalDeliveries,
      viewer
    );

  return (
    <div>
      <div className={classes.section}>

        {isLoading && (
          <div className={classes.loading}>
            {t("deliveries.loading")}
          </div>
        )}

        {!isLoading && hasError && (
          <div className={classes.error}>
            {getErrorMessage(error, t)}
          </div>
        )}

        {!isLoading &&
          !hasError &&
          visibleFinalDeliveries.length === 0 && (
            <div className={classes.empty}>
              {t("deliveries.empty")}
            </div>
          )}

        {!isLoading &&
          !hasError &&
          visibleFinalDeliveries.length > 0 && (
            <div className={classes.list}>
              {visibleFinalDeliveries.map(
                (finalDelivery) => (
                  <article
                    className={classes.item}
                    key={finalDelivery.id}
                  >
                    <div
                      className={classes.itemHeader}
                    >
                      <div
                        className={
                          classes.itemHeading
                        }
                      >
                        <h3
                          className={
                            classes.itemTitle
                          }
                        >
                          {finalDelivery.title}
                        </h3>

                        <div
                          className={
                            classes.itemVersion
                          }
                        >
                          {t("deliveries.version", {
                            version:
                              finalDelivery.version_number,
                          })}
                        </div>
                      </div>

                      <span
                        className={getStatusClass(
                          finalDelivery
                        )}
                      >
                        {getListingRequestFinalDeliveryStatusLabel(
                          finalDelivery.status,
                          t
                        )}
                      </span>
                    </div>

                    <p
                      className={
                        classes.statusSummary
                      }
                    >
                      {getListingRequestFinalDeliveryStatusSummary(
                        finalDelivery.status,
                        t
                      )}
                    </p>

                    <p className={classes.body}>
                      {finalDelivery.summary}
                    </p>

                    <div className={classes.metaGrid}>
                      <div
                        className={classes.metaBlock}
                      >
                        <div
                          className={
                            classes.metaLabel
                          }
                        >
                          {t("deliveries.submitted")}
                        </div>

                        <div
                          className={
                            classes.metaValue
                          }
                        >
                          {formatDate(
                            finalDelivery.submitted_at,
                            language,
                            t
                          )}
                        </div>
                      </div>

                      {finalDelivery.buyer_approved_at && (
                        <div
                          className={
                            classes.metaBlock
                          }
                        >
                          <div
                            className={
                              classes.metaLabel
                            }
                          >
                            {t("deliveries.buyerApproved")}
                          </div>

                          <div
                            className={
                              classes.metaValue
                            }
                          >
                            {formatDate(
                              finalDelivery.buyer_approved_at,
                              language,
                              t
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {finalDelivery.delivery_links.length >
                    0 ? (
                      <div className={classes.links}>
                        {finalDelivery.delivery_links.map(
                          (deliveryLink, index) => (
                            <a
                              className={classes.link}
                              href={deliveryLink}
                              key={`${finalDelivery.id}-${index}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {t("deliveries.link", { number: index + 1 })}
                            </a>
                          )
                        )}
                      </div>
                    ) : (
                      <div className={classes.noLinks}>
                        {t("deliveries.noLinks")}
                      </div>
                    )}

                    {finalDelivery.delivery_file_paths &&
                      finalDelivery.delivery_file_paths.length >
                        0 && (
                        <DeliveryFileDownloads
                          paths={
                            finalDelivery.delivery_file_paths
                          }
                        />
                      )}

                    {finalDelivery.delivery_files_deleted_at && (
                      <div className={classes.noLinks}>
                        {t("deliveries.filesDeleted")}
                      </div>
                    )}

                    {finalDelivery.off_site_delivery_methods &&
                      finalDelivery.off_site_delivery_methods
                        .length > 0 && (
                        <div className={classes.noLinks}>
                          {t("offSite.reported", {
                            methods:
                              describeOffSiteDelivery(
                                finalDelivery.off_site_delivery_methods,
                                finalDelivery.off_site_delivery_other,
                                t
                              ) ?? "",
                          })}
                        </div>
                      )}

                    {finalDelivery.revision_request_reason && (
                      <div className={classes.revision}>
                        <strong>
                          {t("revision.requested")}
                        </strong>{" "}
                        {
                          finalDelivery.revision_request_reason
                        }
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default ListingRequestFinalDeliverySummary;