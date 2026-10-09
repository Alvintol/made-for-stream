import { formatMoney as formatCurrencyAmount } from "../../../lib/formatMoney";
import type { ReactNode } from "react";
import {
  getAgreementAcknowledgementKeysBySection,
  getAgreementChecklistItemLabel,
  getRequiredListingRequestAgreementAcknowledgements,
  getListingRequestAgreementStatusLabel,
  getListingRequestAgreementStatusSummary,
  getListingRequestBuyerHoldReasonLabel,
  getListingRequestIncludedRevisionCount,
  getListingRequestPaymentStructureLabel,
  getListingRequestPaymentTimingLabel,
  getMaximumAgreementFeeAmount,
  STANDARD_FEE_BPS,
} from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";

// When given, each section ends with an "I understand" box (the buyer,
// reviewing a sent agreement). `checkedKeys` are acknowledgement keys.
export type AgreementAcknowledgeControls = {
  checkedKeys: string[];
  onToggle: (keys: string[], checked: boolean) => void;
  disabled?: boolean;
};

type ListingRequestAgreementSummaryProps = {
  agreement: ListingRequestAgreementRow | null;
  isLoading?: boolean;
  acknowledge?: AgreementAcknowledgeControls;
  // The buyer's handle or display name, for "… provides" and "… approves"
  // beside checklist lines.
  buyerName?: string;
};

const classes = {
  statusRow: "flex flex-wrap items-center gap-2 text-xs text-zinc-500",
  badge:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700",
  text: "text-sm text-zinc-600",
  body: "space-y-5",

  group: "space-y-2",
  groupTitle: "text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500",
  rows: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)]",
  row: "flex items-start justify-between gap-3 px-3 py-2 text-sm",
  rowLabel: "text-zinc-600",
  rowValue: "text-right font-semibold text-zinc-900",
  rowMain: "min-w-0",
  rowTitle: "font-medium text-zinc-900",
  rowSub: "mt-0.5 text-xs text-zinc-500",
  rowAside: "shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-700",
  note: "mt-0.5 text-xs font-normal text-zinc-500",
  bullets: "list-disc space-y-1 pl-5 text-sm text-zinc-700 marker:text-zinc-400",
  chips: "flex flex-wrap gap-1.5",
  chip: "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700",
  confirmedOn: "text-xs font-medium text-zinc-500",
  warning: "notice noticeWarning",
  understand:
    "flex items-start gap-2.5 rounded-xl bg-[rgb(var(--accent-soft))] px-3 py-2 text-sm font-semibold text-zinc-900",
  understandBox: "mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300",
} as const;

// Shown to everyone, and what the buyer's "policies" and "schedule"
// confirmations refer to: they must be on the page to be understood.
const CHANGE_ORDER_RULE =
  "Any change to scope, price, timeline, deliverables or payments needs an accepted change order.";
const FINAL_FILES_RULE =
  "Final files or deliverables may be held until required payments are complete.";
const HOLD_RULE = "Time the project spends waiting on the buyer is added to this date.";

const formatMoney = (amount: number | null, currency: string): string =>
  amount === null
    ? "Not set"
    : formatCurrencyAmount(amount, currency);

const formatDate = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";

const sortedBySortOrder = <T extends { sort_order: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.sort_order - b.sort_order);

const scheduleStatusLabel = (status: string): string =>
  status === "payment_required"
    ? "Due now"
    : status === "paid"
      ? "Paid"
      : status === "waived"
        ? "Waived"
        : status === "cancelled"
          ? "Cancelled"
          : "Upcoming";

// Acknowledgements are usually all given in one sitting, so group them under a single date.
const groupAcknowledgementsByDay = (
  acknowledgements: ListingRequestAgreementRow["listing_request_agreement_acknowledgements"]
) => {
  const groups = new Map<string, typeof acknowledgements>();

  [...acknowledgements]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((acknowledgement) => {
      const day = formatDate(acknowledgement.created_at);
      groups.set(day, [...(groups.get(day) ?? []), acknowledgement]);
    });

  return [...groups.entries()];
};

type GroupProps = {
  title: string;
  children: ReactNode;
  // The acknowledgement keys this section's "I understand" box stands for.
  keys?: string[];
  acknowledge?: AgreementAcknowledgeControls;
};

const Group = ({ title, children, keys = [], acknowledge }: GroupProps) => (
  <section className={classes.group}>
    <h3 className={classes.groupTitle}>{title}</h3>
    {children}
    {acknowledge && keys.length > 0 && (
      <label className={classes.understand}>
        <input
          type="checkbox"
          className={classes.understandBox}
          checked={keys.every((key) => acknowledge.checkedKeys.includes(key))}
          disabled={acknowledge.disabled}
          onChange={(event) => acknowledge.onToggle(keys, event.currentTarget.checked)}
        />
        <span>I understand the {title.toLowerCase()} above.</span>
      </label>
    )}
  </section>
);

const TermRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className={classes.row}>
    <dt className={classes.rowLabel}>{label}</dt>
    <dd className={classes.rowValue}>{children}</dd>
  </div>
);

const AgreementDetails = ({
  agreement,
  acknowledge,
  buyerName,
}: {
  agreement: ListingRequestAgreementRow;
  acknowledge?: AgreementAcknowledgeControls;
  buyerName: string;
}) => {
  const keys = getAgreementAcknowledgementKeysBySection(
    acknowledge ? getRequiredListingRequestAgreementAcknowledgements(agreement) : []
  );

  const completedHoldDays = agreement.listing_request_timeline_holds
    .filter((hold) => hold.ended_at)
    .reduce((total, hold) => total + hold.rounded_extension_days, 0);

  const hasActiveHold = agreement.listing_request_timeline_holds.some((hold) => !hold.ended_at);
  const adjustedDiffers =
    agreement.adjusted_estimated_completion_at &&
    agreement.adjusted_estimated_completion_at !== agreement.estimated_completion_at;
  const checklist = sortedBySortOrder(agreement.listing_request_agreement_items);
  const schedule = sortedBySortOrder(agreement.listing_request_payment_schedule_items);
  const maximumFee = formatMoney(getMaximumAgreementFeeAmount(schedule), agreement.currency);
  const policies = [
    agreement.additional_cost_policy,
    agreement.revision_policy,
    agreement.update_schedule_summary,
  ].filter((policy): policy is string => Boolean(policy));

  return (
    <>
      <Group title="Terms" keys={keys.terms} acknowledge={acknowledge}>
        <dl className={classes.rows}>
          <TermRow label="Payment structure">
            {getListingRequestPaymentStructureLabel(agreement.payment_structure)}
          </TermRow>
          <TermRow label="Total">{formatMoney(agreement.total_amount, agreement.currency)}</TermRow>
          {agreement.deposit_amount !== null && (
            <TermRow label="Deposit">
              {formatMoney(agreement.deposit_amount, agreement.currency)}
            </TermRow>
          )}
          <TermRow label="Included revisions">
            {getListingRequestIncludedRevisionCount(agreement.included_revision_count)}
            {agreement.included_revision_count === null && (
              <span className={classes.text}> (not stated — default applied)</span>
            )}
          </TermRow>
          <TermRow label={adjustedDiffers ? "Adjusted completion" : "Estimated completion"}>
            {formatDate(agreement.adjusted_estimated_completion_at || agreement.estimated_completion_at)}
            {completedHoldDays > 0 && (
              <p className={classes.note}>
                Includes +{completedHoldDays} day{completedHoldDays === 1 ? "" : "s"} from buyer-side holds.
              </p>
            )}
            <p className={classes.note}>{HOLD_RULE}</p>
          </TermRow>
        </dl>
      </Group>

      <Group title="Scope" keys={keys.scope} acknowledge={acknowledge}>
        <p className={classes.text}>{agreement.scope_summary}</p>

        {agreement.included_deliverables.length > 0 ? (
          <div className={classes.chips}>
            {agreement.included_deliverables.map((deliverable) => (
              <span key={deliverable} className={classes.chip}>
                {deliverable}
              </span>
            ))}
          </div>
        ) : (
          <p className={classes.text}>No deliverables listed.</p>
        )}
      </Group>

      {checklist.length > 0 && (
        <Group title="Scope checklist" keys={keys.checklist} acknowledge={acknowledge}>
          <ul className={classes.rows}>
            {checklist.map((item) => (
              <li key={item.id} className={classes.row}>
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>{item.title}</div>
                  {item.description && <div className={classes.rowSub}>{item.description}</div>}
                </div>
                {/* A checklist line says who it is for; a milestone or other
                    priced line says when its payment is due, as before. */}
                <div className={classes.rowAside}>
                  {[
                    getAgreementChecklistItemLabel(item.item_type, buyerName) ??
                      getListingRequestPaymentTimingLabel(item.payment_timing),
                    item.price_amount ? formatMoney(item.price_amount, agreement.currency) : null,
                    item.timeline_impact_days
                      ? `+${item.timeline_impact_days} day${item.timeline_impact_days === 1 ? "" : "s"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title="Payment schedule" keys={keys.schedule} acknowledge={acknowledge}>
        {schedule.length > 0 ? (
          <ul className={classes.rows}>
            {schedule.map((paymentItem) => (
              <li key={paymentItem.id} className={classes.row}>
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>{paymentItem.title}</div>
                  <div className={classes.rowSub}>
                    {getListingRequestPaymentTimingLabel(paymentItem.payment_timing)}
                  </div>
                </div>
                <div className={classes.rowAside}>
                  {`${formatMoney(paymentItem.amount, paymentItem.currency)} · ${scheduleStatusLabel(paymentItem.status)}`}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={classes.text}>No payment schedule items listed.</p>
        )}
        {schedule.length > 0 && (
          <p className={classes.text}>
            {`Estimated Made for Stream fees: the buyer service fee is at most ${maximumFee}, and so is the creator platform fee (each ${STANDARD_FEE_BPS / 100}% of every payment, rounded up to the cent). These are maximums — a fee can be lower, never higher. Tips, contributions and any tax are separate.`}
          </p>
        )}
        <p className={classes.text}>{FINAL_FILES_RULE}</p>
      </Group>

      <Group title="Policies" keys={keys.policies} acknowledge={acknowledge}>
        <ul className={classes.bullets}>
          {policies.map((policy) => (
            <li key={policy}>{policy}</li>
          ))}
          <li>{CHANGE_ORDER_RULE}</li>
        </ul>
      </Group>

      {agreement.listing_request_agreement_acknowledgements.length > 0 && (
        <Group title="Buyer confirmations">
          {groupAcknowledgementsByDay(agreement.listing_request_agreement_acknowledgements).map(
            ([day, acknowledgements]) => (
              <div key={day} className="space-y-1.5">
                <p className={classes.confirmedOn}>Confirmed on {day}</p>
                <ul className={classes.bullets}>
                  {acknowledgements.map((acknowledgement) => (
                    <li key={acknowledgement.id}>{acknowledgement.acknowledgement_label}</li>
                  ))}
                </ul>
              </div>
            )
          )}
        </Group>
      )}

      {hasActiveHold && (
        <div className={classes.warning}>
          This project is currently waiting on buyer action. The estimated completion date may be
          adjusted after the hold is resolved.
        </div>
      )}

      {agreement.listing_request_timeline_holds.length > 0 && (
        <Group title="Timeline holds">
          <ul className={classes.rows}>
            {agreement.listing_request_timeline_holds.map((hold) => (
              <li key={hold.id} className={classes.row}>
                <div className={classes.rowTitle}>
                  {getListingRequestBuyerHoldReasonLabel(hold.reason)}
                </div>
                <div className={classes.rowAside}>
                  {hold.ended_at
                    ? `Resolved with +${hold.rounded_extension_days} day${hold.rounded_extension_days === 1 ? "" : "s"} added.`
                    : "Currently active."}
                </div>
              </li>
            ))}
          </ul>
        </Group>
      )}
    </>
  );
};

// Rendered inside a workspace section, which supplies the title and collapse.
const ListingRequestAgreementSummary = ({
  agreement,
  isLoading = false,
  acknowledge,
  buyerName = "The buyer",
}: ListingRequestAgreementSummaryProps) => {
  if (isLoading) {
    return <p className={classes.text}>Loading project agreement…</p>;
  }

  if (!agreement) {
    return <p className={classes.text}>No project agreement has been created for this commission yet.</p>;
  }

  return (
    <div className={classes.body}>
      <div className={classes.statusRow}>
        <span className={classes.badge}>{getListingRequestAgreementStatusLabel(agreement.status)}</span>
        <span>
          Version {agreement.version_number} · {getListingRequestAgreementStatusSummary(agreement.status)}
        </span>
      </div>
      <AgreementDetails agreement={agreement} acknowledge={acknowledge} buyerName={buyerName} />
    </div>
  );
};

export default ListingRequestAgreementSummary;
