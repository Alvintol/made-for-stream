import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  ListingRequestAgreementStatus,
  ListingRequestMinimumUpdateRule,
  ListingRequestPaymentStructure,
  ListingRequestPaymentTiming,
  ListingRequestStartingPaymentStatus,
} from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type CreateListingRequestAgreementItemInput = {
  client_key?: string | null;
  title: string;
  description?: string | null;
  item_type:
  | "included"
  | "optional_addon"
  | "required_payment_item"
  | "milestone"
  | "buyer_provides"
  | "buyer_approves";
  price_amount?: number | null;
  timeline_impact_days?: number | null;
  payment_timing: ListingRequestPaymentTiming;
  is_required?: boolean;
  is_selected?: boolean;
  sort_order?: number;
};

export type CreateListingRequestAgreementPaymentScheduleItemInput = {
  agreement_item_client_key?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  currency?: string;
  payment_timing: Extract<
    ListingRequestPaymentTiming,
    | "due_before_work_starts"
    | "due_at_milestone_approval"
    | "due_before_final_release"
    | "due_on_change_order_acceptance"
  >;
  status?:
  | "pending"
  | "payment_required"
  | "paid"
  | "waived"
  | "cancelled";
  due_at?: string | null;
  sort_order?: number;
};

export type CreateListingRequestAgreementInput = {
  listingRequestId: string;
  status: Extract<ListingRequestAgreementStatus, "draft" | "sent">;
  paymentStructure: ListingRequestPaymentStructure;
  startingPaymentStatus: ListingRequestStartingPaymentStatus;
  currency: string;
  baseAmount: number;
  totalAmount: number;
  depositAmount?: number | null;
  estimatedStartAt?: string | null;
  estimatedCompletionAt: string;
  lateDeliveryGraceDays: number;
  includedRevisionCount: number;
  minimumUpdateRule: ListingRequestMinimumUpdateRule;
  scopeSummary: string;
  includedDeliverables: string[];
  additionalCostPolicy: string;
  revisionPolicy?: string | null;
  updateScheduleSummary?: string | null;
  items: CreateListingRequestAgreementItemInput[];
  paymentScheduleItems: CreateListingRequestAgreementPaymentScheduleItemInput[];
};

type CreatedAgreementRow = {
  id: string;
  status: ListingRequestAgreementStatus;
  version_number: number;
};

const cleanOptionalText = (value?: string | null): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed ? trimmed : null;
};

export const useCreateListingRequestAgreement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateListingRequestAgreementInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to create a project agreement.");
      }

      const { data, error } = await supabase.rpc(
        "create_listing_request_agreement",
        {
          p_listing_request_id: input.listingRequestId,
          p_status: input.status,
          p_payment_structure: input.paymentStructure,
          p_starting_payment_status: input.startingPaymentStatus,
          p_currency: input.currency.toLowerCase(),
          p_base_amount: input.baseAmount,
          p_total_amount: input.totalAmount,
          p_deposit_amount: input.depositAmount ?? null,
          p_estimated_start_at: input.estimatedStartAt ?? null,
          p_estimated_completion_at: input.estimatedCompletionAt,
          p_late_delivery_grace_days: input.lateDeliveryGraceDays,
          p_included_revision_count: input.includedRevisionCount,
          p_minimum_update_rule: input.minimumUpdateRule.rule,
          p_first_update_due_days: input.minimumUpdateRule.firstUpdateDueDays,
          p_update_frequency_days: input.minimumUpdateRule.updateFrequencyDays,
          p_scope_summary: input.scopeSummary.trim(),
          p_included_deliverables: input.includedDeliverables
            .map((deliverable) => deliverable.trim())
            .filter(Boolean),
          p_additional_cost_policy: input.additionalCostPolicy.trim(),
          p_revision_policy: cleanOptionalText(input.revisionPolicy),
          p_update_schedule_summary: cleanOptionalText(
            input.updateScheduleSummary
          ),
          p_items: input.items,
          p_payment_schedule_items: input.paymentScheduleItems,
        }
      );

      if (error) {
        throw error;
      }

      const createdAgreement = Array.isArray(data)
        ? (data[0] as CreatedAgreementRow | undefined)
        : undefined;

      if (!createdAgreement?.id) {
        throw new Error("The project agreement could not be created.");
      }

      return createdAgreement;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["listingRequestAgreements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["creatorRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyerRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationMessages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
      ]);
    },
  });
};