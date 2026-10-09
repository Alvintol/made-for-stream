import { useQuery } from "@tanstack/react-query";

import type {
  ListingRequestAgreementStatus,
  ListingRequestPaymentStructure,
  ListingRequestPaymentTiming,
  ListingRequestStartingPaymentStatus,
} from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestAgreementItemRow = {
  id: string;
  agreement_id: string;
  title: string;
  description: string | null;
  item_type:
    | "included"
    | "optional_addon"
    | "required_payment_item"
    | "milestone"
    | "buyer_provides"
    | "buyer_approves";
  price_amount: number | null;
  timeline_impact_days: number | null;
  payment_timing: ListingRequestPaymentTiming;
  is_required: boolean;
  is_selected: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ListingRequestPaymentScheduleItemRow = {
  id: string;
  agreement_id: string;
  agreement_item_id: string | null;
  change_order_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  payment_timing: Extract<
    ListingRequestPaymentTiming,
    | "due_before_work_starts"
    | "due_at_milestone_approval"
    | "due_before_final_release"
    | "due_on_change_order_acceptance"
  >;
  status:
  | "pending"
  | "payment_required"
  | "paid"
  | "waived"
  | "cancelled";
  due_at: string | null;
  paid_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ListingRequestTimelineHoldRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string | null;
  payment_schedule_item_id: string | null;
  reason:
  | "agreement_acceptance_pending"
  | "starting_payment_pending"
  | "milestone_approval_pending"
  | "milestone_payment_pending"
  | "change_order_response_pending"
  | "change_order_payment_pending"
  | "balance_payment_pending";
  started_at: string;
  ended_at: string | null;
  rounded_extension_days: number;
  created_at: string;
  updated_at: string;
};

export type ListingRequestAgreementAcknowledgementRow = {
  id: string;
  agreement_id: string;
  buyer_user_id: string;
  acknowledgement_key: string;
  acknowledgement_label: string;
  created_at: string;
};

export type ListingRequestAgreementRow = {
  id: string;
  listing_request_id: string;
  creator_user_id: string;
  buyer_user_id: string;
  version_number: number;
  status: ListingRequestAgreementStatus;
  payment_structure: ListingRequestPaymentStructure;
  starting_payment_status: ListingRequestStartingPaymentStatus;
  currency: string;
  base_amount: number;
  total_amount: number;
  deposit_amount: number | null;
  estimated_start_at: string | null;
  estimated_completion_at: string;
  adjusted_estimated_completion_at: string;
  late_delivery_grace_days: number;
  included_revision_count: number | null;
  minimum_update_rule: "single_progress_update" | "weekly_updates";
  first_update_due_days: number | null;
  update_frequency_days: number | null;
  scope_summary: string;
  included_deliverables: string[];
  additional_cost_policy: string;
  revision_policy: string | null;
  update_schedule_summary: string | null;
  last_progress_update_at: string | null;
  next_progress_update_due_at: string | null;
  progress_update_requirement_satisfied_at: string | null;
  sent_at: string | null;
  buyer_accepted_at: string | null;
  buyer_declined_at: string | null;
  superseded_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  listing_request_agreement_items: ListingRequestAgreementItemRow[];
  listing_request_payment_schedule_items: ListingRequestPaymentScheduleItemRow[];
  listing_request_timeline_holds: ListingRequestTimelineHoldRow[];
  listing_request_agreement_acknowledgements: ListingRequestAgreementAcknowledgementRow[];
};

export const useListingRequestAgreement = (listingRequestId?: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["listingRequestAgreements", listingRequestId],
    enabled: Boolean(user?.id && listingRequestId),
    queryFn: async () => {
      if (!user?.id || !listingRequestId) {
        return null;
      }

      const { data, error } = await supabase
        .from("listing_request_agreements")
        .select(
          `
          id,
          listing_request_id,
          creator_user_id,
          buyer_user_id,
          version_number,
          status,
          payment_structure,
          starting_payment_status,
          currency,
          base_amount,
          total_amount,
          deposit_amount,
          estimated_start_at,
          estimated_completion_at,
          adjusted_estimated_completion_at,
          late_delivery_grace_days,
          included_revision_count,
          minimum_update_rule,
          first_update_due_days,
          update_frequency_days,
          scope_summary,
          included_deliverables,
          additional_cost_policy,
          revision_policy,
          update_schedule_summary,
          last_progress_update_at,
          next_progress_update_due_at,
          progress_update_requirement_satisfied_at,
          sent_at,
          buyer_accepted_at,
          buyer_declined_at,
          superseded_at,
          cancelled_at,
          created_at,
          updated_at,
          listing_request_agreement_items (
            id,
            agreement_id,
            title,
            description,
            item_type,
            price_amount,
            timeline_impact_days,
            payment_timing,
            is_required,
            is_selected,
            sort_order,
            created_at,
            updated_at
          ),
         listing_request_payment_schedule_items (
            id,
            agreement_id,
            agreement_item_id,
            change_order_id,
            title,
            description,
            amount,
            currency,
            payment_timing,
            status,
            due_at,
            paid_at,
            sort_order,
            created_at,
            updated_at
          ),
          listing_request_timeline_holds (
            id,
            listing_request_id,
            agreement_id,
            payment_schedule_item_id,
            reason,
            started_at,
            ended_at,
            rounded_extension_days,
            created_at,
            updated_at
          ),
          listing_request_agreement_acknowledgements (
            id,
            agreement_id,
            buyer_user_id,
            acknowledgement_key,
            acknowledgement_label,
            created_at
          )
        `
        )
        .eq("listing_request_id", listingRequestId)
        .in("status", ["draft", "sent", "buyer_accepted"])
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as ListingRequestAgreementRow | null) ?? null;
    },
  });
};