import { useMemo, useState, type SubmitEventHandler } from "react";

import {
  getMinimumCreatorUpdateRule,
  listingRequestPaymentStructureOptions,
  type ListingRequestPaymentStructure,
} from '../../../domain/listings/listingRequestAgreements';

import {
  validateListingRequestMilestonePlan,
  type ListingRequestMilestonePlanItem,
} from '../../../domain/listings/listingRequestMilestones';

import type { ListingRequestRow } from '../../../hooks/creatorRequests/useMyCreatorRequests';

import type { CreateListingRequestAgreementInput } from '../../../hooks/creatorRequests/useCreateListingRequestAgreement';

import { getInstalmentFloorMessage } from '../../../domain/payments/supportedCurrencies';

import ListingRequestMilestonePlanEditor from '../milestones/ListingRequestMilestonePlanEditor';
type ListingRequestAgreementBuilderProps = {
  request: Pick<ListingRequestRow, "id" | "status"> | null;
  isPending?: boolean;
  error?: unknown;
  currency?: string;
  onCreateAgreement: (
    input: CreateListingRequestAgreementInput
  ) => Promise<unknown> | unknown;
};

type BuilderFormState = {
  scopeSummary: string;
  includedDeliverablesText: string;
  checklistText: string;
  totalAmount: string;
  paymentStructure: ListingRequestPaymentStructure;
  depositAmount: string;
  estimatedWorkDays: string;
  estimatedCompletionDate: string;
  includedRevisionCount: string;
  additionalCostPolicy: string;
  revisionPolicy: string;
  sendNow: boolean;
  milestones: ListingRequestMilestonePlanItem[];
};

type BuilderValidationErrors = Partial<
  Record<
    Exclude<keyof BuilderFormState, "milestones">,
    string
  >
> & {
  milestones?: string[];
};

const classes = {
  card: "card p-6",
  section: "space-y-5",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  grid: "grid gap-4 sm:grid-cols-2",
  field: "space-y-2",
  label: "formLabel",
  help: "formHint",
  input:
    "formControl",
  textarea:
    "formControl min-h-28",
  checkboxRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkbox: "mt-1 h-4 w-4 rounded border-zinc-300",
  checkboxLabel: "text-sm font-semibold text-zinc-800",
  errorText: "formError",
  errorBox:
    "notice noticeError",
  updateBox:
    "notice noticeNeutral",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
} as const;

const createDefaultMilestones =
  (): ListingRequestMilestonePlanItem[] => [
    {
      title: "",
      description: "",
      amount: 0,
      sortOrder: 0,
    },
    {
      title: "",
      description: "",
      amount: 0,
      sortOrder: 1,
    },
  ];

const defaultFormState: BuilderFormState = {
  scopeSummary: "",
  includedDeliverablesText: "",
  checklistText: "",
  totalAmount: "",
  paymentStructure: "deposit_balance",
  depositAmount: "",
  estimatedWorkDays: "14",
  estimatedCompletionDate: "",
  includedRevisionCount: "2",
  additionalCostPolicy:
    "Any additional scope, deliverables, timeline, price, payment schedule, or milestone changes require an accepted change order before work continues.",
  revisionPolicy:
    "This agreement includes the listed revision rounds. Extra revisions require an accepted change order before additional work continues.",
  sendNow: true,
  milestones: createDefaultMilestones(),
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project agreement could not be created.";

const splitTextareaLines = (value: string): string[] =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const parsePositiveNumber = (value: string): number =>
  Number.parseFloat(value.trim());

const parseWholeNumber = (value: string): number =>
  Number.parseInt(value.trim(), 10);

const getIsoFromDateInput = (dateInput: string): string =>
  new Date(`${dateInput}T12:00:00.000Z`).toISOString();

const validateForm = (
  form: BuilderFormState,
  currency: string,
): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};
  const totalAmount = parsePositiveNumber(form.totalAmount);
  const depositAmount = parsePositiveNumber(form.depositAmount);
  const estimatedWorkDays = parseWholeNumber(form.estimatedWorkDays);
  const includedRevisionCount = parseWholeNumber(form.includedRevisionCount);

  if (!form.scopeSummary.trim()) {
    errors.scopeSummary = "Add a scope summary.";
  }

  if (splitTextareaLines(form.includedDeliverablesText).length === 0) {
    errors.includedDeliverablesText = "Add at least one included deliverable.";
  }

  if (splitTextareaLines(form.checklistText).length === 0) {
    errors.checklistText = "Add at least one required checklist item.";
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    errors.totalAmount = "Enter a total amount greater than 0.";
  }

  if (form.paymentStructure === "deposit_balance") {
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      errors.depositAmount = "Enter a deposit amount greater than 0.";
    } else if (Number.isFinite(totalAmount) && depositAmount >= totalAmount) {
      errors.depositAmount = "Deposit must be less than the total amount.";
    }
  }

  if (!Number.isFinite(estimatedWorkDays) || estimatedWorkDays <= 0) {
    errors.estimatedWorkDays = "Enter estimated work days greater than 0.";
  }

  if (form.paymentStructure === "milestone_payments") {
    const milestoneValidation =
      validateListingRequestMilestonePlan({
        estimatedWorkDays,
        agreementTotal: totalAmount,
        milestones: form.milestones,
      });

    if (!milestoneValidation.isValid) {
      errors.milestones =
        milestoneValidation.errors;
    }
  }

  // The instalment floor and supported currencies are enforced by the
  // database (20260923_138); checking here says so before sending.
  if (!errors.totalAmount && form.paymentStructure === "full_prepayment") {
    const floorMessage = getInstalmentFloorMessage(totalAmount, currency);
    if (floorMessage) errors.totalAmount = floorMessage;
  }

  if (
    !errors.totalAmount &&
    !errors.depositAmount &&
    form.paymentStructure === "deposit_balance"
  ) {
    const depositMessage = getInstalmentFloorMessage(depositAmount, currency);
    const balanceMessage = getInstalmentFloorMessage(
      totalAmount - depositAmount,
      currency,
    );

    if (depositMessage) {
      errors.depositAmount = `Deposit: ${depositMessage}`;
    } else if (balanceMessage) {
      errors.depositAmount = `Remaining balance: ${balanceMessage}`;
    }
  }

  if (!errors.milestones && form.paymentStructure === "milestone_payments") {
    const milestoneFloorErrors = form.milestones
      .map((milestone) => {
        const floorMessage = getInstalmentFloorMessage(milestone.amount, currency);
        return floorMessage
          ? `${milestone.title.trim() || "Milestone"}: ${floorMessage}`
          : null;
      })
      .filter((message): message is string => message !== null);

    if (milestoneFloorErrors.length > 0) {
      errors.milestones = milestoneFloorErrors;
    }
  }

  if (!form.estimatedCompletionDate) {
    errors.estimatedCompletionDate = "Choose an estimated completion date.";
  }

  if (!Number.isFinite(includedRevisionCount) || includedRevisionCount < 0) {
    errors.includedRevisionCount = "Enter 0 or more included revisions.";
  }

  if (!form.additionalCostPolicy.trim()) {
    errors.additionalCostPolicy = "Add an additional cost policy.";
  }

  if (!form.revisionPolicy.trim()) {
    errors.revisionPolicy = "Add a revision policy.";
  }

  return errors;
};

const buildPaymentScheduleItems = (input: {
  paymentStructure: ListingRequestPaymentStructure;
  totalAmount: number;
  depositAmount: number | null;
  currency: string;
  milestones: ListingRequestMilestonePlanItem[];
}): CreateListingRequestAgreementInput["paymentScheduleItems"] => {
  if (input.paymentStructure === "full_prepayment") {
    return [
      {
        title: "Full project payment",
        description: "Due before work starts.",
        amount: input.totalAmount,
        currency: input.currency,
        payment_timing: "due_before_work_starts",
        status: "payment_required",
        due_at: null,
        sort_order: 0,
      },
    ];
  }

  if (input.paymentStructure === "deposit_balance") {
    const safeDepositAmount = input.depositAmount ?? 0;

    return [
      {
        title: "Project deposit",
        description: "Due before work starts.",
        amount: safeDepositAmount,
        currency: input.currency,
        payment_timing: "due_before_work_starts",
        status: "payment_required",
        due_at: null,
        sort_order: 0,
      },
      {
        title: "Remaining balance",
        description: "Due before final deliverables are released.",
        amount: Math.max(0, input.totalAmount - safeDepositAmount),
        currency: input.currency,
        payment_timing: "due_before_final_release",
        status: "pending",
        due_at: null,
        sort_order: 1,
      },
    ];
  }

  return input.milestones.map((milestone) => ({
    agreement_item_client_key:
      `milestone:${milestone.sortOrder}`,
    title: milestone.title.trim(),
    description:
      milestone.description?.trim() ||
      "Payment becomes due after the buyer approves this milestone.",
    amount: milestone.amount,
    currency: input.currency,
    payment_timing:
      "due_at_milestone_approval",
    status: "pending",
    due_at: null,
    sort_order: milestone.sortOrder,
  }));
};

const ListingRequestAgreementBuilder = ({
  request,
  isPending = false,
  error,
  currency = "cad",
  onCreateAgreement,
}: ListingRequestAgreementBuilderProps) => {
  const [form, setForm] = useState<BuilderFormState>(defaultFormState);
  const [validationErrors, setValidationErrors] =
    useState<BuilderValidationErrors>({});

  const estimatedWorkDays = parseWholeNumber(form.estimatedWorkDays);
  const safeEstimatedWorkDays = Number.isFinite(estimatedWorkDays)
    ? estimatedWorkDays
    : 1;

  const parsedTotalAmount =
    parsePositiveNumber(form.totalAmount);

  const safeTotalAmount = Number.isFinite(
    parsedTotalAmount
  )
    ? parsedTotalAmount
    : 0;


  const updateRule = useMemo(
    () => getMinimumCreatorUpdateRule(safeEstimatedWorkDays),
    [safeEstimatedWorkDays]
  );

  if (!request || request.status !== "accepted") {
    return null;
  }

  const updateField = <Key extends keyof BuilderFormState>(
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
    }));
  };

  const updateMilestones = (
    milestones: ListingRequestMilestonePlanItem[]
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      milestones,
    }));

    setValidationErrors((currentErrors) => ({
      ...currentErrors,
      milestones: undefined,
    }));
  };

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form, currency);
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const totalAmount = parsePositiveNumber(form.totalAmount);
    const depositAmount =
      form.paymentStructure === "deposit_balance"
        ? parsePositiveNumber(form.depositAmount)
        : null;
    const estimatedWorkDays = parseWholeNumber(form.estimatedWorkDays);
    const includedRevisionCount = parseWholeNumber(form.includedRevisionCount);
    const estimatedCompletionAt = getIsoFromDateInput(
      form.estimatedCompletionDate
    );

    const checklistItems = splitTextareaLines(
      form.checklistText
    ).map((title, index) => ({
      title,
      description: null,
      item_type: "included" as const,
      price_amount: null,
      timeline_impact_days: 0,
      payment_timing:
        "included_no_extra_charge" as const,
      is_required: true,
      is_selected: true,
      sort_order: index,
    }));

    const milestoneItems =
      form.paymentStructure ===
        "milestone_payments"
        ? form.milestones.map((milestone) => ({
          client_key:
            `milestone:${milestone.sortOrder}`,
          title: milestone.title.trim(),
          description:
            milestone.description?.trim() ||
            null,
          item_type: "milestone" as const,
          price_amount: milestone.amount,
          timeline_impact_days: 0,
          payment_timing:
            "due_at_milestone_approval" as const,
          is_required: true,
          is_selected: true,
          sort_order:
            checklistItems.length +
            milestone.sortOrder,
        }))
        : [];

    const input: CreateListingRequestAgreementInput = {
      listingRequestId: request.id,
      status: form.sendNow ? "sent" : "draft",
      paymentStructure: form.paymentStructure,
      startingPaymentStatus:
        form.paymentStructure ===
          "milestone_payments"
          ? "not_required"
          : "payment_required",
      currency,
      baseAmount: totalAmount,
      totalAmount,
      depositAmount,
      estimatedStartAt: null,
      estimatedCompletionAt,
      lateDeliveryGraceDays: 3,
      includedRevisionCount,
      minimumUpdateRule: updateRule,
      scopeSummary: form.scopeSummary.trim(),
      includedDeliverables: splitTextareaLines(form.includedDeliverablesText),
      additionalCostPolicy: form.additionalCostPolicy.trim(),
      revisionPolicy: form.revisionPolicy.trim(),
      updateScheduleSummary: updateRule.summary,
      items: [
        ...checklistItems,
        ...milestoneItems,
      ],
      paymentScheduleItems:
        buildPaymentScheduleItems({
          paymentStructure:
            form.paymentStructure,
          totalAmount,
          depositAmount,
          currency,
          milestones: form.milestones,
        }),
    };

    await onCreateAgreement(input);
  };

  const createErrorMessage = error ? getErrorMessage(error) : null;

  return (
    <form className={classes.card} onSubmit={handleSubmit}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Create project agreement</h2>
          <p className={classes.text}>
            Turn the accepted commission request into a formal agreement the buyer must
            review and accept before payment or work begins.
          </p>
        </div>

        {createErrorMessage && (
          <div className={classes.errorBox}>{createErrorMessage}</div>
        )}

        <div className={classes.field}>
          <label className={classes.label} htmlFor="agreement-scope-summary">
            Scope summary
          </label>
          <textarea
            className={classes.textarea}
            id="agreement-scope-summary"
            value={form.scopeSummary}
            onChange={(event) =>
              updateField("scopeSummary", event.currentTarget.value)
            }
          />
          {validationErrors.scopeSummary && (
            <p className={classes.errorText}>
              {validationErrors.scopeSummary}
            </p>
          )}
        </div>

        <div className={classes.grid}>
          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="agreement-included-deliverables"
            >
              Included deliverables
            </label>
            <textarea
              className={classes.textarea}
              id="agreement-included-deliverables"
              value={form.includedDeliverablesText}
              onChange={(event) =>
                updateField(
                  "includedDeliverablesText",
                  event.currentTarget.value
                )
              }
            />
            <p className={classes.help}>Add one deliverable per line.</p>
            {validationErrors.includedDeliverablesText && (
              <p className={classes.errorText}>
                {validationErrors.includedDeliverablesText}
              </p>
            )}
          </div>

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-checklist">
              Required checklist items
            </label>
            <textarea
              className={classes.textarea}
              id="agreement-checklist"
              value={form.checklistText}
              onChange={(event) =>
                updateField("checklistText", event.currentTarget.value)
              }
            />
            <p className={classes.help}>Add one required scope item per line.</p>
            {validationErrors.checklistText && (
              <p className={classes.errorText}>
                {validationErrors.checklistText}
              </p>
            )}
          </div>
        </div>

        <div className={classes.grid}>
          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-total-amount">
              Total amount
            </label>
            <input
              className={classes.input}
              id="agreement-total-amount"
              min="0"
              step="0.01"
              type="number"
              value={form.totalAmount}
              onChange={(event) =>
                updateField("totalAmount", event.currentTarget.value)
              }
            />
            {validationErrors.totalAmount && (
              <p className={classes.errorText}>
                {validationErrors.totalAmount}
              </p>
            )}
          </div>

          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="agreement-payment-structure"
            >
              Payment structure
            </label>
            <select
              className={classes.input}
              id="agreement-payment-structure"
              value={form.paymentStructure}
              onChange={(event) =>
                updateField(
                  "paymentStructure",
                  event.currentTarget.value as ListingRequestPaymentStructure
                )
              }
            >
              {listingRequestPaymentStructureOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {form.paymentStructure ===
            "milestone_payments" && (
              <ListingRequestMilestonePlanEditor
                agreementTotal={safeTotalAmount}
                currency={currency}
                disabled={isPending}
                estimatedWorkDays={
                  safeEstimatedWorkDays
                }
                milestones={form.milestones}
                validationErrors={
                  validationErrors.milestones ?? []
                }
                onChange={updateMilestones}
              />
            )}

          {form.paymentStructure === "deposit_balance" && (
            <div className={classes.field}>
              <label
                className={classes.label}
                htmlFor="agreement-deposit-amount"
              >
                Deposit amount
              </label>
              <input
                className={classes.input}
                id="agreement-deposit-amount"
                min="0"
                step="0.01"
                type="number"
                value={form.depositAmount}
                onChange={(event) =>
                  updateField("depositAmount", event.currentTarget.value)
                }
              />
              {validationErrors.depositAmount && (
                <p className={classes.errorText}>
                  {validationErrors.depositAmount}
                </p>
              )}
            </div>
          )}

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-work-days">
              Estimated work days
            </label>
            <input
              className={classes.input}
              id="agreement-work-days"
              min="1"
              type="number"
              value={form.estimatedWorkDays}
              onChange={(event) =>
                updateField("estimatedWorkDays", event.currentTarget.value)
              }
            />
            {validationErrors.estimatedWorkDays && (
              <p className={classes.errorText}>
                {validationErrors.estimatedWorkDays}
              </p>
            )}
          </div>

          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="agreement-estimated-completion"
            >
              Estimated completion date
            </label>
            <input
              className={classes.input}
              id="agreement-estimated-completion"
              type="date"
              value={form.estimatedCompletionDate}
              onChange={(event) =>
                updateField("estimatedCompletionDate", event.currentTarget.value)
              }
            />
            {validationErrors.estimatedCompletionDate && (
              <p className={classes.errorText}>
                {validationErrors.estimatedCompletionDate}
              </p>
            )}
          </div>

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-revision-count">
              Included revision count
            </label>
            <input
              className={classes.input}
              id="agreement-revision-count"
              min="0"
              type="number"
              value={form.includedRevisionCount}
              onChange={(event) =>
                updateField("includedRevisionCount", event.currentTarget.value)
              }
            />
            {validationErrors.includedRevisionCount && (
              <p className={classes.errorText}>
                {validationErrors.includedRevisionCount}
              </p>
            )}
          </div>
        </div>

        <div className={classes.updateBox}>
          <strong>{updateRule.label}</strong>
          <p>{updateRule.summary}</p>
        </div>

        <div className={classes.field}>
          <label className={classes.label} htmlFor="agreement-additional-cost">
            Additional cost policy
          </label>
          <textarea
            className={classes.textarea}
            id="agreement-additional-cost"
            value={form.additionalCostPolicy}
            onChange={(event) =>
              updateField("additionalCostPolicy", event.currentTarget.value)
            }
          />
          {validationErrors.additionalCostPolicy && (
            <p className={classes.errorText}>
              {validationErrors.additionalCostPolicy}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label className={classes.label} htmlFor="agreement-revision-policy">
            Revision policy
          </label>
          <textarea
            className={classes.textarea}
            id="agreement-revision-policy"
            value={form.revisionPolicy}
            onChange={(event) =>
              updateField("revisionPolicy", event.currentTarget.value)
            }
          />
          {validationErrors.revisionPolicy && (
            <p className={classes.errorText}>
              {validationErrors.revisionPolicy}
            </p>
          )}
        </div>

        <label className={classes.checkboxRow}>
          <input
            checked={form.sendNow}
            className={classes.checkbox}
            type="checkbox"
            onChange={(event) =>
              updateField("sendNow", event.currentTarget.checked)
            }
          />
          <span className={classes.checkboxLabel}>
            Send to buyer now. Uncheck to save as a draft.
          </span>
        </label>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="submit"
          >
            {isPending
              ? "Saving agreement…"
              : form.sendNow
                ? "Create and send agreement"
                : "Save agreement draft"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestAgreementBuilder;