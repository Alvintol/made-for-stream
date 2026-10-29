import { formatMoney } from "../../lib/formatMoney";
import type {
  ListingRequestPaymentRow,
  ListingRequestPaymentStatus,
  ListingRequestPaymentType,
} from "../../hooks/payments/useListingRequestPayments";

export const getListingRequestPaymentTypeLabel = (
  paymentType: ListingRequestPaymentType,
): string => {
  const labelByType: Record<ListingRequestPaymentType, string> = {
    one_time: "Project payment",
    starting_payment: "Starting payment",
    milestone_payment: "Milestone payment",
    change_order_payment: "Change order payment",
    final_balance: "Final balance",
  };

  return labelByType[paymentType];
};

export const getListingRequestPaymentStatusLabel = (
  status: ListingRequestPaymentStatus,
): string => {
  const labelByStatus: Record<ListingRequestPaymentStatus, string> = {
    requires_checkout: "Payment required",
    checkout_opened: "Checkout started",
    processing: "Processing",
    paid: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    disputed: "Disputed",
    cancelled: "Cancelled",
  };

  return labelByStatus[status];
};

export const getListingRequestPaymentActionLabel = (
  status: ListingRequestPaymentStatus,
): string | null =>
  status === "requires_checkout"
    ? "Pay now"
    : status === "checkout_opened"
      ? "Continue payment"
      : status === "failed"
        ? "Retry payment"
        : null;

export const canOpenListingRequestPaymentCheckout = (
  payment: Pick<ListingRequestPaymentRow, "status">,
): boolean =>
  payment.status === "requires_checkout" ||
  payment.status === "checkout_opened" ||
  payment.status === "failed";

export const getListingRequestPaymentTitle = (
  payment: Pick<ListingRequestPaymentRow, "metadata" | "payment_type">,
): string => {
  const metadataTitle = payment.metadata?.payment_title;

  return typeof metadataTitle === "string" && metadataTitle.trim()
    ? metadataTitle.trim()
    : getListingRequestPaymentTypeLabel(payment.payment_type);
};

// Payment amounts are stored in minor units. This assumes a two-decimal
// currency, which holds for the CAD and USD amounts supported today.
export const formatPaymentCents = (cents: number, currency: string): string =>
  formatMoney(cents / 100, currency);

// 500 -> "5%", 250 -> "2.5%", 125 -> "1.25%". Trailing zeros are dropped so a
// whole-number rate does not read as "5.00%".
export const formatFeeRateBps = (bps: number): string =>
  `${Number((bps / 100).toFixed(2))}%`;

// The buyer service fee on one amount, rounded up to the cent as the
// database rounds it (ensure_listing_request_payment_for_schedule_item).
export const buyerServiceFeeCents = (baseCents: number, feeBps: number): number =>
  Math.ceil((baseCents * feeBps) / 10000);

// A price as the buyer pays it: the amount plus the buyer service fee.
// Split over several payments, each is rounded up on its own, so the real
// total can be a cent higher per payment.
export const priceWithBuyerServiceFee = (amount: number, feeBps: number): number => {
  const cents = Math.round(amount * 100);

  return (cents + buyerServiceFeeCents(cents, feeBps)) / 100;
};

// Explains the buyer service fee on a payment the buyer is about to make.
//
// Derived from the rate and minimum recorded on the payment row, not from a
// hardcoded 5% / 1.00. Those are per-payment snapshots: the rate becomes
// per-buyer when subscriptions land, and payments taken before the minimums were
// removed still carry the minimum they were charged under. Reading the row keeps
// this correct for both without a dated special case.
export const describeBuyerServiceFee = (payment: {
  base_amount_cents: number;
  buyer_service_fee_cents: number;
  buyer_service_fee_bps: number;
  buyer_service_fee_minimum_cents: number;
  currency: string;
}): string => {
  // A waived fee. Reporting this as "0% of the project payment" is accurate and
  // reads like a bug, so say what actually happened.
  if (payment.buyer_service_fee_cents === 0) {
    return "waived on this payment.";
  }

  const rate = formatFeeRateBps(payment.buyer_service_fee_bps);
  const percentageFeeCents = Math.ceil(
    (payment.base_amount_cents * payment.buyer_service_fee_bps) / 10000,
  );

  // Only possible on a payment taken before the minimums were removed; the
  // minimum recorded on newer rows is zero.
  if (payment.buyer_service_fee_cents > percentageFeeCents) {
    const minimum = formatPaymentCents(
      payment.buyer_service_fee_minimum_cents,
      payment.currency,
    );

    return `${rate} of the project payment, with a ${minimum} minimum. The minimum applies here because ${rate} of this payment is less than ${minimum}.`;
  }

  return `${rate} of the project payment.`;
};
