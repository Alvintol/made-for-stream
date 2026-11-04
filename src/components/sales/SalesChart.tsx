import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import {
  chartPresetRange,
  chartTicks,
  customRangeProblem,
  formatChartPeriod,
  salesKinds,
  type SalesChartData,
  type SalesChartPreset,
  type SalesChartQuery,
  type SalesKind,
} from "../../domain/payments/sales";
import { formatCompactMoney } from "../../lib/formatMoney";
import Dialog from "../ui/Dialog";

// The rolling periods; whole years and custom dates follow them in the list.
const ROLLING: readonly SalesChartPreset[] = ["7", "28", "90", "12m"];
const WIDTH = 1000;
const HEIGHT = 260;

const classes = {
  section: "space-y-3",
  header: "flex flex-wrap items-end justify-between gap-3",
  title: "font-display text-lg font-extrabold tracking-tight text-zinc-900",
  filters: "ml-auto flex items-end gap-3",
  change: "mt-0.5 block text-sm font-semibold text-[rgb(var(--accent-text))] hover:underline",
  filter: "space-y-1",
  label: "formLabel block",
  input: "formControl h-10",
  problem: "formError",
  dates: "grid gap-3 sm:grid-cols-2",
  actions: "flex flex-wrap justify-end gap-2",
  card: "card overflow-hidden",
  // Always drawn, with or without sales, so the card keeps one height.
  tabs: "flex items-stretch overflow-x-auto border-b border-[var(--hairline)]",
  currency: "flex shrink-0 items-center px-3",
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
  bar: "pointer-events-none absolute -translate-x-1/2 bg-[rgb(var(--chart))] transition-opacity",
  barUp: "rounded-t-[4px]",
  barDown: "rounded-b-[4px]",
  barDim: "opacity-70",
  tooltip:
    "pointer-events-none absolute top-1 z-10 rounded-lg border border-[var(--hairline-strong)] bg-[rgb(var(--surface-raised))] px-3 py-2 text-xs shadow-md",
  tooltipValue: "text-sm font-bold tabular-nums text-zinc-900",
  tooltipNote: "text-zinc-500",
  xAxis: "col-start-2 mt-2 flex justify-between text-xs text-zinc-500",
  xAxisBars: "col-start-2 mt-2 flex text-xs text-zinc-500",
  xBarLabel: "flex-1 truncate text-center",
  // The height of a drawn graph and its dates, so an empty period doesn't
  // shrink the card.
  empty: "grid h-[17.5rem] place-items-center text-sm text-zinc-500",
  tableButton: "mt-3 text-sm font-semibold text-[rgb(var(--accent-text))] hover:underline disabled:cursor-default disabled:text-zinc-400 disabled:no-underline",
  tableWrap: "max-h-[60vh] overflow-auto",
  grid: "w-full text-left",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  error: "notice noticeError",
} as const;

export type SalesChartMetric<Row> = {
  id: string;
  label: string;
  value: (row: Row) => number;
  // Money is in cents; a count is a number of sales.
  format: "money" | "count";
  note?: (row: Row) => string;
};

export type SalesChartText = {
  title: string;
  show: string;
  kinds: Record<SalesKind, string>;
  period: string;
  presets: Record<SalesChartPreset, string>;
  from: string;
  to: string;
  datesTitle: string;
  applyDates: string;
  cancel: string;
  changeDates: string;
  close: string;
  rangeInvalid: string;
  rangeTooLong: string;
  currency: string;
  loading: string;
  empty: string;
  failed: string;
  table: string;
  tableTitle: string;
  date: string;
};

type ChartQuery<Row> = {
  data?: SalesChartData<Row>;
  error: unknown;
  isPlaceholderData: boolean;
};

type Props<Row> = {
  useChart: (query: SalesChartQuery) => ChartQuery<Row>;
  metrics: SalesChartMetric<Row>[];
  text: SalesChartText;
  locale?: string;
  // For tests: the day the presets count back from.
  today?: Date;
};

// Numbers over time, with a tab for each number, like a channel's analytics
// page: a line by day, or bars by month for longer periods and whole years.
// Filters choose commissions, instant downloads or both, and the dates.
// Amounts in different currencies can't be added, so it shows one at a time.
// It never changes size: custom dates and the table open in a modal, and an
// empty period takes the same room as a drawn one.
// Admin pages stay in English, so every word comes from the page.
const SalesChart = <Row extends { period: string; currency: string }>({
  useChart,
  metrics,
  text,
  locale,
  today = new Date(),
}: Props<Row>) => {
  const thisYear = today.getUTCFullYear();
  const [kind, setKind] = useState<SalesKind>("all");
  const [preset, setPreset] = useState<SalesChartPreset>("28");
  const [year, setYear] = useState(thisYear);
  const [custom, setCustom] = useState(() => chartPresetRange("28", today));
  const [customDraft, setCustomDraft] = useState(custom);
  const [metricId, setMetricId] = useState(metrics[0].id);
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  const range = preset === "custom" ? custom : chartPresetRange(preset, today, year);
  const { data, error, isPlaceholderData } = useChart({ ...range, kind });
  const draftProblem = customRangeProblem(customDraft.from, customDraft.to);

  const dayText = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  const customText = `${dayText(custom.from)} – ${dayText(custom.to)}`;

  const openDates = () => {
    setCustomDraft(custom);
    setDatesOpen(true);
  };

  const choosePeriod = (value: string) => {
    setActive(null);

    // Custom dates are chosen in the modal; the period changes only when
    // they're used.
    if (value === "custom") return openDates();

    if (value.startsWith("year-")) {
      setYear(Number(value.slice(5)));
      setPreset("year");
      return;
    }

    setPreset(value as SalesChartPreset);
  };

  const useDates = () => {
    setCustom(customDraft);
    setPreset("custom");
    setDatesOpen(false);
  };

  const allRows = data?.rows ?? [];
  const currencies = [...new Set(allRows.map((row) => row.currency))].sort();
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0];
  const rows = allRows.filter((row) => row.currency === currency);

  const metric = metrics.find((item) => item.id === metricId) ?? metrics[0];
  const periods = data?.periods ?? [];
  const bars = data?.unit === "month";
  const byPeriod = new Map(rows.map((row) => [row.period, row]));
  const values = periods.map((period) => {
    const row = byPeriod.get(period);

    return row ? metric.value(row) : 0;
  });

  const show = (item: SalesChartMetric<Row>, value: number) =>
    item.format === "money" ? formatPaymentCents(value, currency) : String(value);
  const periodName = (period: string) => formatChartPeriod(period, data?.unit ?? "day", locale);

  const ticks = chartTicks(values, metric.format === "money" ? 100 : 4);
  const bottom = ticks[0];
  const top = ticks[ticks.length - 1];
  const count = periods.length;
  const last = count - 1;

  const xPercent = (index: number) => (bars ? ((index + 0.5) / count) * 100 : (index / last) * 100);
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

    setActive(bars ? Math.min(Math.floor(ratio * count), last) : Math.round(ratio * last));
  };

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    setActive(Math.min(Math.max(shown + (event.key === "ArrowLeft" ? -1 : 1), 0), last));
  };

  const hasData = rows.length > 0 && count > (bars ? 0 : 1);
  const years = [thisYear, thisYear - 1, thisYear - 2];

  return (
    <section className={classes.section}>
      <div className={classes.header}>
        <div>
          <h2 className={classes.title}>{text.title}</h2>
          {preset === "custom" && (
            <button type="button" className={classes.change} onClick={openDates}>
              {customText} · {text.changeDates}
            </button>
          )}
        </div>

        {/* Only these two, always in this place. */}
        <div className={classes.filters}>
          <label className={classes.filter}>
            <span className={classes.label}>{text.show}</span>
            <select
              className={classes.input}
              value={kind}
              onChange={(event) => {
                setActive(null);
                setKind(event.currentTarget.value as SalesKind);
              }}
            >
              {salesKinds.map((item) => (
                <option key={item} value={item}>
                  {text.kinds[item]}
                </option>
              ))}
            </select>
          </label>

          <label className={classes.filter}>
            <span className={classes.label}>{text.period}</span>
            <select
              className={classes.input}
              value={preset === "year" ? `year-${year}` : preset}
              onChange={(event) => choosePeriod(event.currentTarget.value)}
            >
              {ROLLING.map((item) => (
                <option key={item} value={item}>
                  {text.presets[item]}
                </option>
              ))}
              <optgroup label={text.presets.year}>
                {years.map((item) => (
                  <option key={item} value={`year-${item}`}>
                    {item}
                  </option>
                ))}
              </optgroup>
              <option value="custom">{text.presets.custom}</option>
            </select>
          </label>
        </div>
      </div>

      <Dialog open={datesOpen} onClose={() => setDatesOpen(false)} title={text.datesTitle} closeLabel={text.close}>
        <div className={classes.dates}>
          <label className={classes.filter}>
            <span className={classes.label}>{text.from}</span>
            <input
              className={classes.input}
              type="date"
              max={customDraft.to || undefined}
              value={customDraft.from}
              onChange={(event) => setCustomDraft({ ...customDraft, from: event.currentTarget.value })}
            />
          </label>
          <label className={classes.filter}>
            <span className={classes.label}>{text.to}</span>
            <input
              className={classes.input}
              type="date"
              min={customDraft.from || undefined}
              max={chartPresetRange("7", today).to}
              value={customDraft.to}
              onChange={(event) => setCustomDraft({ ...customDraft, to: event.currentTarget.value })}
            />
          </label>
        </div>

        {draftProblem && (
          <p className={classes.problem} role="alert">
            {draftProblem === "sales.rangeTooLong" ? text.rangeTooLong : text.rangeInvalid}
          </p>
        )}

        <div className={classes.actions}>
          <button type="button" className="btnOutline" onClick={() => setDatesOpen(false)}>
            {text.cancel}
          </button>
          <button type="button" className="btnPrimary" disabled={draftProblem !== null} onClick={useDates}>
            {text.applyDates}
          </button>
        </div>
      </Dialog>

      {error ? (
        <div className={classes.error}>{text.failed}</div>
      ) : (
        <div className={classes.card}>
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
                    {/* No sales, no currency to show an amount in. */}
                    {rows.length > 0 ? show(item, rows.reduce((total, row) => total + item.value(row), 0)) : "–"}
                  </div>
                </button>
              ))}

              {currencies.length > 1 && (
                <label className={classes.currency}>
                  <span className="sr-only">{text.currency}</span>
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
            </div>

          <div className={classes.body}>
            {!hasData ? (
              <p className={classes.empty}>{data ? text.empty : text.loading}</p>
            ) : (
              <>
                <div className={`${classes.chart} ${isPlaceholderData ? classes.stale : ""}`}>
                  <div className={classes.yAxis} aria-hidden="true">
                    {ticks.map((tick) => (
                      <span key={tick} className={classes.tick} style={{ top: `${yPercent(tick)}%` }}>
                        {metric.format === "money" ? formatCompactMoney(tick / 100, currency) : tick}
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
                      {!bars && (
                        <>
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
                        </>
                      )}
                    </svg>

                    {bars &&
                      values.map((value, index) => (
                        <div
                          key={periods[index]}
                          className={`${classes.bar} ${value >= 0 ? classes.barUp : classes.barDown} ${
                            active !== null && active !== index ? classes.barDim : ""
                          }`}
                          style={{
                            left: `${xPercent(index)}%`,
                            width: `min(24px, ${(60 / count).toFixed(2)}%)`,
                            top: `${yPercent(Math.max(value, 0))}%`,
                            height: `${Math.abs(yPercent(value) - yPercent(0))}%`,
                          }}
                        />
                      ))}

                    {!bars && active !== null && (
                      <div className={classes.crosshair} style={{ left: `${xPercent(active)}%` }} />
                    )}

                    {!bars && (
                      <div
                        className={classes.dot}
                        style={{ left: `${xPercent(shown)}%`, top: `${yPercent(values[shown])}%` }}
                      />
                    )}

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
                        <div className={classes.tooltipValue}>{show(metric, values[active])}</div>
                        <div className={classes.tooltipNote}>{periodName(periods[active])}</div>
                        {shownRow && metric.note && (
                          <div className={classes.tooltipNote}>{metric.note(shownRow)}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {bars && count <= 12 ? (
                    <div className={classes.xAxisBars} aria-hidden="true">
                      {periods.map((period) => (
                        <span key={period} className={classes.xBarLabel}>
                          {formatChartPeriod(period, "month", locale).split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={classes.xAxis} aria-hidden="true">
                      <span>{periodName(periods[0])}</span>
                      <span>{periodName(periods[Math.floor(last / 2)])}</span>
                      <span>{periodName(periods[last])}</span>
                    </div>
                  )}
                </div>

              </>
            )}

            {/* Always here, so the card is the same height with or without sales. */}
            <button type="button" className={classes.tableButton} disabled={!hasData} onClick={() => setTableOpen(true)}>
              {text.table}
            </button>

            <Dialog open={tableOpen} onClose={() => setTableOpen(false)} title={text.tableTitle} closeLabel={text.close}>
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
                            {show(item, item.value(row))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Dialog>
          </div>
        </div>
      )}
    </section>
  );
};

export default SalesChart;
