import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  TaxReportObligation,
  TaxReportRegime,
  TaxReportSellerRow,
} from "../../domain/payments/taxReporting";
import { supabase } from "../../lib/supabaseClient";

export type AdminTaxReportingOverview = {
  today: string;
  obligations: TaxReportObligation[];
};

// The tax calendar for the admin Tax reporting page
// (admin_get_tax_reporting_overview, 20261028_170). Read once per visit;
// there is no timer.
export const useAdminTaxReportingOverview = () =>
  useQuery({
    queryKey: ["adminTaxReportingOverview"],
    queryFn: async (): Promise<AdminTaxReportingOverview> => {
      const { data, error } = await supabase.rpc("admin_get_tax_reporting_overview");

      if (error) throw error;

      return data as AdminTaxReportingOverview;
    },
  });

type ReportPeriod = { regime: TaxReportRegime; period_start: string; period_end: string };

// One report's creators with their private account details. Only fetched
// when the admin opens that report.
export const useAdminTaxReportSellers = (report: ReportPeriod | null) =>
  useQuery({
    queryKey: ["adminTaxReportSellers", report?.regime, report?.period_start, report?.period_end],
    enabled: report !== null && report.regime !== "ca_gst",
    queryFn: async (): Promise<TaxReportSellerRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_tax_report_sellers", {
        p_regime: report?.regime,
        p_period_start: report?.period_start,
        p_period_end: report?.period_end,
      });

      if (error) throw error;

      return data as TaxReportSellerRow[];
    },
  });

type SetFiledInput = {
  regime: TaxReportRegime;
  periodStart: string;
  filed: boolean;
  reference?: string;
};

// Marks a report filed (stopping its reminders) or takes the mark off.
export const useAdminSetTaxReportFiled = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ regime, periodStart, filed, reference }: SetFiledInput) => {
      const { error } = await supabase.rpc("admin_set_tax_report_filed", {
        p_regime: regime,
        p_period_start: periodStart,
        p_filed: filed,
        p_reference: reference ?? null,
      });

      if (error) {
        throw new Error(error.message || "The report could not be updated.");
      }
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminTaxReportingOverview"] });
    },
  });
};
