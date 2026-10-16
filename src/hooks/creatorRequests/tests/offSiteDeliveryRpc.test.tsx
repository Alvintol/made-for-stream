import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateListingRequestFinalDelivery } from "../useCreateListingRequestFinalDelivery";
import { useSubmitListingRequestMilestone } from "../useSubmitListingRequestMilestone";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "creator-1" } }),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: { rpc: mocks.rpc },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

// The statement must be saved in the same step as the submission, which
// only the "_off_site" functions do (migration 20261013_162).
describe("saving a delivery that was also sent off site", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("submits a milestone through the function that records it", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          submission_id: "submission-1",
          milestone_id: "milestone-1",
          listing_request_id: "request-1",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useSubmitListingRequestMilestone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        milestoneId: "milestone-1",
        summary: "The sketches are ready for review.",
        deliveryLinks: [],
        offSiteDelivery: { methods: ["email", "other"], other: "WeTransfer" },
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith("submit_listing_request_milestone_off_site", {
      p_milestone_id: "milestone-1",
      p_summary: "The sketches are ready for review.",
      p_delivery_links: [],
      p_preview_image_paths: [],
      p_off_site_methods: ["email", "other"],
      p_off_site_other: "WeTransfer",
    });
  });

  it("creates a final delivery through the function that records it", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: "final-delivery-1", listing_request_id: "request-1" }],
      error: null,
    });

    const { result } = renderHook(() => useCreateListingRequestFinalDelivery(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Final files",
        summary: "Everything is in the folder.",
        deliveryLinks: [],
        offSiteDelivery: { methods: ["discord"], other: null },
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_listing_request_final_delivery_off_site", {
      p_agreement_id: "agreement-1",
      p_status: "draft",
      p_title: "Final files",
      p_summary: "Everything is in the folder.",
      p_delivery_links: [],
      p_off_site_methods: ["discord"],
      p_off_site_other: null,
    });
  });
});
