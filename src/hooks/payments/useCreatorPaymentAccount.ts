import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type CreatorPaymentAccountRow = {
  id: string;
  user_id: string;
  provider: "stripe";
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due_count: number;
  country: string;
  default_currency: string;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export const getCreatorPaymentAccountStatusLabel = (
  account?: Pick<
    CreatorPaymentAccountRow,
    "charges_enabled" | "payouts_enabled" | "details_submitted"
  > | null,
): string => {
  if (!account) {
    return "Not connected";
  }

  if (
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled
  ) {
    return "Ready for payouts";
  }

  if (!account.details_submitted) {
    return "Onboarding incomplete";
  }

  return "Stripe review pending";
};

export const getCreatorPaymentAccountIsReady = (
  account?: Pick<
    CreatorPaymentAccountRow,
    "charges_enabled" | "payouts_enabled" | "details_submitted"
  > | null,
): boolean =>
  Boolean(
    account?.details_submitted &&
      account.charges_enabled &&
      account.payouts_enabled,
  );

export type CreatorPayoutSetupState =
  | "not_started"
  | "needs_information"
  | "verifying"
  | "ready";

// What the creator should be told. requirements_due_count counts only what
// the creator must supply (api/connectAccountState.js), so an account that
// is not ready with nothing due is waiting on Stripe's own checks.
export const getCreatorPayoutSetupState = (
  account?: Pick<
    CreatorPaymentAccountRow,
    | "charges_enabled"
    | "payouts_enabled"
    | "details_submitted"
    | "requirements_due_count"
  > | null,
): CreatorPayoutSetupState => {
  if (!account) {
    return "not_started";
  }

  if (getCreatorPaymentAccountIsReady(account)) {
    return "ready";
  }

  return account.requirements_due_count > 0 ? "needs_information" : "verifying";
};

const fetchCreatorPaymentAccount = async (
  userId: string,
): Promise<CreatorPaymentAccountRow | null> => {
  const { data, error } = await supabase
    .from("creator_payment_accounts")
    .select(
      `
      id,
      user_id,
      provider,
      stripe_account_id,
      charges_enabled,
      payouts_enabled,
      details_submitted,
      requirements_due_count,
      country,
      default_currency,
      onboarding_started_at,
      onboarding_completed_at,
      last_synced_at,
      created_at,
      updated_at
    `,
    )
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CreatorPaymentAccountRow | null;
};

export const useCreatorPaymentAccount = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["creatorPaymentAccount", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 30_000,
    queryFn: () =>
      userId ? fetchCreatorPaymentAccount(userId) : Promise.resolve(null),
  });
};