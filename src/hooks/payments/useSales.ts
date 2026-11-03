import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  salesMonthToDate,
  type AdminSaleRow,
  type AdminSalesSummary,
  type CreatorSaleRow,
  type CreatorSalesTotals,
  type PaymentInvoice,
} from "../../domain/payments/sales";
import { toPageOfRows, type PageOfRows } from "../../lib/pageOfRows";
import { supabase } from "../../lib/supabaseClient";

export const SALES_PAGE_SIZE = 25;

type SaleCursor = { after_at: string; after_id: string };

type SaleRow = { happened_at: string; movement_id: string };

const fetchSalesPage = async <Row extends SaleRow>(
  rpc: "my_sales" | "admin_sales",
  month: string,
  cursor: SaleCursor | null,
): Promise<PageOfRows<Row, SaleCursor>> => {
  const { data, error } = await supabase.rpc(rpc, {
    p_month: salesMonthToDate(month),
    p_after_at: cursor?.after_at ?? null,
    p_after_id: cursor?.after_id ?? null,
    p_limit: SALES_PAGE_SIZE,
  });

  if (error) throw error;

  return toPageOfRows((data ?? []) as Row[], SALES_PAGE_SIZE, (lastRow) => ({
    after_at: lastRow.happened_at,
    after_id: lastRow.movement_id,
  }));
};

const useSalesPages = <Row extends SaleRow>(rpc: "my_sales" | "admin_sales", month: string) =>
  useInfiniteQuery({
    queryKey: [rpc, month],
    queryFn: ({ pageParam }) => fetchSalesPage<Row>(rpc, month, pageParam),
    initialPageParam: null as SaleCursor | null,
    getNextPageParam: (lastPage) => lastPage.next,
    placeholderData: keepPreviousData,
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

export const useMySales = (month: string) => useSalesPages<CreatorSaleRow>("my_sales", month);

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

export const useAdminSales = (month: string) => useSalesPages<AdminSaleRow>("admin_sales", month);

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
