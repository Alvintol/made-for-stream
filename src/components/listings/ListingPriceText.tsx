import {
  formatFeeRateBps,
  priceWithBuyerServiceFee,
} from "../../domain/payments/listingRequestPaymentDisplay";
import { useDisplayCurrency } from "../../hooks/money/useDisplayCurrency";
import { useBuyerServiceFeeRate } from "../../hooks/payments/useBuyerServiceFeeRate";
import { useLanguage, useT } from "../../lib/i18n/i18n";
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
  const t = useT();
  const language = useLanguage();
  const from = t("price.from");

  const withFee = {
    ...listing,
    price_min: priceWithBuyerServiceFee(listing.price_min, feeBps),
    price_max:
      listing.price_max === null ? null : priceWithBuyerServiceFee(listing.price_max, feeBps),
  };

  const actual = formatListingPrice(withFee, from);
  const approximate = formatApproximateListingPrice(withFee, displayCurrency, rates, from);
  const rate = formatFeeRateBps(feeBps);
  // A free listing has no fee to mention.
  const showFee = feeBps > 0 && withFee.price_min > 0;
  const listingCurrency = (listing.currency || LEGACY_LISTING_CURRENCY).toUpperCase();

  if (variant === "compact") {
    return (
      <>
        {approximate && displayCurrency ? (
          <span title={t("price.estimateTitle", { currency: listingCurrency, price: actual })}>
            {approximate}
            <span className="sr-only"> {t("price.approximate", { price: actual })}</span>
          </span>
        ) : (
          actual
        )}
        {showFee && <span className={classes.fee}>{t("price.includesFee", { rate })}</span>}
      </>
    );
  }

  return (
    <>
      {actual}

      {approximate && displayCurrency && <div className={classes.approx}>{approximate}</div>}

      {showFee && (
        <p className={classes.note}>
          {t("price.feeNote", { rate, price: formatListingPrice(listing, from) })}
        </p>
      )}

      {approximate && displayCurrency && (
        <p className={classes.note}>
          {t("price.currencyNote", {
            currencyName: getCurrencyName(listingCurrency, language),
            currency: listingCurrency,
            displayCurrency: displayCurrency.toUpperCase(),
            date: rates?.date ?? "",
          })}
        </p>
      )}
    </>
  );
};

export default ListingPriceText;
