import { useQuery } from "@tanstack/react-query";

import type { PaymentTaxDisplayInput } from "../../domain/payments/listingRequestPaymentTax";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestPaymentType =
  | "one_time"
  | "starting_payment"
  | "milestone_payment"
  | "change_order_payment"
  | "final_balance";

export type ListingRequestPaymentStatus =
  | "requires_checkout"
  | "checkout_opened"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "cancelled";

export type ListingRequestPaymentRow = {
  id: string;
  listing_request_id: string;
  payment_schedule_item_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  payment_type: ListingRequestPaymentType;
  status: ListingRequestPaymentStatus;
  currency: string;
  base_amount_cents: number;
  creator_tip_cents: number;
  buyer_service_fee_cents: number;
  buyer_service_fee_bps: number;
  buyer_service_fee_minimum_cents: number;
  creator_platform_fee_cents: number;
  platform_support_cents: number;
  application_fee_cents: number;
  total_checkout_cents: number;
  payer_user_id: string;
  creator_user_id: string;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  disputed_at: string | null;
  cancelled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const useListingRequestPayments = (
  listingRequestId?: string | null,
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["listingRequestPayments", listingRequestId],
    enabled: Boolean(user?.id && listingRequestId),
    queryFn: async (): Promise<ListingRequestPaymentRow[]> => {
      if (!user?.id || !listingRequestId) {
        return [];
      }

      const { data, error } = await supabase
        .from("listing_request_payments")
        .select(`
          id,
          listing_request_id,
          payment_schedule_item_id,
          related_entity_type,
          related_entity_id,
          payment_type,
          status,
          currency,
          base_amount_cents,
          creator_tip_cents,
          buyer_service_fee_cents,
          creator_platform_fee_cents,
          platform_support_cents,
          application_fee_cents,
          total_checkout_cents,
          payer_user_id,
          creator_user_id,
          paid_at,
          failed_at,
          refunded_at,
          disputed_at,
          cancelled_at,
          metadata,
          created_at,
          updated_at
        `)
        .eq("listing_request_id", listingRequestId)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return (data as ListingRequestPaymentRow[] | null) ?? [];
    },
  });
};

export type ListingRequestPaymentSummary = Pick<
  ListingRequestPaymentRow,
  | "id"
  | "listing_request_id"
  | "payment_type"
  | "status"
  | "currency"
  | "base_amount_cents"
  | "creator_tip_cents"
  | "buyer_service_fee_cents"
  | "buyer_service_fee_bps"
  | "buyer_service_fee_minimum_cents"
  | "platform_support_cents"
  | "total_checkout_cents"
  | "metadata"
> &
  // Sprint 7: tax is shown as its own line before payment.
  PaymentTaxDisplayInput;

// One payment, as the buyer sees it before checkout. RLS limits this to the
// payer, the creator and admins.
export const useListingRequestPayment = (paymentId?: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["listingRequestPayment", paymentId],
    enabled: Boolean(user?.id && paymentId),
    queryFn: async (): Promise<ListingRequestPaymentSummary | null> => {
      if (!user?.id || !paymentId) {
        return null;
      }

      const { data, error } = await supabase
        .from("listing_request_payments")
        .select(
          "id, listing_request_id, payment_type, status, currency, base_amount_cents, creator_tip_cents, buyer_service_fee_cents, buyer_service_fee_bps, buyer_service_fee_minimum_cents, platform_support_cents, tax_cents, tax_treatment, total_checkout_cents, metadata",
        )
        .eq("id", paymentId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as ListingRequestPaymentSummary | null) ?? null;
    },
  });
};
