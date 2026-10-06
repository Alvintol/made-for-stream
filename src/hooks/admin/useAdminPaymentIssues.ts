import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";

// "Issue" here means a payment the charge.refunded / charge.dispute.*
// webhooks have recorded something against (launch-scope.md section 6,
// docs/support/payments/refunds-and-disputes.md). status is deliberately
// never written by those handlers -- a row surfaced here can still read
// "paid" even though Stripe has already refunded or disputed it. That gap
// is the reason this page exists: REF-002/REF-003's detection queries,
// as a real admin surface instead of a query run by hand.
export type AdminPaymentIssueRow = {
  id: string;
  listing_request_id: string;
  payment_type: string;
  status: string;
  currency: string;
  base_amount_cents: number;
  total_checkout_cents: number;
  payer_user_id: string;
  creator_user_id: string;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
  stripe_dispute_id: string | null;
  refunded_at: string | null;
  disputed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminPaymentIssueProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
};

export type AdminPaymentIssueRequest = {
  id: string;
  request_title: string | null;
  listing_snapshot: ListingRequestSnapshot;
};

export type AdminPaymentIssueItem = {
  payment: AdminPaymentIssueRow;
  request: AdminPaymentIssueRequest | null;
  buyer: AdminPaymentIssueProfile | null;
  creator: AdminPaymentIssueProfile | null;
};

export type AdminPaymentIssuesFilters = {
  type: "all" | "disputed" | "refunded";
};

export type AdminPaymentIssuesResult = {
  items: AdminPaymentIssueItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type UseAdminPaymentIssuesInput = {
  filters: AdminPaymentIssuesFilters;
  page: number;
  pageSize?: number;
};

const fetchAdminPaymentIssues = async (
  input: UseAdminPaymentIssuesInput
): Promise<AdminPaymentIssuesResult> => {
  const { filters, page, pageSize = 20 } = input;

  let query = supabase
    .from("listing_request_payments")
    .select(
      `
        id,
        listing_request_id,
        payment_type,
        status,
        currency,
        base_amount_cents,
        total_checkout_cents,
        payer_user_id,
        creator_user_id,
        stripe_charge_id,
        stripe_refund_id,
        stripe_dispute_id,
        refunded_at,
        disputed_at,
        created_at,
        updated_at
      `,
      { count: "exact" }
    )
    .order("updated_at", { ascending: false });

  if (filters.type === "disputed") {
    query = query.not("stripe_dispute_id", "is", null);
  } else if (filters.type === "refunded") {
    query = query.not("stripe_refund_id", "is", null);
  } else {
    query = query.or("stripe_dispute_id.not.is.null,stripe_refund_id.not.is.null");
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: payments, error: paymentsError, count } = await query.range(
    from,
    to
  );

  if (paymentsError) {
    throw paymentsError;
  }

  const paymentRows = (payments ?? []) as AdminPaymentIssueRow[];

  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (paymentRows.length === 0) {
    return { items: [], totalCount, page, pageSize, pageCount };
  }

  const requestIds = Array.from(
    new Set(paymentRows.map((row) => row.listing_request_id))
  );

  const userIds = Array.from(
    new Set(
      paymentRows.flatMap((row) => [row.payer_user_id, row.creator_user_id])
    )
  );

  const [{ data: requests, error: requestsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase
        .from("listing_requests")
        .select("id, request_title, listing_snapshot")
        .in("id", requestIds),
      supabase
        .from("profiles")
        .select("user_id, handle, display_name")
        .in("user_id", userIds),
    ]);

  if (requestsError) {
    throw requestsError;
  }

  if (profilesError) {
    throw profilesError;
  }

  const requestById = Object.fromEntries(
    ((requests ?? []) as AdminPaymentIssueRequest[]).map((request) => [
      request.id,
      request,
    ])
  ) as Record<string, AdminPaymentIssueRequest>;

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as AdminPaymentIssueProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminPaymentIssueProfile>;

  return {
    items: paymentRows.map((payment) => ({
      payment,
      request: requestById[payment.listing_request_id] ?? null,
      buyer: profileByUserId[payment.payer_user_id] ?? null,
      creator: profileByUserId[payment.creator_user_id] ?? null,
    })),
    totalCount,
    page,
    pageSize,
    pageCount,
  };
};

export const useAdminPaymentIssues = (input: UseAdminPaymentIssuesInput) =>
  useQuery<AdminPaymentIssuesResult>({
    queryKey: ["adminPaymentIssues", input],
    queryFn: () => fetchAdminPaymentIssues(input),
    staleTime: 15_000,
  });
