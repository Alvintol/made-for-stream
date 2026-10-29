import {
  formatFeeRateBps,
  priceWithBuyerServiceFee,
} from "../../domain/payments/listingRequestPaymentDisplay";
import { useDisplayCurrency } from "../../hooks/money/useDisplayCurrency";
import { useBuyerServiceFeeRate } from "../../hooks/payments/useBuyerServiceFeeRate";
import {
  formatApproximateListingPrice,
  formatListingPrice,
  getCurrencyName,
  LEGACY_LISTING_CURRENCY,
} from "../../lib/money/displayCurrency";

type ListingPriceTextProps = {
  listing: {
    price_type: string;
    price_min: number;
    price_max: number | null;
    currency?: string | null;
  };
  // "compact": one figure, for cards and grids.
  // "detailed": the real price, the estimate, and the explanation.
  variant?: "compact" | "detailed";
};

const classes = {
  fee: "block text-[11px] font-normal text-zinc-500",
  approx: "mt-1 text-sm font-semibold text-zinc-600",
  note: "mt-2 text-xs font-normal leading-5 text-zinc-500",
} as const;

// A listing's price for buyers, with the buyer service fee included: the
// first price a buyer sees is what they pay before any tax (decided
// 2026-10-28).
//
// On cards it shows an approximate figure in the visitor's own currency when
// that differs from the creator's ("≈ $68 CAD"), and the real price
// otherwise. On the listing's page it always shows the creator's real price
// first, then the estimate, and says which is which. Agreements and checkout
// never use this: they show the creator's currency only, line by line.
const ListingPriceText = ({ listing, variant = "compact" }: ListingPriceTextProps) => {
  const { displayCurrency, rates } = useDisplayCurrency();
  const { feeBps } = useBuyerServiceFeeRate();

  const withFee = {
    ...listing,
    price_min: priceWithBuyerServiceFee(listing.price_min, feeBps),
    price_max:
      listing.price_max === null ? null : priceWithBuyerServiceFee(listing.price_max, feeBps),
  };

  const actual = formatListingPrice(withFee);
  const approximate = formatApproximateListingPrice(withFee, displayCurrency, rates);
  // A free listing has no fee to mention.
  const feeText =
    feeBps > 0 && withFee.price_min > 0 ? `Includes ${formatFeeRateBps(feeBps)} service fee` : null;

  if (variant === "compact") {
    return (
      <>
        {approximate && displayCurrency ? (
          <span title={`Priced in ${(listing.currency || LEGACY_LISTING_CURRENCY).toUpperCase()}: ${actual}. The figure shown is an estimate.`}>
            {approximate}
            <span className="sr-only">
              {" "}
              (approximate; the listing is priced at {actual})
            </span>
          </span>
        ) : (
          actual
        )}
        {feeText && <span className={classes.fee}>{feeText}</span>}
      </>
    );
  }

  const listingCurrency = (listing.currency || LEGACY_LISTING_CURRENCY).toUpperCase();

  return (
    <>
      {actual}

      {approximate && displayCurrency && <div className={classes.approx}>{approximate}</div>}

      {feeText && (
        <p className={classes.note}>
          {feeText}: the creator's price is {formatListingPrice(listing)}. Tax, if any, is
          added at checkout.
        </p>
      )}

      {approximate && displayCurrency && (
        <p className={classes.note}>
          This listing is priced in {getCurrencyName(listingCurrency)} ({listingCurrency}), the
          creator's currency. The {displayCurrency.toUpperCase()} figure is an estimate from the
          European Central Bank's reference rate for {rates?.date}. You pay in {listingCurrency},
          and your bank or card provider sets the rate you actually get.
        </p>
      )}
    </>
  );
};

export default ListingPriceText;
