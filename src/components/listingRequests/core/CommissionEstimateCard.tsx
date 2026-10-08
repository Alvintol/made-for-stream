import { STANDARD_FEE_BPS } from "../../../domain/listings/listingRequestAgreements";
import { formatFeeRateBps } from "../../../domain/payments/listingRequestPaymentDisplay";
import { useDisplayCurrency } from "../../../hooks/money/useDisplayCurrency";
import type { BuyerServiceFeeRate } from "../../../hooks/payments/useBuyerServiceFeeRate";
import { convertAmount, formatCurrencyAmount } from "../../../lib/money/displayCurrency";

type CommissionEstimateCardProps = {
  // In the creator's currency. Nothing is shown for a zero or missing amount.
  amount: number;
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

// A mock invoice beside the commission request form, so the buyer service
// fee is not a surprise at checkout. An example only: the creator sets the
// real price in the agreement, and it may be paid in several payments.
const CommissionEstimateCard = (props: CommissionEstimateCardProps) => {
  const { amount, currency, amountLabel, feeRate } = props;
  const { displayCurrency, rates } = useDisplayCurrency();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  const baseCents = Math.round(amount * 100);
  const standardFeeCents = feeCentsAt(baseCents, STANDARD_FEE_BPS);
  // A rate can only lower the fee here, never raise it.
  const feeCents = Math.min(standardFeeCents, feeCentsAt(baseCents, feeRate.feeBps));
  const discountCents = standardFeeCents - feeCents;
  const total = (baseCents + feeCents) / 100;

  const converted = displayCurrency ? convertAmount(total, currency, displayCurrency, rates) : null;
  const money = (cents: number) => formatCurrencyAmount(cents / 100, currency);

  return (
    <section className={classes.card} aria-label="Estimated invoice">
      <div className={classes.head}>
        <h2 className={classes.title}>Estimated invoice</h2>
        <span className={classes.tag}>Example</span>
      </div>

      <dl className={classes.rows}>
        <div className={classes.row}>
          <dt>{amountLabel}</dt>
          <dd>{money(baseCents)}</dd>
        </div>
        <div className={classes.row}>
          <dt>Buyer service fee ({formatFeeRateBps(STANDARD_FEE_BPS)})</dt>
          <dd>{money(standardFeeCents)}</dd>
        </div>
        {discountCents > 0 && (
          <div className={classes.discount}>
            <dt>{discountLabels[feeRate.reason]}</dt>
            <dd>−{money(discountCents)}</dd>
          </div>
        )}
        <div className={classes.row}>
          <dt>Tax</dt>
          <dd className={classes.muted}>At checkout, if any</dd>
        </div>
        <div className={classes.total}>
          <dt>Estimated total</dt>
          <dd>{formatCurrencyAmount(total, currency)}</dd>
        </div>
      </dl>

      {converted !== null && displayCurrency && (
        <p className={classes.approx}>
          ≈ {formatCurrencyAmount(Math.round(converted), displayCurrency)} in your currency
        </p>
      )}

      <p className={classes.note}>
        An example, not a quote. The creator sets the final price in the agreement, and you pay
        in {currency.toUpperCase()}.{" "}
        {feeCents > 0
          ? "The buyer service fee is added to each payment."
          : "No buyer service fee is added to your payments."}{" "}
        A tip is optional.
      </p>
    </section>
  );
};

export default CommissionEstimateCard;
