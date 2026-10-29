import { useState } from "react";

import {
  daysUntil,
  formatTaxReportPeriod,
  missingTaxDetails,
  TAX_REPORTS,
  taxReportCsv,
  taxReportFileName,
  taxReportSellerName,
  type TaxReportObligation,
} from "../../domain/payments/taxReporting";
import {
  useAdminSetTaxReportFiled,
  useAdminTaxReportingOverview,
  useAdminTaxReportSellers,
} from "../../hooks/admin/useAdminTaxReporting";
import { hasErrorMessage } from "../../lib/errorMessage";
import { formatMoney } from "../../lib/formatMoney";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",
  card: "card space-y-4 p-6",
  title: "font-display text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  tableWrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-zinc-500",
  td: "border-b border-zinc-100 py-2 pr-4 tabular-nums text-zinc-800",
  overdue: "font-semibold text-red-700",
  soon: "font-semibold text-amber-700",
  filed: "text-emerald-700",
  missing: "text-amber-700",
  row: "flex flex-wrap items-end gap-3",
  label: "formLabel",
  input: "formControl max-w-xs",
  btn: "btnPrimary btnSm",
  btnOutline: "btnOutline btnSm",
  empty: "text-sm text-zinc-500",
  loading: "text-sm text-zinc-600",
  error: "notice noticeError",
  warning: "notice noticeWarning",
} as const;

const reportKey = (obligation: Pick<TaxReportObligation, "regime" | "period_start">) =>
  `${obligation.regime}:${obligation.period_start}`;

const statusText = (obligation: TaxReportObligation, today: string) => {
  if (obligation.filed_at) {
    return {
      className: classes.filed,
      text: `Filed ${obligation.filed_at.slice(0, 10)}${obligation.reference ? ` (${obligation.reference})` : ""}`,
    };
  }

  const days = daysUntil(obligation.due_date, today);

  if (obligation.seller_count === 0) {
    return { className: "", text: "Nobody to report so far" };
  }

  if (days < 0) {
    return { className: classes.overdue, text: `Overdue by ${-days} day${days === -1 ? "" : "s"}` };
  }

  return {
    className: days <= 30 ? classes.soon : "",
    text: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`,
  };
};

const downloadCsv = (fileName: string, csv: string) => {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const ReportDetail = ({ obligation }: { obligation: TaxReportObligation }) => {
  const report = TAX_REPORTS[obligation.regime];
  const isReturn = obligation.regime === "ca_gst";
  const sellers = useAdminTaxReportSellers(obligation);
  const setFiled = useAdminSetTaxReportFiled();
  const [reference, setReference] = useState("");

  const rows = sellers.data ?? [];
  const missingCount = new Set(
    rows.filter((row) => missingTaxDetails(row).length > 0).map((row) => row.creator_user_id),
  ).size;

  return (
    <section className={classes.card}>
      <h2 className={classes.title}>
        {report.name}, {formatTaxReportPeriod(obligation.period_start, obligation.period_end)}
      </h2>
      <p className={classes.text}>
        Due {obligation.due_date}. {report.howToFile}
      </p>

      {!isReturn && (
        <>
          {sellers.isLoading && <p className={classes.loading}>Loading…</p>}
          {sellers.error && (
            <div className={classes.error}>
              {hasErrorMessage(sellers.error) ? sellers.error.message : "The report could not be loaded."}
            </div>
          )}

          {sellers.data && rows.length === 0 && (
            <p className={classes.empty}>No creators to report for this period so far.</p>
          )}

          {rows.length > 0 && (
            <>
              {missingCount > 0 && (
                <div className={classes.warning}>
                  {missingCount} creator{missingCount === 1 ? " is" : "s are"} missing details the
                  report needs. Ask them to complete Settings → Personal details before filing.
                </div>
              )}

              <div className={classes.tableWrap}>
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th className={classes.th}>Creator</th>
                      <th className={classes.th}>Country</th>
                      <th className={classes.th}>Quarter</th>
                      <th className={classes.th}>Payments</th>
                      <th className={classes.th}>Paid</th>
                      <th className={classes.th}>Refunded</th>
                      <th className={classes.th}>Fees kept</th>
                      <th className={classes.th}>Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.creator_user_id}:${row.currency}:${row.quarter}`}>
                        <td className={classes.td}>{taxReportSellerName(row)}</td>
                        <td className={classes.td}>{row.country_code}</td>
                        <td className={classes.td}>Q{row.quarter}</td>
                        <td className={classes.td}>{row.payments}</td>
                        <td className={classes.td}>{formatMoney(row.paid_cents / 100, row.currency)}</td>
                        <td className={classes.td}>{formatMoney(row.refunded_cents / 100, row.currency)}</td>
                        <td className={classes.td}>{formatMoney(row.creator_fee_cents / 100, row.currency)}</td>
                        <td className={`${classes.td} ${classes.missing}`}>
                          {missingTaxDetails(row).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={classes.text}>
                The file holds creators' private details. Keep it off shared drives and delete it
                after filing. It is the working copy, not the authority's upload format.
              </p>
              <button
                className={classes.btnOutline}
                onClick={() => downloadCsv(taxReportFileName(obligation), taxReportCsv(rows))}
                type="button"
              >
                Download the report (CSV)
              </button>
            </>
          )}
        </>
      )}

      {setFiled.error && (
        <div className={classes.error}>
          {hasErrorMessage(setFiled.error) ? setFiled.error.message : "The report could not be updated."}
        </div>
      )}

      {obligation.filed_at ? (
        <div className={classes.row}>
          <p className={classes.text}>
            Marked filed on {obligation.filed_at.slice(0, 10)}
            {obligation.reference ? `, confirmation ${obligation.reference}` : ""}. Reminders are off.
          </p>
          <button
            className={classes.btnOutline}
            disabled={setFiled.isPending}
            onClick={() =>
              setFiled.mutate({ regime: obligation.regime, periodStart: obligation.period_start, filed: false })
            }
            type="button"
          >
            Undo
          </button>
        </div>
      ) : (
        <form
          className={classes.row}
          onSubmit={(event) => {
            event.preventDefault();
            setFiled.mutate({
              regime: obligation.regime,
              periodStart: obligation.period_start,
              filed: true,
              reference,
            });
          }}
        >
          <label className="space-y-1">
            <span className={classes.label}>Confirmation number (optional)</span>
            <input
              className={classes.input}
              maxLength={200}
              onChange={(event) => setReference(event.target.value)}
              value={reference}
            />
          </label>
          <button className={classes.btn} disabled={setFiled.isPending} type="submit">
            Mark as filed
          </button>
        </form>
      )}
    </section>
  );
};

// Every report Made for Stream owes a tax authority from launch onwards,
// with each report's creators and a file to file from. The ops email
// reminds about unfiled ones (TAX-008).
const AdminTaxReporting = () => {
  const { data, isLoading, error } = useAdminTaxReportingOverview();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = data?.obligations.find((obligation) => reportKey(obligation) === selectedKey) ?? null;

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Tax reporting</h1>
        <p className={classes.sub}>
          The reports Made for Stream files with tax authorities, and its own GST/HST return. The
          ops email reminds you 30, 14, 7 and 1 days before each is due until it is marked filed.
        </p>
      </div>

      {isLoading && <p className={classes.loading}>Loading…</p>}
      {error && (
        <div className={classes.error}>
          {hasErrorMessage(error) ? error.message : "Tax reporting could not be loaded."}
        </div>
      )}

      {data && (
        <section className={classes.card}>
          <h2 className={classes.title}>Calendar</h2>
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Report</th>
                  <th className={classes.th}>Period</th>
                  <th className={classes.th}>Due</th>
                  <th className={classes.th}>Creators</th>
                  <th className={classes.th}>Status</th>
                  <th className={classes.th}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.obligations.map((obligation) => {
                  const status = statusText(obligation, data.today);

                  return (
                    <tr key={reportKey(obligation)}>
                      <td className={classes.td}>{TAX_REPORTS[obligation.regime].name}</td>
                      <td className={classes.td}>
                        {formatTaxReportPeriod(obligation.period_start, obligation.period_end)}
                      </td>
                      <td className={classes.td}>{obligation.due_date}</td>
                      <td className={classes.td}>{obligation.seller_count ?? "—"}</td>
                      <td className={`${classes.td} ${status.className}`}>{status.text}</td>
                      <td className={classes.td}>
                        <button
                          aria-pressed={selectedKey === reportKey(obligation)}
                          className={classes.btnOutline}
                          onClick={() => setSelectedKey(reportKey(obligation))}
                          type="button"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected && <ReportDetail key={reportKey(selected)} obligation={selected} />}
    </div>
  );
};

export default AdminTaxReporting;
