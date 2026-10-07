import { formatMoney as formatCurrencyAmount } from "../../../lib/formatMoney";
import {
  getListingRequestChangeOrderImpactLabels,
  getListingRequestChangeOrderStatusLabel,
  getListingRequestChangeOrderStatusSummary,
  getListingRequestChangeOrderStatusTone,
  isListingRequestChangeOrderBuyerVisible,
} from "../../../domain/listings/listingRequestChangeOrders";
import type {
  ListingRequestChangeOrderRow,
} from "../../../hooks/creatorRequests/useListingRequestChangeOrders";

type ListingRequestChangeOrderViewer =
  | "buyer"
  | "creator"
  | "admin";

type ListingRequestChangeOrderSummaryProps = {
  changeOrders: ListingRequestChangeOrderRow[];
  viewer: ListingRequestChangeOrderViewer;
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
  impactRow: "mt-3 flex flex-wrap items-center gap-2",
  impactBadge:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700",
  body: "mt-4 whitespace-pre-wrap text-sm text-zinc-700",
  metaGrid: "mt-4 grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel:
    "metaLabel",
  metaValue: "text-sm font-semibold text-zinc-900",
  response:
    "notice noticeError mt-4",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Project change orders could not be loaded.";

const formatDate = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
      }).format(new Date(value))
    : "Not set";

const getSnapshotCurrency = (
  changeOrder: ListingRequestChangeOrderRow
): string => {
  const proposedCurrency =
    changeOrder.proposed_snapshot.currency;
  const previousCurrency =
    changeOrder.before_snapshot.currency;

  if (
    typeof proposedCurrency === "string" &&
    proposedCurrency.length === 3
  ) {
    return proposedCurrency;
  }

  if (
    typeof previousCurrency === "string" &&
    previousCurrency.length === 3
  ) {
    return previousCurrency;
  }

  return "cad";
};

const formatMoney = (
  amount: number,
  currency: string,
  showSign = false
): string => {
  const formattedAmount = formatCurrencyAmount(Math.abs(amount), currency);

  if (!showSign || amount === 0) {
    return amount < 0
      ? `-${formattedAmount}`
      : formattedAmount;
  }

  return amount > 0
    ? `+${formattedAmount}`
    : `-${formattedAmount}`;
};

const formatTimelineDelta = (days: number): string =>
  days === 0
    ? "No date change"
    : `${days > 0 ? "+" : ""}${days} calendar ${
        Math.abs(days) === 1 ? "day" : "days"
      }`;

const getStatusClass = (
  changeOrder: ListingRequestChangeOrderRow
): string => {
  const tone = getListingRequestChangeOrderStatusTone(
    changeOrder.status
  );

  return tone === "review"
    ? `${classes.status} ${classes.statusReview}`
    : tone === "success"
      ? `${classes.status} ${classes.statusSuccess}`
      : tone === "danger"
        ? `${classes.status} ${classes.statusDanger}`
        : `${classes.status} ${classes.statusMuted}`;
};

const getVisibleChangeOrders = (
  changeOrders: ListingRequestChangeOrderRow[],
  viewer: ListingRequestChangeOrderViewer
): ListingRequestChangeOrderRow[] => {
  const visibleChangeOrders =
    viewer === "buyer"
      ? changeOrders.filter((changeOrder) =>
          isListingRequestChangeOrderBuyerVisible({
            status: changeOrder.status,
            sentAt: changeOrder.sent_at,
          })
        )
      : changeOrders;

  return [...visibleChangeOrders].sort(
    (firstChangeOrder, secondChangeOrder) =>
      secondChangeOrder.version_number -
      firstChangeOrder.version_number
  );
};

const ListingRequestChangeOrderSummary = ({
  changeOrders,
  viewer,
  isLoading = false,
  error,
}: ListingRequestChangeOrderSummaryProps) => {
  const hasError = Boolean(error);
  const visibleChangeOrders = getVisibleChangeOrders(
    changeOrders,
    viewer
  );

  return (
    <div>
      <div className={classes.section}>

        {isLoading && (
          <div className={classes.loading}>
            Loading project change orders…
          </div>
        )}

        {!isLoading && hasError && (
          <div className={classes.error}>
            {getErrorMessage(error)}
          </div>
        )}

        {!isLoading &&
          !hasError &&
          visibleChangeOrders.length === 0 && (
            <div className={classes.empty}>
              No project change orders have been created for
              this commission yet.
            </div>
          )}

        {!isLoading &&
          !hasError &&
          visibleChangeOrders.length > 0 && (
            <div className={classes.list}>
              {visibleChangeOrders.map((changeOrder) => {
                const currency =
                  getSnapshotCurrency(changeOrder);

                const impactLabels =
                  getListingRequestChangeOrderImpactLabels({
                    changesScope:
                      changeOrder.changes_scope,
                    changesPrice:
                      changeOrder.changes_price,
                    changesTimeline:
                      changeOrder.changes_timeline,
                    changesDeliverables:
                      changeOrder.changes_deliverables,
                    changesPaymentSchedule:
                      changeOrder.changes_payment_schedule,
                    changesMilestones:
                      changeOrder.changes_milestones,
                  });

                return (
                  <article
                    className={classes.item}
                    key={changeOrder.id}
                  >
                    <div className={classes.itemHeader}>
                      <div className={classes.itemHeading}>
                        <h3 className={classes.itemTitle}>
                          {changeOrder.title}
                        </h3>

                        <div className={classes.itemVersion}>
                          Change order version{" "}
                          {changeOrder.version_number}
                        </div>
                      </div>

                      <span
                        className={getStatusClass(
                          changeOrder
                        )}
                      >
                        {getListingRequestChangeOrderStatusLabel(
                          changeOrder.status
                        )}
                      </span>
                    </div>

                    <p className={classes.statusSummary}>
                      {getListingRequestChangeOrderStatusSummary(
                        changeOrder.status
                      )}
                    </p>

                    <div className={classes.impactRow}>
                      {impactLabels.map((label) => (
                        <span
                          className={classes.impactBadge}
                          key={label}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    <p className={classes.body}>
                      {changeOrder.summary}
                    </p>

                    {(changeOrder.changes_price ||
                      changeOrder.changes_timeline) && (
                      <div className={classes.metaGrid}>
                        {changeOrder.changes_price && (
                          <>
                            <div
                              className={classes.metaBlock}
                            >
                              <div
                                className={
                                  classes.metaLabel
                                }
                              >
                                Price change
                              </div>

                              <div
                                className={
                                  classes.metaValue
                                }
                              >
                                {formatMoney(
                                  changeOrder.price_delta,
                                  currency,
                                  true
                                )}
                              </div>
                            </div>

                            <div
                              className={classes.metaBlock}
                            >
                              <div
                                className={
                                  classes.metaLabel
                                }
                              >
                                Revised total
                              </div>

                              <div
                                className={
                                  classes.metaValue
                                }
                              >
                                {changeOrder.revised_total_amount !==
                                null
                                  ? formatMoney(
                                      changeOrder.revised_total_amount,
                                      currency
                                    )
                                  : "Not set"}
                              </div>
                            </div>
                          </>
                        )}

                        {changeOrder.changes_timeline && (
                          <>
                            <div
                              className={classes.metaBlock}
                            >
                              <div
                                className={
                                  classes.metaLabel
                                }
                              >
                                Timeline change
                              </div>

                              <div
                                className={
                                  classes.metaValue
                                }
                              >
                                {formatTimelineDelta(
                                  changeOrder.timeline_delta_days
                                )}
                              </div>
                            </div>

                            <div
                              className={classes.metaBlock}
                            >
                              <div
                                className={
                                  classes.metaLabel
                                }
                              >
                                Revised completion
                              </div>

                              <div
                                className={
                                  classes.metaValue
                                }
                              >
                                {formatDate(
                                  changeOrder.revised_completion_at
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {changeOrder.buyer_response_reason && (
                      <div className={classes.response}>
                        <strong>Buyer response:</strong>{" "}
                        {changeOrder.buyer_response_reason}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
};

export default ListingRequestChangeOrderSummary;