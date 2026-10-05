import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { SellerApplicationStatus } from "./useMySellerApplication";

type ReviewSellerApplicationInput = {
  applicationId: string;
  status: Extract<
    SellerApplicationStatus,
    "under_review" | "approved" | "rejected" | "needs_changes" | "suspended"
  >;
  reviewerNotes?: string;
  rejectionReason?: string;
};

const reviewSellerApplication = async (
  adminUserId: string,
  input: ReviewSellerApplicationInput
) => {
  const now = new Date().toISOString();

  const patch = {
    status: input.status,
    reviewer_notes: input.reviewerNotes?.trim() || null,
    rejection_reason: input.rejectionReason?.trim() || null,
    reviewed_at: now,
    reviewed_by: adminUserId,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("seller_applications")
    .update(patch)
    .eq("id", input.applicationId)
    .select(`
      id,
      profile_user_id,
      status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      reviewer_notes,
      rejection_reason,
      created_at,
      updated_at
    `)
    .single();

  if (error) throw error;

  return data;
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

// The decision above is a database fact. Telling the applicant is a
// best-effort follow-up, the same pattern as listingRequestNoticeEmail.ts:
// the API reads the decision itself, sends one email per decision, and a
// failure here never undoes the review (playbook APP-006).
const sendDecisionEmail = async (applicationId: string): Promise<void> => {
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) return;

    await fetch(
      `${getApiBase()}/api/creator-applications/${applicationId}/send-decision-email`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch {
    // Best-effort -- see the comment above.
  }
};

export const useReviewSellerApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReviewSellerApplicationInput) => {
      if (!user?.id) throw new Error("You must be signed in.");

      const application = await reviewSellerApplication(user.id, input);
      await sendDecisionEmail(input.applicationId);

      return application;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["adminSellerApplications"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["mySellerApplication"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminSellerApplicationSamples", variables.applicationId],
        }),
      ]);
    },
  });
};