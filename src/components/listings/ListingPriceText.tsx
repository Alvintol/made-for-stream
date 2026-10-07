import { useDisplayCurrency } from "../../hooks/money/useDisplayCurrency";
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
  approx: "mt-1 text-sm font-semibold text-zinc-600",
  note: "mt-2 text-xs font-normal leading-5 text-zinc-500",
} as const;

// A listing's price for buyers.
//
// On cards it shows an approximate figure in the visitor's own currency when
// that differs from the creator's ("≈ $68 CAD"), and the real price
// otherwise. On the listing's page it always shows the creator's real price
// first, then the estimate, and says which is which. Agreements and checkout
// never use this: they show the creator's currency only.
const ListingPriceText = ({ listing, variant = "compact" }: ListingPriceTextProps) => {
  const { displayCurrency, rates } = useDisplayCurrency();

  const actual = formatListingPrice(listing);
  const approximate = formatApproximateListingPrice(listing, displayCurrency, rates);

  if (!approximate || !displayCurrency) {
    return <>{actual}</>;
  }

  const listingCurrency = (listing.currency || LEGACY_LISTING_CURRENCY).toUpperCase();

  if (variant === "compact") {
    return (
      <span title={`Priced in ${listingCurrency}: ${actual}. The figure shown is an estimate.`}>
        {approximate}
        <span className="sr-only">
          {" "}
          (approximate; the listing is priced at {actual})
        </span>
      </span>
    );
  }

  return (
    <>
      {actual}

      <div className={classes.approx}>{approximate}</div>

      <p className={classes.note}>
        This listing is priced in {getCurrencyName(listingCurrency)} ({listingCurrency}), the
        creator's currency. The {displayCurrency.toUpperCase()} figure is an estimate from the
        European Central Bank's reference rate for {rates?.date}. You pay in {listingCurrency},
        and your bank or card provider sets the rate you actually get.
      </p>
    </>
  );
};

export default ListingPriceText;
