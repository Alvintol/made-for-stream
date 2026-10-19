import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

export type OffSiteReceiptRow = {
  id: string;
  listing_request_id: string;
  // Set for a final delivery's receipt; empty for a milestone's.
  final_delivery_id: string | null;
  subject: string;
  methods: string[];
  other: string | null;
  status: "awaiting" | "received" | "not_received";
  sent_at: string;
  answered_at: string | null;
  admin_note: string | null;
};

const receiptsKey = (listingRequestId: string) => ["offSiteReceipts", listingRequestId];

// Work sent outside Made for Stream that the buyer still has to confirm
// (off_site_delivery_receipts, 20261016_166). Read once; refreshed when an
// answer is saved. There is no timer.
export const useOffSiteReceipts = (listingRequestId: string) =>
  useQuery({
    queryKey: receiptsKey(listingRequestId),
    enabled: Boolean(listingRequestId),
    queryFn: async (): Promise<OffSiteReceiptRow[]> => {
      const { data, error } = await supabase
        .from("off_site_delivery_receipts")
        .select("id, listing_request_id, final_delivery_id, subject, methods, other, status, sent_at, answered_at, admin_note")
        .eq("listing_request_id", listingRequestId)
        .order("sent_at", { ascending: true });

      if (error) throw error;

      return (data as OffSiteReceiptRow[] | null) ?? [];
    },
  });

const useRefreshAfterAnswer = (listingRequestId: string) => {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: receiptsKey(listingRequestId) }),
      queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
      queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
    ]);
};

// The buyer says whether the work arrived.
export const useRespondOffSiteReceipt = (listingRequestId: string) => {
  const refresh = useRefreshAfterAnswer(listingRequestId);

  return useMutation({
    mutationFn: async (input: { receiptId: string; received: boolean }) => {
      const { error } = await supabase.rpc("respond_off_site_delivery_receipt", {
        p_receipt_id: input.receiptId,
        p_received: input.received,
      });

      if (error) throw error;
    },
    onSuccess: refresh,
  });
};

// An administrator records the work as received, saying how they know.
export const useAdminRecordOffSiteReceipt = (listingRequestId: string) => {
  const refresh = useRefreshAfterAnswer(listingRequestId);

  return useMutation({
    mutationFn: async (input: { receiptId: string; note: string }) => {
      const { error } = await supabase.rpc("admin_record_off_site_receipt", {
        p_receipt_id: input.receiptId,
        p_note: input.note.trim(),
      });

      if (error) throw error;
    },
    onSuccess: refresh,
  });
};
