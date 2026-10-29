import { STANDARD_FEE_BPS } from "../../../domain/listings/listingRequestAgreements";
import {
  buyerServiceFeeCents,
  formatFeeRateBps,
} from "../../../domain/payments/listingRequestPaymentDisplay";
import { useDisplayCurrency } from "../../../hooks/money/useDisplayCurrency";
import type { BuyerServiceFeeRate } from "../../../hooks/payments/useBuyerServiceFeeRate";
import { useT } from "../../../lib/i18n/i18n";
import { convertAmount, formatCurrencyAmountRange } from "../../../lib/money/displayCurrency";
type CommissionEstimateCardProps = {
  // In the creator's currency. Nothing is shown for a zero or missing amount.
  amount: number;
  // The top of a budget range. Every line then shows a range.
  amountMax?: number | null;
  currency: string;
  // What the amount is: "Your budget", "Creator's price" (the listing's
  // price before the buyer service fee).
  amountLabel: string;
  // The buyer's own rate (useBuyerServiceFeeRate). A rate below the standard
  // one is shown as the standard fee with a discount under it.
  feeRate: BuyerServiceFeeRate;
};

const classes = {
  card: "card space-y-3 p-4 hover:shadow-[var(--shadow-md)]",
  head: "flex items-center justify-between gap-3",
  title: "font-display text-sm font-bold tracking-tight text-zinc-900",
  tag: "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600",
  rows: "space-y-1.5 text-sm text-zinc-700",
  row: "flex items-baseline justify-between gap-3",
  discount: "flex items-baseline justify-between gap-3 font-semibold text-emerald-700",
  muted: "text-zinc-500",
  total: "flex items-baseline justify-between gap-3 border-t border-[var(--hairline)] pt-2 font-bold text-zinc-900",
  amount: "text-right",
  approx: "text-right text-xs text-zinc-500",
  note: "text-xs leading-5 text-zinc-500",
} as const;

// What one project price comes to, in cents.
const estimateFor = (amount: number, feeBps: number) => {
  const base = Math.round(amount * 100);
  const standardFee = buyerServiceFeeCents(base, STANDARD_FEE_BPS);
  // A rate can only lower the fee here, never raise it.
  const fee = Math.min(standardFee, buyerServiceFeeCents(base, feeBps));

  return { base, standardFee, discount: standardFee - fee, fee, total: base + fee };
};

// A mock invoice beside the commission request form, so the buyer service
// fee is not a surprise at checkout. An example only: the creator sets the
// real price in the agreement, and it may be paid in several payments.
const CommissionEstimateCard = (props: CommissionEstimateCardProps) => {
  const { amount, amountMax = null, currency, amountLabel, feeRate } = props;
  const { displayCurrency, rates } = useDisplayCurrency();
  const t = useT();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  const low = estimateFor(amount, feeRate.feeBps);
  const high = amountMax !== null && amountMax > amount ? estimateFor(amountMax, feeRate.feeBps) : null;

  const money = (pick: (estimate: typeof low) => number) =>
    formatCurrencyAmountRange(pick(low) / 100, high ? pick(high) / 100 : null, currency);

  const convert = (cents: number) =>
    displayCurrency ? convertAmount(cents / 100, currency, displayCurrency, rates) : null;
  const convertedLow = convert(low.total);
  const convertedHigh = high ? convert(high.total) : null;

  return (
    <section className={classes.card} aria-label={t("estimate.title")}>
      <div className={classes.head}>
        <h2 className={classes.title}>{t("estimate.title")}</h2>
        <span className={classes.tag}>{t("estimate.example")}</span>
      </div>

      <dl className={classes.rows}>
        <div className={classes.row}>
          <dt>{amountLabel}</dt>
          <dd className={classes.amount}>{money((estimate) => estimate.base)}</dd>
        </div>
        <div className={classes.row}>
          <dt>{t("estimate.fee", { rate: formatFeeRateBps(STANDARD_FEE_BPS) })}</dt>
          <dd className={classes.amount}>{money((estimate) => estimate.standardFee)}</dd>
        </div>
        {low.discount > 0 && (
          <div className={classes.discount}>
            <dt>{t(`estimate.discount.${feeRate.reason}`)}</dt>
            <dd className={classes.amount}>−{money((estimate) => estimate.discount)}</dd>
          </div>
        )}
        <div className={classes.row}>
          <dt>{t("estimate.tax")}</dt>
          <dd className={classes.muted}>{t("estimate.taxValue")}</dd>
        </div>
        <div className={classes.total}>
          <dt>{t("estimate.total")}</dt>
          <dd className={classes.amount}>{money((estimate) => estimate.total)}</dd>
        </div>
      </dl>

      {convertedLow !== null && displayCurrency && (
        <p className={classes.approx}>
          {t("estimate.approx", {
            amount: formatCurrencyAmountRange(
              Math.round(convertedLow),
              convertedHigh === null ? null : Math.round(convertedHigh),
              displayCurrency,
            ),
          })}
        </p>
      )}

      <p className={classes.note}>
        {t("estimate.note", { currency: currency.toUpperCase() })}{" "}
        {low.fee > 0 ? t("estimate.feeEachPayment") : t("estimate.noFee")}{" "}
        {t("estimate.tip")}
      </p>
    </section>
  );
};

export default CommissionEstimateCard;
