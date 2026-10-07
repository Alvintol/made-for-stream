import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateListingRequestAgreement } from "../useCreateListingRequestAgreement";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe("useCreateListingRequestAgreement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "agreement-1",
          status: "sent",
          version_number: 1,
        },
      ],
      error: null,
    });
  });

  it("creates a project agreement through the focused RPC", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useCreateListingRequestAgreement(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingRequestId: "request-1",
        status: "sent",
        paymentStructure: "deposit_balance",
        startingPaymentStatus: "payment_required",
        currency: "CAD",
        baseAmount: 200,
        totalAmount: 250,
        depositAmount: 100,
        estimatedStartAt: "2026-06-01T12:00:00.000Z",
        estimatedCompletionAt: "2026-06-15T12:00:00.000Z",
        lateDeliveryGraceDays: 7,
        includedRevisionCount: 2,
        minimumUpdateRule: {
          rule: "weekly_updates",
          label: "Weekly updates required",
          summary:
            "This project is estimated at one week or longer, so the creator must provide weekly progress updates until delivery.",
          firstUpdateDueDays: 5,
          updateFrequencyDays: 7,
          recommendedCheckpoints: [
            "First update within 5 days",
            "Weekly progress update",
          ],
        },
        scopeSummary: "Create a custom overlay package for the buyer.",
        includedDeliverables: ["Starting soon screen", "BRB screen"],
        additionalCostPolicy:
          "Additional animated screens require an accepted change order.",
        revisionPolicy: "Includes two revision passes.",
        updateScheduleSummary:
          "First update within 5 days, then weekly until delivery.",
        items: [
          {
            title: "Starting soon screen",
            description: "Static starting soon scene.",
            item_type: "included",
            price_amount: 0,
            timeline_impact_days: 0,
            payment_timing: "included_no_extra_charge",
            is_required: true,
            is_selected: true,
            sort_order: 0,
          },
        ],
        paymentScheduleItems: [
          {
            title: "Deposit",
            description: "Required before work starts.",
            amount: 100,
            currency: "cad",
            payment_timing: "due_before_work_starts",
            status: "payment_required",
            due_at: null,
            sort_order: 0,
          },
        ],
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_listing_request_agreement", {
      p_listing_request_id: "request-1",
      p_status: "sent",
      p_payment_structure: "deposit_balance",
      p_starting_payment_status: "payment_required",
      p_currency: "cad",
      p_base_amount: 200,
      p_total_amount: 250,
      p_deposit_amount: 100,
      p_estimated_start_at: "2026-06-01T12:00:00.000Z",
      p_estimated_completion_at: "2026-06-15T12:00:00.000Z",
      p_late_delivery_grace_days: 7,
      p_included_revision_count: 2,
      p_minimum_update_rule: "weekly_updates",
      p_first_update_due_days: 5,
      p_update_frequency_days: 7,
      p_scope_summary: "Create a custom overlay package for the buyer.",
      p_included_deliverables: ["Starting soon screen", "BRB screen"],
      p_additional_cost_policy:
        "Additional animated screens require an accepted change order.",
      p_revision_policy: "Includes two revision passes.",
      p_update_schedule_summary:
        "First update within 5 days, then weekly until delivery.",
      p_items: [
        {
          title: "Starting soon screen",
          description: "Static starting soon scene.",
          item_type: "included",
          price_amount: 0,
          timeline_impact_days: 0,
          payment_timing: "included_no_extra_charge",
          is_required: true,
          is_selected: true,
          sort_order: 0,
        },
      ],
      p_payment_schedule_items: [
        {
          title: "Deposit",
          description: "Required before work starts.",
          amount: 100,
          currency: "cad",
          payment_timing: "due_before_work_starts",
          status: "payment_required",
          due_at: null,
          sort_order: 0,
        },
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestAgreements"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest"],
    });
  });

  it("throws when the creator is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateListingRequestAgreement(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        listingRequestId: "request-1",
        status: "draft",
        paymentStructure: "full_prepayment",
        startingPaymentStatus: "payment_required",
        currency: "cad",
        baseAmount: 100,
        totalAmount: 100,
        depositAmount: null,
        estimatedStartAt: null,
        estimatedCompletionAt: "2026-06-15T12:00:00.000Z",
        lateDeliveryGraceDays: 7,
        includedRevisionCount: 1,
        minimumUpdateRule: {
          rule: "weekly_updates",
          label: "Weekly updates required",
          summary: "Weekly updates required.",
          firstUpdateDueDays: 5,
          updateFrequencyDays: 7,
          recommendedCheckpoints: [],
        },
        scopeSummary: "Create a custom commission.",
        includedDeliverables: ["Deliverable"],
        additionalCostPolicy: "Additional costs require a change order.",
        items: [],
        paymentScheduleItems: [],
      })
    ).rejects.toThrow("You must be signed in to create a project agreement.");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns no agreement", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateListingRequestAgreement(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        listingRequestId: "request-1",
        status: "draft",
        paymentStructure: "full_prepayment",
        startingPaymentStatus: "payment_required",
        currency: "cad",
        baseAmount: 100,
        totalAmount: 100,
        depositAmount: null,
        estimatedStartAt: null,
        estimatedCompletionAt: "2026-06-15T12:00:00.000Z",
        lateDeliveryGraceDays: 7,
        includedRevisionCount: 1,
        minimumUpdateRule: {
          rule: "weekly_updates",
          label: "Weekly updates required",
          summary: "Weekly updates required.",
          firstUpdateDueDays: 5,
          updateFrequencyDays: 7,
          recommendedCheckpoints: [],
        },
        scopeSummary: "Create a custom commission.",
        includedDeliverables: ["Deliverable"],
        additionalCostPolicy: "Additional costs require a change order.",
        items: [],
        paymentScheduleItems: [],
      })
    ).rejects.toThrow("The project agreement could not be created.");
  });
});