import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateListingRequestFinalDelivery } from "../useCreateListingRequestFinalDelivery";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  bucket: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "creator-1" } }),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: {
      from: (bucket: string) => {
        mocks.bucket(bucket);
        return { upload: mocks.upload };
      },
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("a final delivery with uploaded files", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({
      data: [{ id: "final-delivery-1", listing_request_id: "request-1" }],
      error: null,
    });
    mocks.upload.mockReset().mockResolvedValue({ error: null });
    mocks.bucket.mockReset();
  });

  it("uploads each file into the agreement's folder, then saves them with the delivery", async () => {
    const progress = vi.fn();
    const { result } = renderHook(() => useCreateListingRequestFinalDelivery(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "submitted",
        title: "Final files",
        summary: "Everything is in the zip.",
        deliveryLinks: [],
        deliveryFiles: [
          new File(["zip"], "Emote Pack (final).zip", { type: "application/zip" }),
          new File(["psd"], "source.psd"),
        ],
        offSiteDelivery: { methods: ["discord"], other: null },
        onUploadProgress: progress,
      });
    });

    expect(mocks.bucket).toHaveBeenCalledWith("delivery-files");
    expect(mocks.upload).toHaveBeenCalledTimes(2);

    const [firstPath, , firstOptions] = mocks.upload.mock.calls[0];
    expect(firstPath).toMatch(/^agreement-1\/Emote_Pack_final_[0-9a-f]{12}\.zip$/);
    expect(firstOptions).toEqual({ contentType: "application/zip", upsert: false });
    expect(mocks.upload.mock.calls[1][2]).toEqual({
      contentType: "application/octet-stream",
      upsert: false,
    });

    expect(progress).toHaveBeenCalledWith("Uploading file 1 of 2: Emote Pack (final).zip…");
    expect(progress).toHaveBeenCalledWith("Uploading file 2 of 2: source.psd…");

    expect(mocks.rpc).toHaveBeenCalledWith("create_listing_request_final_delivery_v2", {
      p_agreement_id: "agreement-1",
      p_status: "submitted",
      p_title: "Final files",
      p_summary: "Everything is in the zip.",
      p_delivery_links: [],
      p_file_paths: [firstPath, mocks.upload.mock.calls[1][0]],
      p_off_site_methods: ["discord"],
      p_off_site_other: null,
    });
  });

  it("saves nothing when an upload fails", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "The object exceeded the maximum allowed size" } });
    const { result } = renderHook(() => useCreateListingRequestFinalDelivery(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          agreementId: "agreement-1",
          status: "submitted",
          title: "Final files",
          summary: "Everything is in the zip.",
          deliveryLinks: [],
          deliveryFiles: [new File(["big"], "big.mp4")],
        }),
      ).rejects.toMatchObject({ message: "The object exceeded the maximum allowed size" });
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
