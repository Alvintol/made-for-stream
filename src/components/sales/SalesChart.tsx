import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { chartTicks, formatChartPeriod, type SalesChartData } from "../../domain/payments/sales";
import { formatCompactMoney } from "../../lib/formatMoney";

const RANGES = [7, 28, 90, 365] as const;
const WIDTH = 1000;
const HEIGHT = 260;

const classes = {
  section: "space-y-3",
  header: "flex flex-wrap items-end justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  filters: "flex flex-wrap items-end gap-3",
  filter: "space-y-1",
  label: "formLabel",
  input: "formControl",
  card: "card overflow-hidden",
  tabs: "flex flex-wrap border-b border-[var(--hairline)]",
  tab: "min-w-36 flex-1 border-b-2 px-4 py-3 text-left transition",
  tabOn: "border-[rgb(var(--chart))]",
  tabOff: "border-transparent hover:bg-[rgb(var(--ink)/0.03)]",
  tabLabel: "text-xs font-semibold text-zinc-500",
  tabValue: "mt-0.5 font-display text-xl font-bold tracking-tight text-zinc-900",
  body: "p-4",
  chart: "grid grid-cols-[3.5rem_1fr] gap-x-2 transition-opacity",
  stale: "opacity-60",
  yAxis: "relative h-64",
  tick: "absolute right-0 -translate-y-1/2 text-xs tabular-nums text-zinc-500",
  plot: "relative h-64 touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--chart))]",
  svg: "absolute inset-0 h-full w-full overflow-visible",
  crosshair: "pointer-events-none absolute inset-y-0 w-px bg-[var(--hairline-strong)]",
  dot: "pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--chart))] ring-2 ring-[rgb(var(--surface))]",
  tooltip:
    "pointer-events-none absolute top-1 z-10 rounded-lg border border-[var(--hairline-strong)] bg-[rgb(var(--surface-raised))] px-3 py-2 text-xs shadow-md",
  tooltipValue: "text-sm font-bold tabular-nums text-zinc-900",
  tooltipNote: "text-zinc-500",
  xAxis: "col-start-2 mt-2 flex justify-between text-xs text-zinc-500",
  empty: "grid h-64 place-items-center text-sm text-zinc-500",
  table: "mt-3 text-sm",
  summary: "cursor-pointer font-semibold text-[rgb(var(--accent-text))]",
  tableWrap: "mt-2 max-h-72 overflow-auto",
  grid: "w-full text-left",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  error: "notice noticeError",
} as const;

export type SalesChartMetric<Row> = {
  id: string;
  label: string;
  cents: (row: Row) => number;
  count?: (row: Row) => string;
};

export type SalesChartText = {
  title: string;
  range: string;
  days: (count: number) => string;
  months: string;
  currency: string;
  loading: string;
  empty: string;
  failed: string;
  table: string;
  date: string;
};

type ChartQuery<Row> = {
  data?: SalesChartData<Row>;
  error: unknown;
  isPlaceholderData: boolean;
};

type Props<Row> = {
  useChart: (days: number) => ChartQuery<Row>;
  metrics: SalesChartMetric<Row>[];
  text: SalesChartText;
  locale?: string;
};

// Numbers over time, with a tab for each number, like a channel's analytics
// page. Amounts in different currencies can't be added, so it shows one at a
// time. Admin pages stay in English, so every word comes from the page.
const SalesChart = <Row extends { period: string; currency: string }>({
  useChart,
  metrics,
  text,
  locale,
}: Props<Row>) => {
  const [days, setDays] = useState<number>(28);
  const [metricId, setMetricId] = useState(metrics[0].id);
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const { data, error, isPlaceholderData } = useChart(days);

  const allRows = data?.rows ?? [];
  const currencies = [...new Set(allRows.map((row) => row.currency))].sort();
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0];
  const rows = allRows.filter((row) => row.currency === currency);

  const metric = metrics.find((item) => item.id === metricId) ?? metrics[0];
  const periods = data?.periods ?? [];
  const byPeriod = new Map(rows.map((row) => [row.period, row]));
  const values = periods.map((period) => {
    const row = byPeriod.get(period);

    return row ? metric.cents(row) : 0;
  });

  const money = (cents: number) => formatPaymentCents(cents, currency);
  const periodName = (period: string) => formatChartPeriod(period, data?.unit ?? "day", locale);

  const ticks = chartTicks(values);
  const bottom = ticks[0];
  const top = ticks[ticks.length - 1];
  const last = periods.length - 1;

  const xPercent = (index: number) => (index / last) * 100;
  const yPercent = (value: number) => ((top - value) / (top - bottom)) * 100;
  const point = (value: number, index: number) =>
    `${(xPercent(index) / 100) * WIDTH},${(yPercent(value) / 100) * HEIGHT}`;

  const line = `M${values.map(point).join("L")}`;
  const zero = (yPercent(0) / 100) * HEIGHT;
  const area = `${line}L${WIDTH},${zero}L0,${zero}Z`;

  const shown = active ?? last;
  const shownRow = byPeriod.get(periods[shown]);

  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);

    setActive(Math.round(ratio * last));
  };

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    setActive(Math.min(Math.max(shown + (event.key === "ArrowLeft" ? -1 : 1), 0), last));
  };

  const hasData = rows.length > 0 && periods.length > 1;

  return (
    <section className={classes.section}>
      <div className={classes.header}>
        <h2 className={classes.title}>{text.title}</h2>

        <div className={classes.filters}>
          {currencies.length > 1 && (
            <label className={classes.filter}>
              <span className={classes.label}>{text.currency}</span>
              <select
                className={classes.input}
                value={currency}
                onChange={(event) => setChosenCurrency(event.currentTarget.value)}
              >
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={classes.filter}>
            <span className={classes.label}>{text.range}</span>
            <select
              className={classes.input}
              value={days}
              onChange={(event) => {
                setActive(null);
                setDays(Number(event.currentTarget.value));
              }}
            >
              {RANGES.map((range) => (
                <option key={range} value={range}>
                  {range === 365 ? text.months : text.days(range)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className={classes.error}>{text.failed}</div>
      ) : (
        <div className={classes.card}>
          {hasData && (
            <div className={classes.tabs}>
              {metrics.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === metric.id}
                  className={`${classes.tab} ${item.id === metric.id ? classes.tabOn : classes.tabOff}`}
                  onClick={() => setMetricId(item.id)}
                >
                  <div className={classes.tabLabel}>{item.label}</div>
                  <div className={classes.tabValue}>
                    {money(rows.reduce((total, row) => total + item.cents(row), 0))}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={classes.body}>
            {!hasData ? (
              <p className={classes.empty}>{data ? text.empty : text.loading}</p>
            ) : (
              <>
                <div className={`${classes.chart} ${isPlaceholderData ? classes.stale : ""}`}>
                  <div className={classes.yAxis} aria-hidden="true">
                    {ticks.map((tick) => (
                      <span key={tick} className={classes.tick} style={{ top: `${yPercent(tick)}%` }}>
                        {formatCompactMoney(tick / 100, currency)}
                      </span>
                    ))}
                  </div>

                  <div
                    className={classes.plot}
                    role="group"
                    aria-label={metric.label}
                    tabIndex={0}
                    onPointerDown={pointAt}
                    onPointerMove={pointAt}
                    onPointerLeave={() => setActive(null)}
                    onBlur={() => setActive(null)}
                    onKeyDown={step}
                  >
                    <svg
                      className={classes.svg}
                      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {ticks.map((tick) => (
                        <line
                          key={tick}
                          x1={0}
                          x2={WIDTH}
                          y1={(yPercent(tick) / 100) * HEIGHT}
                          y2={(yPercent(tick) / 100) * HEIGHT}
                          stroke={tick === 0 ? "var(--hairline-strong)" : "var(--hairline)"}
                          strokeWidth={1}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      <path d={area} fill="rgb(var(--chart) / 0.1)" />
                      <path
                        d={line}
                        fill="none"
                        stroke="rgb(var(--chart))"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    {active !== null && (
                      <div className={classes.crosshair} style={{ left: `${xPercent(active)}%` }} />
                    )}

                    <div
                      className={classes.dot}
                      style={{ left: `${xPercent(shown)}%`, top: `${yPercent(values[shown])}%` }}
                    />

                    {active !== null && (
                      <div
                        className={classes.tooltip}
                        role="status"
                        style={
                          xPercent(active) > 50
                            ? { right: `calc(${100 - xPercent(active)}% + 0.75rem)` }
                            : { left: `calc(${xPercent(active)}% + 0.75rem)` }
                        }
                      >
                        <div className={classes.tooltipValue}>{money(values[active])}</div>
                        <div className={classes.tooltipNote}>{periodName(periods[active])}</div>
                        {shownRow && metric.count && (
                          <div className={classes.tooltipNote}>{metric.count(shownRow)}</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={classes.xAxis} aria-hidden="true">
                    <span>{periodName(periods[0])}</span>
                    <span>{periodName(periods[Math.floor(last / 2)])}</span>
                    <span>{periodName(periods[last])}</span>
                  </div>
                </div>

                <details className={classes.table}>
                  <summary className={classes.summary}>{text.table}</summary>

                  <div className={classes.tableWrap}>
                    <table className={classes.grid}>
                      <thead>
                        <tr>
                          <th className={classes.th}>{text.date}</th>
                          {metrics.map((item) => (
                            <th key={item.id} className={classes.th}>
                              {item.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.period}>
                            <td className={classes.td}>{periodName(row.period)}</td>
                            {metrics.map((item) => (
                              <td key={item.id} className={classes.td}>
                                {money(item.cents(row))}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default SalesChart;
