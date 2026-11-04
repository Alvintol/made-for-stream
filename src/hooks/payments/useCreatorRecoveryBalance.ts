import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type CreatorRecoveryBalance = {
  creator_user_id: string;
  currency: string;
  outstanding_cents: number;
  created_at: string;
  updated_at: string;
};

export type CreatorRecoveryEntry = {
  id: string;
  creator_user_id: string;
  entry_type: "debit" | "credit" | "write_off";
  amount_cents: number;
  currency: string;
  reason: string;
  related_refund_id: string | null;
  related_payment_id: string | null;
  actor_user_id: string | null;
  created_at: string;
};

// RLS (20260922_127) lets a creator read their own row and an admin read
// any. Passing creatorUserId lets the admin surface reuse this for a
// specific creator; omitting it reads the signed-in user's own balance.
export const useCreatorRecoveryBalance = (creatorUserId?: string | null) => {
  const { user } = useAuth();
  const targetUserId = creatorUserId ?? user?.id ?? null;

  return useQuery({
    queryKey: ["creatorRecoveryBalance", targetUserId],
    enabled: Boolean(targetUserId),
    queryFn: async (): Promise<CreatorRecoveryBalance | null> => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from("creator_recovery_balances")
        .select("creator_user_id, currency, outstanding_cents, created_at, updated_at")
        .eq("creator_user_id", targetUserId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as CreatorRecoveryBalance | null) ?? null;
    },
  });
};

export const RECOVERY_HISTORY_LIMIT = 20;

export const useCreatorRecoveryEntries = (creatorUserId?: string | null) => {
  const { user } = useAuth();
  const targetUserId = creatorUserId ?? user?.id ?? null;

  return useQuery({
    queryKey: ["creatorRecoveryEntries", targetUserId],
    enabled: Boolean(targetUserId),
    queryFn: async (): Promise<CreatorRecoveryEntry[]> => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
        .from("creator_recovery_entries")
        .select(
          "id, creator_user_id, entry_type, amount_cents, currency, reason, related_refund_id, related_payment_id, actor_user_id, created_at",
        )
        .eq("creator_user_id", targetUserId)
        .order("created_at", { ascending: false })
        // ponytail: the latest entries only, under a balance the database
        // totals; add "Load more" if creators need the older ones here.
        .limit(RECOVERY_HISTORY_LIMIT);

      if (error) {
        throw error;
      }

      return (data as CreatorRecoveryEntry[] | null) ?? [];
    },
  });
};
