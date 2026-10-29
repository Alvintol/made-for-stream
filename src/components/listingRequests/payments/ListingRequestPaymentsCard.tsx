import { hasErrorMessage } from "../../../lib/errorMessage";
import { Link } from "react-router-dom";

import {
  canOpenListingRequestPaymentCheckout,
  formatPaymentCents,
  getListingRequestPaymentActionLabel,
  getListingRequestPaymentStatusLabel,
  getListingRequestPaymentTitle,
  getListingRequestPaymentTypeLabel,
} from "../../../domain/payments/listingRequestPaymentDisplay";
import type { ListingRequestPaymentRow } from "../../../hooks/payments/useListingRequestPayments";
import { useT, type Translate } from "../../../lib/i18n/i18n";
type ListingRequestPaymentsCardProps = {
  payments: ListingRequestPaymentRow[];
  isLoading?: boolean;
  error?: unknown;
  readOnly?: boolean;
};

const classes = {
  section: "space-y-4",
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemType: "text-xs font-semibold text-zinc-500",
  status:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  metaGrid: "mt-4 grid gap-3 sm:grid-cols-3",
  metaBlock: "space-y-1",
  metaLabel:
    "metaLabel",
  metaValue: "text-sm font-semibold text-zinc-900",
  feeText: "mt-3 text-xs leading-5 text-zinc-500",
  actions: "mt-4 flex flex-wrap items-center gap-3",
  payButton:
    "btnPrimary",
  loading:
    "notice noticeNeutral",
  empty:
    "notice noticeNeutral",
  error:
    "notice noticeError",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("payments.loadFailed");

const ListingRequestPaymentsCard = ({
  payments,
  isLoading = false,
  error,
  readOnly = false,
}: ListingRequestPaymentsCardProps) => {
  const t = useT();

  if (isLoading) {
    return (
      <section>
        <div className={classes.loading}>{t("payments.loading")}</div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <div className={classes.error}>
          {getErrorMessage(error, t)}
        </div>
      </section>
    );
  }

  if (payments.length === 0) {
    return null;
  }

  return (
    <section>
      <div className={classes.section}>

        <div className={classes.list}>
          {payments.map((payment) => {
            const actionLabel =
              getListingRequestPaymentActionLabel(payment.status, t);

            const canPay =
              !readOnly &&
              canOpenListingRequestPaymentCheckout(payment);

            return (
              <article
                key={payment.id}
                className={classes.item}
              >
                <div className={classes.itemHeader}>
                  <div className={classes.itemHeading}>
                    <h3 className={classes.itemTitle}>
                      {getListingRequestPaymentTitle(payment, t)}
                    </h3>

                    <p className={classes.itemType}>
                      {getListingRequestPaymentTypeLabel(
                        payment.payment_type,
                        t,
                      )}
                    </p>
                  </div>

                  <span className={classes.status}>
                    {getListingRequestPaymentStatusLabel(
                      payment.status,
                      t,
                    )}
                  </span>
                </div>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      {t("payments.projectAmount")}
                    </div>
                    <div className={classes.metaValue}>
                      {formatPaymentCents(
                        payment.base_amount_cents,
                        payment.currency,
                      )}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      {t("payments.serviceFee")}
                    </div>
                    <div className={classes.metaValue}>
                      {formatPaymentCents(
                        payment.buyer_service_fee_cents,
                        payment.currency,
                      )}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      {t("checkout.total")}
                    </div>
                    <div className={classes.metaValue}>
                      {formatPaymentCents(
                        payment.total_checkout_cents,
                        payment.currency,
                      )}
                    </div>
                  </div>
                </div>

                {payment.creator_tip_cents > 0 && (
                  <p className={classes.feeText}>
                    {t("payments.tipIncluded", {
                      amount: formatPaymentCents(
                        payment.creator_tip_cents,
                        payment.currency,
                      ),
                    })}
                  </p>
                )}

                {payment.platform_support_cents > 0 && (
                  <p className={classes.feeText}>
                    {t("payments.supportIncluded", {
                      amount: formatPaymentCents(
                        payment.platform_support_cents,
                        payment.currency,
                      ),
                    })}
                  </p>
                )}

                {canPay && actionLabel && (
                  <div className={classes.actions}>
                    <Link
                      className={classes.payButton}
                      to={`/payments/checkout/${payment.id}`}
                    >
                      {actionLabel}
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ListingRequestPaymentsCard;