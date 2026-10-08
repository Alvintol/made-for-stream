import { STANDARD_FEE_BPS } from "../../domain/listings/listingRequestAgreements";

// Why a buyer's rate is what it is. Mirrors the database's
// listing_request_fee_reason.
export type BuyerServiceFeeReason = "standard" | "subscription" | "promotional" | "goodwill";

export type BuyerServiceFeeRate = {
  // Basis points: 500 is 5%, 0 is a waived fee.
  feeBps: number;
  reason: BuyerServiceFeeReason;
};

// The buyer service fee rate that applies to the signed-in person, for
// estimates shown before an agreement exists.
//
// ponytail: everyone is on the standard rate today, exactly as the database's
// resolve_listing_request_fee_rates() answers. When buyer subscriptions exist
// (launch-scope.md section 3.5), read the person's own rate here, through an
// RPC they are allowed to call, and nothing else on the website has to
// change: the estimate card already shows a lower rate as a discount. Real
// payments never use this; they take the rate the database locked on the
// agreement.
export const useBuyerServiceFeeRate = (): BuyerServiceFeeRate => ({
  feeBps: STANDARD_FEE_BPS,
  reason: "standard",
});
