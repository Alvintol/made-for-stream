import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useSubmitListingRequestMilestone } from "../useSubmitListingRequestMilestone";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
}));

vi.mock(
  "../../../providers/AuthProvider",
  () => ({
    useAuth: mocks.useAuth,
  })
);

vi.mock(
  "../../../lib/supabaseClient",
  () => ({
    supabase: {
      rpc: mocks.rpc,
      storage: {
        from: () => ({ upload: mocks.upload }),
      },
    },
  })
);

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

  const invalidateSpy = vi.spyOn(
    queryClient,
    "invalidateQueries"
  );

  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe(
  "useSubmitListingRequestMilestone",
  () => {
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
            submission_id:
              "milestone-submission-1",
            milestone_id: "milestone-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            status: "submitted",
            version_number: 1,
            submitted_at:
              "2026-06-16T12:00:00.000Z",
          },
        ],
        error: null,
      });
    });

    it(
      "submits a milestone through the creator RPC",
      async () => {
        const { wrapper, invalidateSpy } =
          createWrapper();

        const { result } = renderHook(
          () =>
            useSubmitListingRequestMilestone(),
          {
            wrapper,
          }
        );

        await act(async () => {
          await result.current.mutateAsync({
            milestoneId: "milestone-1",
            summary:
              " The initial design concepts are ready for buyer review. ",
            deliveryLinks: [
              " https://example.com/concepts ",
              "",
              "https://example.com/source-files",
            ],
          });
        });

        expect(mocks.rpc).toHaveBeenCalledWith(
          "submit_listing_request_milestone",
          {
            p_milestone_id: "milestone-1",
            p_summary:
              "The initial design concepts are ready for buyer review.",
            p_delivery_links: [
              "https://example.com/concepts",
              "https://example.com/source-files",
            ],
          }
        );

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "listingRequestMilestones",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "listingRequestMilestoneSubmissions",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "listingRequestAgreements",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "creatorRequest",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "buyerRequest",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "adminRequest",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "conversationMessages",
          ],
        });
      }
    );

    it(
      "uploads preview images into the milestone's folder, then names them in the RPC",
      async () => {
        mocks.upload.mockResolvedValue({ error: null });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useSubmitListingRequestMilestone(),
          {
            wrapper,
          }
        );

        const blob = new Blob(["prepared"], {
          type: "image/webp",
        });

        await act(async () => {
          await result.current.mutateAsync({
            milestoneId: "milestone-1",
            summary:
              "The initial design concepts are ready.",
            deliveryLinks: [],
            previewImages: [blob],
          });
        });

        expect(mocks.upload).toHaveBeenCalledWith(
          expect.stringMatching(
            /^milestone-1\/[0-9a-f-]+\.webp$/
          ),
          blob,
          { contentType: "image/webp" }
        );

        expect(mocks.rpc).toHaveBeenCalledWith(
          "submit_listing_request_milestone",
          expect.objectContaining({
            p_preview_image_paths: [
              mocks.upload.mock.calls[0][0],
            ],
          })
        );
      }
    );

    it(
      "does not save the submission when a preview image fails to upload",
      async () => {
        mocks.upload.mockResolvedValue({
          error: new Error(
            "new row violates row-level security policy"
          ),
        });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useSubmitListingRequestMilestone(),
          {
            wrapper,
          }
        );

        await expect(
          result.current.mutateAsync({
            milestoneId: "milestone-1",
            summary:
              "The initial design concepts are ready.",
            deliveryLinks: [],
            previewImages: [
              new Blob(["prepared"], {
                type: "image/webp",
              }),
            ],
          })
        ).rejects.toThrow("row-level security");

        expect(mocks.rpc).not.toHaveBeenCalled();
      }
    );

    it("throws while signed out", async () => {
      mocks.useAuth.mockReturnValue({
        user: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useSubmitListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          milestoneId: "milestone-1",
          summary:
            "The initial design concepts are ready.",
          deliveryLinks: [],
        })
      ).rejects.toThrow(
        "You must be signed in to submit a milestone."
      );

      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("surfaces RPC errors", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: new Error(
          "Earlier milestones must be completed before this milestone can be submitted."
        ),
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useSubmitListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          milestoneId: "milestone-2",
          summary:
            "The completed project files are ready.",
          deliveryLinks: [],
        })
      ).rejects.toThrow(
        "Earlier milestones must be completed before this milestone can be submitted."
      );
    });

    it(
      "throws when the RPC returns no submission",
      async () => {
        mocks.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useSubmitListingRequestMilestone(),
          {
            wrapper,
          }
        );

        await expect(
          result.current.mutateAsync({
            milestoneId: "milestone-1",
            summary:
              "The initial design concepts are ready.",
            deliveryLinks: [],
          })
        ).rejects.toThrow(
          "The milestone submission could not be saved."
        );
      }
    );
  }
);