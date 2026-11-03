import type { AdminChartRow } from "../../domain/payments/sales";
import { useAdminSalesChart } from "../../hooks/payments/useSales";
import SalesChart, { type SalesChartMetric, type SalesChartText } from "./SalesChart";

const METRICS: SalesChartMetric<AdminChartRow>[] = [
  { id: "earnings", label: "Total earnings", value: (row) => row.earned_cents, format: "money" },
  {
    id: "completed",
    label: "Completed",
    value: (row) => row.sales,
    format: "count",
    note: (row) => `Commissions: ${row.sales - row.instant_sales} · Downloads: ${row.instant_sales}`,
  },
  {
    id: "transactions",
    label: "Transactions",
    value: (row) => row.paid_cents,
    format: "money",
    note: (row) => `${row.transactions} payment${row.transactions === 1 ? "" : "s"}`,
  },
  { id: "kept", label: "Fees and support", value: (row) => row.kept_cents, format: "money" },
  { id: "tax", label: "Tax to set aside", value: (row) => row.tax_cents, format: "money" },
];

// Admin pages stay in English.
const TEXT: SalesChartText = {
  title: "Over time",
  show: "Show",
  kinds: { all: "Everything", request: "Commissions", instant: "Instant downloads" },
  period: "Period",
  presets: {
    "7": "Last 7 days",
    "28": "Last 28 days",
    "90": "Last 90 days",
    "12m": "Last 12 months",
    year: "By year",
    custom: "Custom dates",
  },
  year: "Year",
  from: "From",
  to: "To",
  apply: "Show",
  rangeInvalid: "Choose a start date on or before the end date.",
  rangeTooLong: "Choose up to two years.",
  currency: "Currency",
  loading: "Loading…",
  empty: "No sales or transactions in this period.",
  failed: "Sales could not be loaded.",
  table: "Show as a table",
  date: "Date",
};

// The whole site's numbers over time, at the bottom of the admin dashboard.
const AdminSalesChart = () => <SalesChart useChart={useAdminSalesChart} metrics={METRICS} text={TEXT} />;

export default AdminSalesChart;
