import { hasErrorMessage } from "../../../lib/errorMessage";
import { formatMoney } from "../../../lib/formatMoney";
import {
  useState,
  type SubmitEventHandler,
} from "react";

import {
  hasListingRequestChangeOrderImpact,
  type ListingRequestChangeOrderImpact,
} from "../../../domain/listings/listingRequestChangeOrders";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import type { CreateListingRequestChangeOrderInput } from "../../../hooks/creatorRequests/useCreateListingRequestChangeOrder";
import type { ListingRequestChangeOrderRow } from "../../../hooks/creatorRequests/useListingRequestChangeOrders";

type ChangeOrderAgreement = Pick<
  ListingRequestAgreementRow,
  | "id"
  | "status"
  | "currency"
  | "total_amount"
  | "adjusted_estimated_completion_at"
> &
  // The payment plan, needed only when the total is being lowered.
  Partial<
    Pick<
      ListingRequestAgreementRow,
      "listing_request_payment_schedule_items"
    >
  >;

type ListingRequestChangeOrderBuilderProps = {
  requestStatus: string;
  agreement: ChangeOrderAgreement | null;
  // A change order the creator just withdrew. The form starts from its
  // details, so withdrawing and proposing again works as an edit.
  startFrom?: ChangeOrderStartingPoint | null;
  isPending?: boolean;
  error?: unknown;
  onCreateChangeOrder: (
    input: CreateListingRequestChangeOrderInput
  ) => Promise<unknown> | unknown;
};

type ChangeOrderStartingPoint = Pick<
  ListingRequestChangeOrderRow,
  | "title"
  | "summary"
  | "changes_scope"
  | "changes_price"
  | "changes_timeline"
  | "changes_deliverables"
  | "changes_payment_schedule"
  | "changes_milestones"
  | "revised_total_amount"
  | "revised_completion_at"
>;

type BuilderFormState = {
  title: string;
  summary: string;
  changesScope: boolean;
  changesPrice: boolean;
  changesTimeline: boolean;
  changesDeliverables: boolean;
  changesPaymentSchedule: boolean;
  changesMilestones: boolean;
  revisedTotalAmount: string;
  revisedCompletionDate: string;
  sendNow: boolean;
};

type BuilderValidationErrors = {
  title?: string;
  summary?: string;
  impact?: string;
  revisedTotalAmount?: string;
  revisedCompletionDate?: string;
  revisedPayments?: string;
};

const classes = {
  card: "card p-6",
  section: "space-y-5",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  field: "space-y-2",
  label: "formLabel",
  help: "formHint",
  input:
    "formControl",
  textarea:
    "formControl min-h-32",
  grid: "grid gap-4 sm:grid-cols-2",
  fieldset:
    "space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  legend: "px-1 text-sm font-bold text-zinc-900",
  checkboxGrid: "grid gap-3 sm:grid-cols-2",
  checkboxRow: "flex items-start gap-3",
  checkbox: "mt-1 h-4 w-4 rounded border-zinc-300",
  checkboxLabel: "text-sm font-semibold text-zinc-800",
  currentValue:
    "notice noticeNeutral",
  sendRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  errorText: "formError",
  errorBox:
    "notice noticeError",
} as const;

const defaultFormState: BuilderFormState = {
  title: "",
  summary: "",
  changesScope: false,
  changesPrice: false,
  changesTimeline: false,
  changesDeliverables: false,
  changesPaymentSchedule: false,
  changesMilestones: false,
  revisedTotalAmount: "",
  revisedCompletionDate: "",
  sendNow: true,
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));

const getDateInputIso = (value: string): string =>
  new Date(`${value}T12:00:00.000Z`).toISOString();

const getDateOnly = (value: string): string =>
  value.slice(0, 10);

// The earliest date the form accepts: tomorrow, by the creator's own
// calendar. The database refuses any date that has already passed.
const getEarliestCompletionDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");
};

const getStartingFormState = (
  startFrom?: ChangeOrderStartingPoint | null
): BuilderFormState =>
  startFrom
    ? {
        title: startFrom.title,
        summary: startFrom.summary,
        changesScope: startFrom.changes_scope,
        changesPrice: startFrom.changes_price,
        changesTimeline: startFrom.changes_timeline,
        changesDeliverables: startFrom.changes_deliverables,
        changesPaymentSchedule:
          startFrom.changes_payment_schedule,
        changesMilestones: startFrom.changes_milestones,
        revisedTotalAmount:
          startFrom.revised_total_amount === null
            ? ""
            : String(startFrom.revised_total_amount),
        revisedCompletionDate:
          startFrom.revised_completion_at
            ? getDateOnly(startFrom.revised_completion_at)
            : "",
        sendNow: true,
      }
    : defaultFormState;

const toCents = (value: number): number => Math.round(value * 100);

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The project change order could not be created.";

const getImpact = (
  form: BuilderFormState
): ListingRequestChangeOrderImpact => ({
  changesScope: form.changesScope,
  changesPrice: form.changesPrice,
  changesTimeline: form.changesTimeline,
  changesDeliverables: form.changesDeliverables,
  changesPaymentSchedule:
    form.changesPaymentSchedule,
  changesMilestones: form.changesMilestones,
});

const validateForm = (
  form: BuilderFormState,
  agreement: ChangeOrderAgreement
): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};
  const impact = getImpact(form);

  if (
    form.title.trim().length < 3 ||
    form.title.trim().length > 160
  ) {
    errors.title =
      "Change order title must be between 3 and 160 characters.";
  }

  if (
    form.summary.trim().length < 10 ||
    form.summary.trim().length > 4000
  ) {
    errors.summary =
      "Change order summary must be between 10 and 4000 characters.";
  }

  if (!hasListingRequestChangeOrderImpact(impact)) {
    errors.impact =
      "Select at least one project term being changed.";
  }

  if (form.changesPrice) {
    const revisedTotalAmount = Number.parseFloat(
      form.revisedTotalAmount
    );

    if (
      !Number.isFinite(revisedTotalAmount) ||
      revisedTotalAmount < 0
    ) {
      errors.revisedTotalAmount =
        "Enter a revised total amount of 0 or more.";
    } else if (
      revisedTotalAmount === agreement.total_amount
    ) {
      errors.revisedTotalAmount =
        "The revised total must differ from the current total.";
    }
  }

  if (form.changesTimeline) {
    if (!form.revisedCompletionDate) {
      errors.revisedCompletionDate =
        "Choose a revised completion date.";
    } else if (
      form.revisedCompletionDate ===
      getDateOnly(
        agreement.adjusted_estimated_completion_at
      )
    ) {
      errors.revisedCompletionDate =
        "The revised completion date must differ from the current date.";
    } else if (
      form.revisedCompletionDate <
      getEarliestCompletionDate()
    ) {
      errors.revisedCompletionDate =
        "The revised completion date must be in the future.";
    }
  }

  return errors;
};

const ListingRequestChangeOrderBuilder = ({
  requestStatus,
  agreement,
  startFrom,
  isPending = false,
  error,
  onCreateChangeOrder,
}: ListingRequestChangeOrderBuilderProps) => {
  const [form, setForm] =
    useState<BuilderFormState>(() =>
      getStartingFormState(startFrom)
    );

  const [validationErrors, setValidationErrors] =
    useState<BuilderValidationErrors>({});

  // What each payment not yet due becomes, when the total is lowered.
  // Keyed by payment; a payment not in here keeps its current amount.
  const [revisedPayments, setRevisedPayments] =
    useState<Record<string, string>>({});

  if (
    requestStatus !== "accepted" ||
    !agreement ||
    agreement.status !== "buyer_accepted"
  ) {
    return null;
  }

  const updateField = <
    Key extends keyof BuilderFormState,
  >(
    key: Key,
    value: BuilderFormState[Key]
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));

    setValidationErrors((currentErrors) => ({
      ...currentErrors,
      [key]: undefined,
      impact:
        key.startsWith("changes")
          ? undefined
          : currentErrors.impact,
    }));
  };

  // Lowering the total after some of it is paid: the payments already paid
  // or due are fixed, so the reduction has to come off the ones not yet due
  // (the database checks the same sums: migration 20261012_158).
  const schedule =
    agreement.listing_request_payment_schedule_items ?? [];

  const remainingPayments = schedule.filter(
    (payment) => payment.status === "pending"
  );

  const settledCents = schedule
    .filter(
      (payment) =>
        payment.status === "paid" ||
        payment.status === "payment_required"
    )
    .reduce(
      (total, payment) => total + toCents(payment.amount),
      0
    );

  const revisedTotal = Number.parseFloat(
    form.revisedTotalAmount
  );

  const lowersTotal =
    form.changesPrice &&
    Number.isFinite(revisedTotal) &&
    revisedTotal < agreement.total_amount;

  const getRevisedPayment = (payment: {
    id: string;
    amount: number;
  }): string =>
    revisedPayments[payment.id] ?? String(payment.amount);

  const remainingTargetCents =
    toCents(revisedTotal) - settledCents;

  const remainingCents = remainingPayments.reduce(
    (total, payment) =>
      total +
      toCents(
        Number.parseFloat(getRevisedPayment(payment)) || 0
      ),
    0
  );

  const getRevisedPaymentsError = (): string | undefined => {
    if (!lowersTotal) {
      return undefined;
    }

    if (remainingPayments.length === 0) {
      return "Nothing is left to pay on this project, so a change order cannot lower its price. Money already paid can only be returned as a refund.";
    }

    const amounts = remainingPayments.map((payment) =>
      Number.parseFloat(getRevisedPayment(payment))
    );

    if (
      amounts.some(
        (amount) => !Number.isFinite(amount) || amount < 0
      )
    ) {
      return "Enter an amount for every remaining payment.";
    }

    if (
      amounts.some(
        (amount, index) =>
          amount > remainingPayments[index].amount
      )
    ) {
      return "A lower total cannot raise a remaining payment.";
    }

    return remainingCents === remainingTargetCents
      ? undefined
      : `The remaining payments must add up to ${formatMoney(
          remainingTargetCents / 100,
          agreement.currency
        )}. They add up to ${formatMoney(
          remainingCents / 100,
          agreement.currency
        )}.`;
  };

  const handleSubmit: SubmitEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();

    const revisedPaymentsError = getRevisedPaymentsError();

    const nextErrors: BuilderValidationErrors = {
      ...validateForm(form, agreement),
      ...(revisedPaymentsError
        ? { revisedPayments: revisedPaymentsError }
        : {}),
    };

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const revisedTotalAmount = form.changesPrice
      ? Number.parseFloat(form.revisedTotalAmount)
      : null;

    const revisedCompletionAt =
      form.changesTimeline
        ? getDateInputIso(form.revisedCompletionDate)
        : null;

    const impact = getImpact(form);

    const input: CreateListingRequestChangeOrderInput =
    {
      agreementId: agreement.id,
      status: form.sendNow ? "sent" : "draft",
      title: form.title.trim(),
      summary: form.summary.trim(),
      changesScope: form.changesScope,
      changesPrice: form.changesPrice,
      changesTimeline: form.changesTimeline,
      changesDeliverables:
        form.changesDeliverables,
      changesPaymentSchedule:
        form.changesPaymentSchedule,
      changesMilestones: form.changesMilestones,
      revisedTotalAmount,
      revisedCompletionAt,
      proposedSnapshot: {
        summary: form.summary.trim(),
        impacts: impact,
        revised_total_amount:
          revisedTotalAmount,
        revised_completion_at:
          revisedCompletionAt,
        ...(lowersTotal
          ? {
              revised_payment_amounts:
                remainingPayments.map((payment) => ({
                  payment_schedule_item_id: payment.id,
                  amount: Number.parseFloat(
                    getRevisedPayment(payment)
                  ),
                })),
            }
          : {}),
      },
    };

    try {
      await onCreateChangeOrder(input);
    } catch {
      // Mutation error is surfaced through the error prop.
    }
  };

  const createErrorMessage = error
    ? getErrorMessage(error)
    : null;

  return (
    <form
      className={classes.card}
      onSubmit={handleSubmit}
    >
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Create project change order
          </h2>

          <p className={classes.text}>
            Formally document changes to the accepted
            project agreement. The changes do not become
            enforceable until the buyer accepts them.
          </p>
        </div>

        {startFrom && (
          <div className={classes.currentValue}>
            This starts from the change order you withdrew
            (“{startFrom.title}”). Change what you need,
            then send it.
          </div>
        )}

        {createErrorMessage && (
          <div className={classes.errorBox} role="alert">
            {createErrorMessage}
          </div>
        )}

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="change-order-title"
          >
            Change order title
          </label>

          <input
            className={classes.input}
            id="change-order-title"
            maxLength={160}
            value={form.title}
            onChange={(event) =>
              updateField(
                "title",
                event.currentTarget.value
              )
            }
          />

          {validationErrors.title && (
            <p className={classes.errorText}>
              {validationErrors.title}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="change-order-summary"
          >
            Proposed change details
          </label>

          <textarea
            className={classes.textarea}
            id="change-order-summary"
            maxLength={4000}
            value={form.summary}
            onChange={(event) =>
              updateField(
                "summary",
                event.currentTarget.value
              )
            }
          />

          <p className={classes.help}>
            Clearly describe what changes, why it is
            changing, and what the buyer will receive.
          </p>

          {validationErrors.summary && (
            <p className={classes.errorText}>
              {validationErrors.summary}
            </p>
          )}
        </div>

        <fieldset className={classes.fieldset}>
          <legend className={classes.legend}>
            Terms being changed
          </legend>

          <div className={classes.checkboxGrid}>
            <label className={classes.checkboxRow}>
              <input
                checked={form.changesScope}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesScope",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Scope
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesPrice}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesPrice",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Price
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesTimeline}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesTimeline",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Timeline
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesDeliverables}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesDeliverables",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Deliverables
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={
                  form.changesPaymentSchedule
                }
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesPaymentSchedule",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Payment schedule
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesMilestones}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesMilestones",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Milestones
              </span>
            </label>
          </div>

          {validationErrors.impact && (
            <p className={classes.errorText}>
              {validationErrors.impact}
            </p>
          )}
        </fieldset>

        {form.changesPrice && (
          <div className={classes.grid}>
            <div className={classes.field}>
              <div className={classes.label}>
                Current project total
              </div>

              <div className={classes.currentValue}>
                {formatMoney(
                  agreement.total_amount,
                  agreement.currency
                )}
              </div>
            </div>

            <div className={classes.field}>
              <label
                className={classes.label}
                htmlFor="change-order-total"
              >
                Revised project total
              </label>

              <input
                className={classes.input}
                id="change-order-total"
                min="0"
                step="0.01"
                type="number"
                value={form.revisedTotalAmount}
                onChange={(event) =>
                  updateField(
                    "revisedTotalAmount",
                    event.currentTarget.value
                  )
                }
              />

              {validationErrors.revisedTotalAmount && (
                <p className={classes.errorText}>
                  {
                    validationErrors.revisedTotalAmount
                  }
                </p>
              )}
            </div>
          </div>
        )}

        {lowersTotal && (
          <fieldset className={classes.fieldset}>
            <legend className={classes.legend}>
              Remaining payments
            </legend>

            <p className={classes.help}>
              This lowers the total, so say what each payment
              that is not yet due becomes. Payments already
              paid or due stay as they are (
              {formatMoney(
                settledCents / 100,
                agreement.currency
              )}
              ), so the payments below must add up to{" "}
              {formatMoney(
                remainingTargetCents / 100,
                agreement.currency
              )}
              . Money already paid can only be returned as a
              refund.
            </p>

            {remainingPayments.map((payment) => (
              <div
                className={classes.field}
                key={payment.id}
              >
                <label
                  className={classes.label}
                  htmlFor={`change-order-payment-${payment.id}`}
                >
                  {payment.title} (now{" "}
                  {formatMoney(
                    payment.amount,
                    agreement.currency
                  )}
                  )
                </label>

                <input
                  className={classes.input}
                  id={`change-order-payment-${payment.id}`}
                  max={payment.amount}
                  min="0"
                  step="0.01"
                  type="number"
                  value={getRevisedPayment(payment)}
                  onChange={(event) => {
                    const { value } = event.currentTarget;

                    setRevisedPayments((current) => ({
                      ...current,
                      [payment.id]: value,
                    }));

                    setValidationErrors((current) => ({
                      ...current,
                      revisedPayments: undefined,
                    }));
                  }}
                />
              </div>
            ))}

            {validationErrors.revisedPayments && (
              <p className={classes.errorText}>
                {validationErrors.revisedPayments}
              </p>
            )}
          </fieldset>
        )}

        {form.changesTimeline && (
          <div className={classes.grid}>
            <div className={classes.field}>
              <div className={classes.label}>
                Current completion date
              </div>

              <div className={classes.currentValue}>
                {formatDate(
                  agreement.adjusted_estimated_completion_at
                )}
              </div>
            </div>

            <div className={classes.field}>
              <label
                className={classes.label}
                htmlFor="change-order-completion"
              >
                Revised completion date
              </label>

              <input
                className={classes.input}
                id="change-order-completion"
                min={getEarliestCompletionDate()}
                type="date"
                value={form.revisedCompletionDate}
                onChange={(event) =>
                  updateField(
                    "revisedCompletionDate",
                    event.currentTarget.value
                  )
                }
              />

              {validationErrors.revisedCompletionDate && (
                <p className={classes.errorText}>
                  {
                    validationErrors.revisedCompletionDate
                  }
                </p>
              )}
            </div>
          </div>
        )}

        <label className={classes.sendRow}>
          <input
            checked={form.sendNow}
            className={classes.checkbox}
            type="checkbox"
            onChange={(event) =>
              updateField(
                "sendNow",
                event.currentTarget.checked
              )
            }
          />

          <span className={classes.checkboxLabel}>
            Send to the buyer now. Uncheck to save as a
            private draft.
          </span>
        </label>

        <div className={classes.actions}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="submit"
          >
            {isPending
              ? "Saving change order…"
              : form.sendNow
                ? "Create and send change order"
                : "Save change order draft"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestChangeOrderBuilder;