import { formatFileSize } from "../../lib/listings/deliveryFiles";

type UsageMeterProps = {
  label: string;
  usedBytes: number;
  limitBytes: number;
  // Shown as a lighter extension of the bar: what is about to be added.
  pendingBytes?: number;
  detail?: string;
};

const classes = {
  wrap: "space-y-1.5",
  head: "flex flex-wrap items-baseline justify-between gap-2 text-sm",
  label: "font-semibold text-zinc-800",
  figure: "tabular-nums text-zinc-600",
  track: "flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-zinc-200",
  used: "h-full rounded-full bg-[rgb(var(--primary))]",
  pending: "h-full rounded-full bg-[rgb(var(--primary)/0.4)]",
  detail: "text-xs text-zinc-500",
  warning: "text-xs font-semibold text-amber-700",
} as const;

const share = (value: number, limit: number) =>
  limit > 0 ? Math.min(100, Math.max(0, (value / limit) * 100)) : 0;

// How much of an allowance is used: a thin bar with the figures beside it,
// so the number never depends on reading the bar. Says so in words from 80%.
const UsageMeter = ({ label, usedBytes, limitBytes, pendingBytes = 0, detail }: UsageMeterProps) => {
  const total = usedBytes + pendingBytes;
  const percent = Math.round(share(total, limitBytes));

  return (
    <div className={classes.wrap}>
      <div className={classes.head}>
        <span className={classes.label}>{label}</span>
        <span className={classes.figure}>
          {formatFileSize(total)} of {formatFileSize(limitBytes)} ({percent}%)
        </span>
      </div>

      <div
        aria-label={`${label}: ${percent}% used`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className={classes.track}
        role="meter"
      >
        {usedBytes > 0 && (
          <span className={classes.used} style={{ width: `${share(usedBytes, limitBytes)}%` }} />
        )}
        {pendingBytes > 0 && (
          <span className={classes.pending} style={{ width: `${share(pendingBytes, limitBytes)}%` }} />
        )}
      </div>

      {total >= limitBytes ? (
        <p className={classes.warning}>Full.</p>
      ) : percent >= 80 ? (
        <p className={classes.warning}>{formatFileSize(limitBytes - total)} left.</p>
      ) : null}

      {detail && <p className={classes.detail}>{detail}</p>}
    </div>
  );
};

export default UsageMeter;
