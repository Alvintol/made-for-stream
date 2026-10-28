import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PolicyAcceptanceInput,
  PolicyAcceptanceRecord,
  PolicyType,
} from "../../domain/legal/policyAcceptance";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type RecordPolicyAcceptancesInput = {
  userId: string;
  policies: PolicyAcceptanceInput[];
  relatedListingRequestId?: string | null;
};

export const policyAcceptancesQueryKey = (userId: string | null) => [
  "policyAcceptances",
  userId,
];

// Records one row per accepted policy in a single insert, so a set of
// acceptances lands together or not at all. accepted_at is left to the
// database default; the client never supplies its own timestamp.
export const recordPolicyAcceptances = async (
  input: RecordPolicyAcceptancesInput,
): Promise<void> => {
  const { userId, policies, relatedListingRequestId = null } = input;

  if (policies.length === 0) return;

  const rows = policies.map((policy) => ({
    user_id: userId,
    policy_type: policy.policyType,
    policy_version: policy.policyVersion,
    related_listing_request_id: relatedListingRequestId,
  }));

  const { error } = await supabase.from("policy_acceptances").insert(rows);

  if (error) throw error;
};

// Logs a failed acceptance write without user ids, emails or row details.
// Supabase puts key values in `details`, so only the code and message go out.
export const logPolicyAcceptanceFailure = (
  context: string,
  error: unknown,
): void => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "unknown";
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "unknown error";

  console.warn(`[policy_acceptances] ${context} failed (${code}): ${message}`);
};

// The user's acceptances of the given policies, whatever request they were
// tied to.
export const fetchPolicyAcceptances = async (
  userId: string,
  policyTypes: PolicyType[],
): Promise<PolicyAcceptanceRecord[]> => {
  const { data, error } = await supabase
    .from("policy_acceptances")
    .select("policy_type, policy_version, related_listing_request_id, accepted_at")
    .eq("user_id", userId)
    .in("policy_type", policyTypes);

  if (error) throw error;

  return (data as PolicyAcceptanceRecord[] | null) ?? [];
};

type UsePolicyAcceptancesOptions = {
  policyTypes: PolicyType[];
  relatedListingRequestId?: string | null;
  enabled?: boolean;
};

// The signed-in user's acceptances for the given policies. When a listing
// request id is given, only acceptances tied to that request count.
export const usePolicyAcceptances = (options: UsePolicyAcceptancesOptions) => {
  const { policyTypes, relatedListingRequestId = null, enabled = true } = options;
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<PolicyAcceptanceRecord[]>({
    queryKey: [
      ...policyAcceptancesQueryKey(userId),
      [...policyTypes].sort().join(","),
      relatedListingRequestId,
    ],
    enabled: enabled && Boolean(userId) && policyTypes.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("policy_acceptances")
        .select("policy_type, policy_version, related_listing_request_id, accepted_at")
        .eq("user_id", userId)
        .in("policy_type", policyTypes);

      if (relatedListingRequestId) {
        query = query.eq("related_listing_request_id", relatedListingRequestId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data as PolicyAcceptanceRecord[] | null) ?? [];
    },
  });
};

type RecordMutationInput = Omit<RecordPolicyAcceptancesInput, "userId">;

export const useRecordPolicyAcceptances = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useMutation({
    mutationKey: ["recordPolicyAcceptances", userId],
    mutationFn: async (input: RecordMutationInput) => {
      if (!userId) {
        throw new Error("You must be signed in to accept a policy.");
      }

      await recordPolicyAcceptances({ ...input, userId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: policyAcceptancesQueryKey(userId),
      });
    },
  });
};
