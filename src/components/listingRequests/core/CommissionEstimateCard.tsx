import { STANDARD_FEE_BPS } from "../../../domain/listings/listingRequestAgreements";
import { formatFeeRateBps } from "../../../domain/payments/listingRequestPaymentDisplay";
import { useDisplayCurrency } from "../../../hooks/money/useDisplayCurrency";
import type { BuyerServiceFeeRate } from "../../../hooks/payments/useBuyerServiceFeeRate";
import { convertAmount, formatCurrencyAmountRange } from "../../../lib/money/displayCurrency";

type CommissionEstimateCardProps = {
  // In the creator's currency. Nothing is shown for a zero or missing amount.
  amount: number;
  // The top of a budget range. Every line then shows a range.
  amountMax?: number | null;
  currency: string;
  // What the amount is: "Your budget", "Listing price".
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

const discountLabels: Record<BuyerServiceFeeRate["reason"], string> = {
  standard: "Discount",
  subscription: "Subscriber discount",
  promotional: "Promotional discount",
  goodwill: "Fee adjustment",
};

// The same rounding the database uses for a payment: the fee is rounded up
// to the cent (ensure_listing_request_payment_for_schedule_item).
const feeCentsAt = (baseCents: number, feeBps: number): number =>
  Math.ceil((baseCents * feeBps) / 10000);

// What one project price comes to, in cents.
const estimateFor = (amount: number, feeBps: number) => {
  const base = Math.round(amount * 100);
  const standardFee = feeCentsAt(base, STANDARD_FEE_BPS);
  // A rate can only lower the fee here, never raise it.
  const fee = Math.min(standardFee, feeCentsAt(base, feeBps));

  return { base, standardFee, discount: standardFee - fee, fee, total: base + fee };
};

// A mock invoice beside the commission request form, so the buyer service
// fee is not a surprise at checkout. An example only: the creator sets the
// real price in the agreement, and it may be paid in several payments.
const CommissionEstimateCard = (props: CommissionEstimateCardProps) => {
  const { amount, amountMax = null, currency, amountLabel, feeRate } = props;
  const { displayCurrency, rates } = useDisplayCurrency();

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
    <section className={classes.card} aria-label="Estimated invoice">
      <div className={classes.head}>
        <h2 className={classes.title}>Estimated invoice</h2>
        <span className={classes.tag}>Example</span>
      </div>

      <dl className={classes.rows}>
        <div className={classes.row}>
          <dt>{amountLabel}</dt>
          <dd className={classes.amount}>{money((estimate) => estimate.base)}</dd>
        </div>
        <div className={classes.row}>
          <dt>Buyer service fee ({formatFeeRateBps(STANDARD_FEE_BPS)})</dt>
          <dd className={classes.amount}>{money((estimate) => estimate.standardFee)}</dd>
        </div>
        {low.discount > 0 && (
          <div className={classes.discount}>
            <dt>{discountLabels[feeRate.reason]}</dt>
            <dd className={classes.amount}>−{money((estimate) => estimate.discount)}</dd>
          </div>
        )}
        <div className={classes.row}>
          <dt>Tax</dt>
          <dd className={classes.muted}>At checkout, if any</dd>
        </div>
        <div className={classes.total}>
          <dt>Estimated total</dt>
          <dd className={classes.amount}>{money((estimate) => estimate.total)}</dd>
        </div>
      </dl>

      {convertedLow !== null && displayCurrency && (
        <p className={classes.approx}>
          ≈{" "}
          {formatCurrencyAmountRange(
            Math.round(convertedLow),
            convertedHigh === null ? null : Math.round(convertedHigh),
            displayCurrency,
          )}{" "}
          in your currency
        </p>
      )}

      <p className={classes.note}>
        An example, not a quote. The creator sets the final price in the agreement, and you pay
        in {currency.toUpperCase()}.{" "}
        {low.fee > 0
          ? "The buyer service fee is added to each payment."
          : "No buyer service fee is added to your payments."}{" "}
        A tip is optional.
      </p>
    </section>
  );
};

export default CommissionEstimateCard;
