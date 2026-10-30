import { hasErrorMessage } from "../../../lib/errorMessage";
import { useMemo, useState, type SubmitEventHandler } from "react";

import {
  getListingRequestPaymentStructureLabel,
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
import KeptPlaceholder from "../../ui/KeptPlaceholder";
import { useT, type Translate } from "../../../lib/i18n/i18n";
type ListingRequestAgreementBuilderProps = {
  request: Pick<ListingRequestRow, "id" | "status"> | null;
  // The buyer's handle or display name, for the two "what … needs to" boxes.
  buyerName?: string;
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
  // Checklist lines that are the buyer's to do (20261008_153).
  buyerProvidesText: string;
  buyerApprovesText: string;
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

// The two policies start in the creator's language and are saved as written.
const createDefaultFormState = (t: Translate): BuilderFormState => ({
  scopeSummary: "",
  includedDeliverablesText: "",
  checklistText: "",
  buyerProvidesText: "",
  buyerApprovesText: "",
  totalAmount: "",
  paymentStructure: "deposit_balance",
  depositAmount: "",
  estimatedWorkDays: "14",
  estimatedCompletionDate: "",
  includedRevisionCount: "2",
  additionalCostPolicy: t("agreementBuilder.defaultCostPolicy"),
  revisionPolicy: t("agreementBuilder.defaultRevisionPolicy"),
  sendNow: true,
  milestones: createDefaultMilestones(),
});

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("agreementBuilder.failed");

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
  t: Translate,
): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};
  const totalAmount = parsePositiveNumber(form.totalAmount);
  const depositAmount = parsePositiveNumber(form.depositAmount);
  const estimatedWorkDays = parseWholeNumber(form.estimatedWorkDays);
  const includedRevisionCount = parseWholeNumber(form.includedRevisionCount);

  if (!form.scopeSummary.trim()) {
    errors.scopeSummary = t("agreementBuilder.errorScope");
  }

  if (splitTextareaLines(form.includedDeliverablesText).length === 0) {
    errors.includedDeliverablesText = t("agreementBuilder.errorDeliverables");
  }

  if (
    splitTextareaLines(form.checklistText).length +
      splitTextareaLines(form.buyerProvidesText).length +
      splitTextareaLines(form.buyerApprovesText).length ===
    0
  ) {
    errors.checklistText = t("agreementBuilder.errorChecklist");
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    errors.totalAmount = t("agreementBuilder.errorTotal");
  }

  if (form.paymentStructure === "deposit_balance") {
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      errors.depositAmount = t("agreementBuilder.errorDeposit");
    } else if (Number.isFinite(totalAmount) && depositAmount >= totalAmount) {
      errors.depositAmount = t("agreementBuilder.errorDepositTotal");
    }
  }

  if (!Number.isFinite(estimatedWorkDays) || estimatedWorkDays <= 0) {
    errors.estimatedWorkDays = t("agreementBuilder.errorDays");
  }

  if (form.paymentStructure === "milestone_payments") {
    const milestoneValidation =
      validateListingRequestMilestonePlan({
        estimatedWorkDays,
        agreementTotal: totalAmount,
        milestones: form.milestones,
      }, t);

    if (!milestoneValidation.isValid) {
      errors.milestones =
        milestoneValidation.errors;
    }
  }

  // The instalment floor and supported currencies are enforced by the
  // database (20260923_138); checking here says so before sending.
  if (!errors.totalAmount && form.paymentStructure === "full_prepayment") {
    const floorMessage = getInstalmentFloorMessage(totalAmount, currency, t);
    if (floorMessage) errors.totalAmount = floorMessage;
  }

  if (
    !errors.totalAmount &&
    !errors.depositAmount &&
    form.paymentStructure === "deposit_balance"
  ) {
    const depositMessage = getInstalmentFloorMessage(depositAmount, currency, t);
    const balanceMessage = getInstalmentFloorMessage(
      totalAmount - depositAmount,
      currency,
      t,
    );

    if (depositMessage) {
      errors.depositAmount = t("agreementBuilder.depositError", { message: depositMessage });
    } else if (balanceMessage) {
      errors.depositAmount = t("agreementBuilder.balanceError", { message: balanceMessage });
    }
  }

  if (!errors.milestones && form.paymentStructure === "milestone_payments") {
    const milestoneFloorErrors = form.milestones
      .map((milestone) => {
        const floorMessage = getInstalmentFloorMessage(milestone.amount, currency, t);
        return floorMessage
          ? t("agreementBuilder.milestoneError", {
              title: milestone.title.trim() || t("agreementBuilder.milestoneFallback"),
              message: floorMessage,
            })
          : null;
      })
      .filter((message): message is string => message !== null);

    if (milestoneFloorErrors.length > 0) {
      errors.milestones = milestoneFloorErrors;
    }
  }

  if (!form.estimatedCompletionDate) {
    errors.estimatedCompletionDate = t("agreementBuilder.errorDate");
  }

  if (!Number.isFinite(includedRevisionCount) || includedRevisionCount < 0) {
    errors.includedRevisionCount = t("agreementBuilder.errorRevisions");
  }

  if (!form.additionalCostPolicy.trim()) {
    errors.additionalCostPolicy = t("agreementBuilder.errorCostPolicy");
  }

  if (!form.revisionPolicy.trim()) {
    errors.revisionPolicy = t("agreementBuilder.errorRevisionPolicy");
  }

  return errors;
};

// Titles and descriptions are saved in the creator's language, like the rest
// of what they write in the agreement. Nothing matches on them.
const buildPaymentScheduleItems = (input: {
  paymentStructure: ListingRequestPaymentStructure;
  totalAmount: number;
  depositAmount: number | null;
  currency: string;
  milestones: ListingRequestMilestonePlanItem[];
}, t: Translate): CreateListingRequestAgreementInput["paymentScheduleItems"] => {
  if (input.paymentStructure === "full_prepayment") {
    return [
      {
        title: t("agreementBuilder.paymentFull"),
        description: t("agreementBuilder.dueBeforeWork"),
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
        title: t("agreementBuilder.paymentDeposit"),
        description: t("agreementBuilder.dueBeforeWork"),
        amount: safeDepositAmount,
        currency: input.currency,
        payment_timing: "due_before_work_starts",
        status: "payment_required",
        due_at: null,
        sort_order: 0,
      },
      {
        title: t("agreementBuilder.paymentBalance"),
        description: t("agreementBuilder.dueBeforeRelease"),
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
      t("agreementBuilder.dueAfterMilestone"),
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
  buyerName,
  onCreateAgreement,
}: ListingRequestAgreementBuilderProps) => {
  const t = useT();
  const buyer = buyerName ?? t("agreementBuilder.theBuyer");
  const [form, setForm] = useState<BuilderFormState>(() => createDefaultFormState(t));
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
    () => getMinimumCreatorUpdateRule(safeEstimatedWorkDays, t),
    [safeEstimatedWorkDays, t]
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

    const nextErrors = validateForm(form, currency, t);
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const totalAmount = parsePositiveNumber(form.totalAmount);
    const depositAmount =
      form.paymentStructure === "deposit_balance"
        ? parsePositiveNumber(form.depositAmount)
        : null;
    const includedRevisionCount = parseWholeNumber(form.includedRevisionCount);
    const estimatedCompletionAt = getIsoFromDateInput(
      form.estimatedCompletionDate
    );

    const checklistItems = (
      [
        ["included", form.checklistText],
        ["buyer_provides", form.buyerProvidesText],
        ["buyer_approves", form.buyerApprovesText],
      ] as const
    )
      .flatMap(([itemType, text]) =>
        splitTextareaLines(text).map((title) => ({ title, itemType }))
      )
      .map(({ title, itemType }, index) => ({
      title,
      description: null,
      item_type: itemType,
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
        }, t),
    };

    await onCreateAgreement(input);
  };

  const createErrorMessage = error ? getErrorMessage(error, t) : null;

  return (
    <form className={classes.card} onSubmit={handleSubmit}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>{t("creatorCommission.agreementPanelTitle")}</h2>
          <p className={classes.text}>{t("agreementBuilder.intro")}</p>
        </div>

        {createErrorMessage && (
          <div className={classes.errorBox}>{createErrorMessage}</div>
        )}

        <div className={classes.field}>
          <label className={classes.label} htmlFor="agreement-scope-summary">
            {t("agreementBuilder.scopeLabel")}
          </label>
          <KeptPlaceholder>
          <textarea
            className={classes.textarea}
            id="agreement-scope-summary"
            placeholder={t("agreementBuilder.scopePlaceholder")}
            value={form.scopeSummary}
            onChange={(event) =>
              updateField("scopeSummary", event.currentTarget.value)
            }
          />
          </KeptPlaceholder>
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
              {t("agreementBuilder.deliverablesLabel")}
            </label>
            <KeptPlaceholder>
            <textarea
              className={classes.textarea}
              id="agreement-included-deliverables"
              placeholder={t("agreementBuilder.deliverablesPlaceholder")}
              value={form.includedDeliverablesText}
              onChange={(event) =>
                updateField(
                  "includedDeliverablesText",
                  event.currentTarget.value
                )
              }
            />
            </KeptPlaceholder>
            <p className={classes.help}>{t("agreementBuilder.deliverablesHint")}</p>
            {validationErrors.includedDeliverablesText && (
              <p className={classes.errorText}>
                {validationErrors.includedDeliverablesText}
              </p>
            )}
          </div>

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-checklist">
              {t("agreementBuilder.checklistLabel")}
            </label>
            <KeptPlaceholder>
            <textarea
              className={classes.textarea}
              id="agreement-checklist"
              placeholder={t("agreementBuilder.checklistPlaceholder")}
              value={form.checklistText}
              onChange={(event) =>
                updateField("checklistText", event.currentTarget.value)
              }
            />
            </KeptPlaceholder>
            <p className={classes.help}>
              {t("agreementBuilder.checklistHint")}
            </p>
            {validationErrors.checklistText && (
              <p className={classes.errorText}>
                {validationErrors.checklistText}
              </p>
            )}
          </div>

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-buyer-provides">
              {t("agreementBuilder.providesLabel", { name: buyer })}
            </label>
            <KeptPlaceholder>
            <textarea
              className={classes.textarea}
              id="agreement-buyer-provides"
              placeholder={t("agreementBuilder.providesPlaceholder")}
              value={form.buyerProvidesText}
              onChange={(event) =>
                updateField("buyerProvidesText", event.currentTarget.value)
              }
            />
            </KeptPlaceholder>
            <p className={classes.help}>
              {t("agreementBuilder.providesHint", { name: buyer })}
            </p>
          </div>

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-buyer-approves">
              {t("agreementBuilder.approvesLabel", { name: buyer })}
            </label>
            <KeptPlaceholder>
            <textarea
              className={classes.textarea}
              id="agreement-buyer-approves"
              placeholder={t("agreementBuilder.approvesPlaceholder")}
              value={form.buyerApprovesText}
              onChange={(event) =>
                updateField("buyerApprovesText", event.currentTarget.value)
              }
            />
            </KeptPlaceholder>
            <p className={classes.help}>
              {t("agreementBuilder.approvesHint", { name: buyer })}
            </p>
          </div>
        </div>

        <div className={classes.grid}>
          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-total-amount">
              {t("agreementBuilder.totalLabel")}
            </label>
            <KeptPlaceholder>
            <input
              className={classes.input}
              id="agreement-total-amount"
              placeholder={t("agreementBuilder.totalPlaceholder")}
              min="0"
              step="0.01"
              type="number"
              value={form.totalAmount}
              onChange={(event) =>
                updateField("totalAmount", event.currentTarget.value)
              }
            />
            </KeptPlaceholder>
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
              {t("agreement.paymentStructure")}
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
                  {getListingRequestPaymentStructureLabel(option.value, t)}
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
                {t("agreementBuilder.depositLabel")}
              </label>
              <KeptPlaceholder>
              <input
                className={classes.input}
                id="agreement-deposit-amount"
                placeholder={t("agreementBuilder.depositPlaceholder")}
                min="0"
                step="0.01"
                type="number"
                value={form.depositAmount}
                onChange={(event) =>
                  updateField("depositAmount", event.currentTarget.value)
                }
              />
              </KeptPlaceholder>
              {validationErrors.depositAmount && (
                <p className={classes.errorText}>
                  {validationErrors.depositAmount}
                </p>
              )}
            </div>
          )}

          <div className={classes.field}>
            <label className={classes.label} htmlFor="agreement-work-days">
              {t("agreementBuilder.daysLabel")}
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
              {t("agreementBuilder.dateLabel")}
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
              {t("agreementBuilder.revisionsLabel")}
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
            {t("agreementBuilder.costLabel")}
          </label>
          <KeptPlaceholder>
          <textarea
            className={classes.textarea}
            id="agreement-additional-cost"
            placeholder={t("agreementBuilder.costPlaceholder")}
            value={form.additionalCostPolicy}
            onChange={(event) =>
              updateField("additionalCostPolicy", event.currentTarget.value)
            }
          />
          </KeptPlaceholder>
          {validationErrors.additionalCostPolicy && (
            <p className={classes.errorText}>
              {validationErrors.additionalCostPolicy}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label className={classes.label} htmlFor="agreement-revision-policy">
            {t("agreementBuilder.revisionLabel")}
          </label>
          <KeptPlaceholder>
          <textarea
            className={classes.textarea}
            id="agreement-revision-policy"
            placeholder={t("agreementBuilder.revisionPlaceholder")}
            value={form.revisionPolicy}
            onChange={(event) =>
              updateField("revisionPolicy", event.currentTarget.value)
            }
          />
          </KeptPlaceholder>
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
            {t("agreementBuilder.sendNow")}
          </span>
        </label>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="submit"
          >
            {t(
              isPending
                ? "agreementBuilder.saving"
                : form.sendNow
                  ? "agreementBuilder.createAndSend"
                  : "agreementBuilder.saveDraft"
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestAgreementBuilder;