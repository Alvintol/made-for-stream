import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  salesMonthToDate,
  type AdminChartRow,
  type AdminSaleRow,
  type AdminSalesSummary,
  type AdminTransactionRow,
  type CreatorChartRow,
  type CreatorSaleRow,
  type CreatorSalesTotals,
  type CreatorTransactionRow,
  type PaymentInvoice,
  type SalesChartData,
  type SalesChartQuery,
} from "../../domain/payments/sales";
import { toPageOfRows, type PageOfRows } from "../../lib/pageOfRows";
import { supabase } from "../../lib/supabaseClient";

export const SALES_PAGE_SIZE = 25;

type SaleCursor = { after_at: string; after_id: string };

type ListRpc = "my_completed_sales" | "admin_completed_sales" | "my_sales" | "admin_sales";

const saleCursor = (row: { completed_at: string; listing_request_id: string }): SaleCursor => ({
  after_at: row.completed_at,
  after_id: row.listing_request_id,
});

const transactionCursor = (row: { happened_at: string; movement_id: string }): SaleCursor => ({
  after_at: row.happened_at,
  after_id: row.movement_id,
});

const fetchSalesPage = async <Row>(
  rpc: ListRpc,
  month: string,
  cursor: SaleCursor | null,
  toCursor: (row: Row) => SaleCursor,
): Promise<PageOfRows<Row, SaleCursor>> => {
  const { data, error } = await supabase.rpc(rpc, {
    p_month: salesMonthToDate(month),
    p_after_at: cursor?.after_at ?? null,
    p_after_id: cursor?.after_id ?? null,
    p_limit: SALES_PAGE_SIZE,
  });

  if (error) throw error;

  return toPageOfRows((data ?? []) as Row[], SALES_PAGE_SIZE, toCursor);
};

const useSalesPages = <Row>(rpc: ListRpc, month: string, toCursor: (row: Row) => SaleCursor) =>
  useInfiniteQuery({
    queryKey: [rpc, month],
    queryFn: ({ pageParam }) => fetchSalesPage<Row>(rpc, month, pageParam, toCursor),
    initialPageParam: null as SaleCursor | null,
    getNextPageParam: (lastPage) => lastPage.next,
    placeholderData: keepPreviousData,
  });

// One read per period and kind chosen (20261103_184). The previous graph
// stays up while the next loads.
const useSalesChart = <Row>(rpc: "my_sales_chart" | "admin_sales_chart", query: SalesChartQuery) =>
  useQuery({
    queryKey: [rpc, query.from, query.to, query.kind],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SalesChartData<Row>> => {
      const { data, error } = await supabase.rpc(rpc, {
        p_from: query.from,
        p_to: query.to,
        p_kind: query.kind,
      });

      if (error) throw error;

      return data as SalesChartData<Row>;
    },
  });

// The signed-in creator's month, one row per currency. Read once per visit.
export const useMySalesSummary = (month: string) =>
  useQuery({
    queryKey: ["mySalesSummary", month],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CreatorSalesTotals[]> => {
      const { data, error } = await supabase.rpc("my_sales_summary", {
        p_month: salesMonthToDate(month),
      });

      if (error) throw error;

      return data as CreatorSalesTotals[];
    },
  });

export const useMyCompletedSales = (month: string) =>
  useSalesPages<CreatorSaleRow>("my_completed_sales", month, saleCursor);

export const useMyTransactions = (month: string) =>
  useSalesPages<CreatorTransactionRow>("my_sales", month, transactionCursor);

export const useMySalesChart = (query: SalesChartQuery) =>
  useSalesChart<CreatorChartRow>("my_sales_chart", query);

export const useAdminSalesSummary = (month: string) =>
  useQuery({
    queryKey: ["adminSalesSummary", month],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AdminSalesSummary> => {
      const { data, error } = await supabase.rpc("admin_sales_summary", {
        p_month: salesMonthToDate(month),
      });

      if (error) throw error;

      return data as AdminSalesSummary;
    },
  });

export const useAdminCompletedSales = (month: string) =>
  useSalesPages<AdminSaleRow>("admin_completed_sales", month, saleCursor);

export const useAdminTransactions = (month: string) =>
  useSalesPages<AdminTransactionRow>("admin_sales", month, transactionCursor);

export const useAdminSalesChart = (query: SalesChartQuery) =>
  useSalesChart<AdminChartRow>("admin_sales_chart", query);

export const usePaymentInvoice = (paymentId: string | undefined) =>
  useQuery({
    queryKey: ["paymentInvoice", paymentId],
    enabled: Boolean(paymentId),
    retry: false,
    queryFn: async (): Promise<PaymentInvoice> => {
      const { data, error } = await supabase.rpc("get_payment_invoice", {
        p_payment_id: paymentId,
      });

      if (error) throw error;

      return data as PaymentInvoice;
    },
  });
