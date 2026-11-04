import type { CreatorChartRow } from "../../domain/payments/sales";
import { useMySalesChart } from "../../hooks/payments/useSales";
import { dateLocale, useLanguage, useT } from "../../lib/i18n/i18n";
import SalesChart, { type SalesChartMetric, type SalesChartText } from "./SalesChart";

// The creator's earnings over time, at the bottom of their dashboard.
const CreatorEarningsChart = () => {
  const t = useT();
  const language = useLanguage();

  const metrics: SalesChartMetric<CreatorChartRow>[] = [
    { id: "earnings", label: t("sales.totalEarnings"), value: (row) => row.earned_cents, format: "money" },
    {
      id: "completed",
      label: t("sales.completed"),
      value: (row) => row.sales,
      format: "count",
      note: (row) =>
        t("sales.completedSplit", {
          commissions: row.sales - row.instant_sales,
          downloads: row.instant_sales,
        }),
    },
  ];

  const text: SalesChartText = {
    title: t("sales.overTime"),
    show: t("sales.show"),
    kinds: {
      all: t("sales.kindAll"),
      request: t("sales.kindRequest"),
      instant: t("sales.kindInstant"),
    },
    period: t("sales.range"),
    presets: {
      "7": t("sales.rangeDays", { count: 7 }),
      "28": t("sales.rangeDays", { count: 28 }),
      "90": t("sales.rangeDays", { count: 90 }),
      "12m": t("sales.range12Months"),
      year: t("sales.rangeYear"),
      custom: t("sales.rangeCustom"),
    },
    from: t("sales.from"),
    to: t("sales.to"),
    datesTitle: t("sales.datesTitle"),
    applyDates: t("sales.applyDates"),
    cancel: t("common.cancel"),
    changeDates: t("sales.changeDates"),
    close: t("sales.close"),
    rangeInvalid: t("sales.rangeInvalid"),
    rangeTooLong: t("sales.rangeTooLong"),
    currency: t("sales.currency"),
    loading: t("sales.loading"),
    empty: t("sales.noPeriod"),
    failed: t("sales.loadFailed"),
    table: t("sales.showTable"),
    tableTitle: t("sales.tableTitle"),
    date: t("sales.date"),
  };

  return <SalesChart useChart={useMySalesChart} metrics={metrics} text={text} locale={dateLocale(language)} />;
};

export default CreatorEarningsChart;
