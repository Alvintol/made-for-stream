import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  moderationReportReasonOptions,
  type ModerationReportReasonCode,
} from "../../../domain/moderation/moderationReports";
import { useSubmitListingModerationReport } from "../useSubmitListingModerationReport";
import { useSubmitProfileModerationReport } from "../useSubmitProfileModerationReport";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

const testReasonCode =
  moderationReportReasonOptions[0]?.value as ModerationReportReasonCode;

const createRpcSuccess = <Data,>(data: Data) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: "OK",
});

const createRpcFailure = (message: string) => ({
  data: null,
  error: {
    message,
  },
  count: null,
  status: 400,
  statusText: "Bad Commission",
});

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

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("report submission hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.rpc.mockResolvedValue(createRpcSuccess("report-1"));
  });

  it("submits a listing moderation report through the listing RPC", async () => {
    const { result } = renderHook(() => useSubmitListingModerationReport(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      listingId: "listing-1",
      reasonCode: testReasonCode,
      reasonDetails: "This listing appears misleading.",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_listing_moderation_report",
      {
        p_listing_id: "listing-1",
        p_reason_code: testReasonCode,
        p_reason_details: "This listing appears misleading.",
      }
    );
  });

  it("normalises blank listing report details to null", async () => {
    const { result } = renderHook(() => useSubmitListingModerationReport(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      listingId: "listing-1",
      reasonCode: testReasonCode,
      reasonDetails: "   ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_listing_moderation_report",
      {
        p_listing_id: "listing-1",
        p_reason_code: testReasonCode,
        p_reason_details: null,
      }
    );
  });

  it("submits a profile moderation report through the profile RPC", async () => {
    const { result } = renderHook(() => useSubmitProfileModerationReport(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      profileUserId: "creator-1",
      reasonCode: testReasonCode,
      reasonDetails: "This profile appears misleading.",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_profile_moderation_report",
      {
        p_profile_user_id: "creator-1",
        p_reason_code: testReasonCode,
        p_reason_details: "This profile appears misleading.",
      }
    );
  });

  it("normalises blank profile report details to null", async () => {
    const { result } = renderHook(() => useSubmitProfileModerationReport(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      profileUserId: "creator-1",
      reasonCode: testReasonCode,
      reasonDetails: "",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_profile_moderation_report",
      {
        p_profile_user_id: "creator-1",
        p_reason_code: testReasonCode,
        p_reason_details: null,
      }
    );
  });

  it("throws the Supabase error message for listing report failures", async () => {
    mocks.rpc.mockResolvedValueOnce(
      createRpcFailure("You already have an active report for this listing.")
    );

    const { result } = renderHook(() => useSubmitListingModerationReport(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-1",
        reasonCode: testReasonCode,
        reasonDetails: "Duplicate report.",
      })
    ).rejects.toThrow("You already have an active report for this listing.");
  });

  it("throws the Supabase error message for profile report failures", async () => {
    mocks.rpc.mockResolvedValueOnce(
      createRpcFailure("You already have an active report for this profile.")
    );

    const { result } = renderHook(() => useSubmitProfileModerationReport(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        profileUserId: "creator-1",
        reasonCode: testReasonCode,
        reasonDetails: "Duplicate report.",
      })
    ).rejects.toThrow("You already have an active report for this profile.");
  });
});