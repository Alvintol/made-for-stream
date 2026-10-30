import { formatMoney } from "../../../lib/formatMoney";
import {
  allowsMilestonePayments,
} from '../../../domain/listings/listingRequestAgreements';

import {
  getListingRequestMilestonePlanTotal,
  type ListingRequestMilestonePlanItem,
} from '../../../domain/listings/listingRequestMilestones';
import KeptPlaceholder from "../../ui/KeptPlaceholder";
import { useT } from "../../../lib/i18n/i18n";
type ListingRequestMilestonePlanEditorProps = {
  milestones: ListingRequestMilestonePlanItem[];
  agreementTotal: number;
  estimatedWorkDays: number;
  currency?: string;
  validationErrors?: string[];
  disabled?: boolean;
  onChange: (
    milestones: ListingRequestMilestonePlanItem[]
  ) => void;
};

const classes = {
  card:
    "space-y-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-5",
  header:
    "flex flex-wrap items-start justify-between gap-3",
  heading: "space-y-1",
  title: "text-sm font-extrabold text-zinc-900",
  text: "text-sm text-zinc-600",
  notice:
    "notice noticeWarning",
  eligibleNotice:
    "notice noticeSuccess",
  list: "space-y-4",
  item:
    "space-y-4 rounded-2xl border border-zinc-200 bg-white p-4",
  itemHeader:
    "flex flex-wrap items-center justify-between gap-3",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemActions: "flex flex-wrap items-center gap-2",
  grid: "grid gap-4 sm:grid-cols-2",
  field: "space-y-2",
  fullField: "space-y-2 sm:col-span-2",
  label: "formLabel",
  input:
    "formControl",
  textarea:
    "formControl min-h-24",
  summaryGrid: "grid gap-3 sm:grid-cols-3",
  summaryItem:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-3",
  summaryLabel:
    "text-xs font-bold uppercase tracking-wide text-zinc-500",
  summaryValue:
    "mt-1 text-sm font-extrabold text-zinc-900",
  match:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900",
  mismatch:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900",
  errors:
    "space-y-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  errorItem: "list-disc ml-5",
  btnOutline:
    "btnOutline btnSm",
  btnDanger:
    "btnDangerOutline btnSm",
  btnAdd:
    "btnOutline",
} as const;

const roundCurrencyAmount = (
  amount: number
): number =>
  Math.round((amount + Number.EPSILON) * 100) /
  100;

const createEmptyMilestone = (
  sortOrder: number
): ListingRequestMilestonePlanItem => ({
  title: "",
  description: "",
  amount: 0,
  sortOrder,
});

const normalizeSortOrders = (
  milestones: ListingRequestMilestonePlanItem[]
): ListingRequestMilestonePlanItem[] =>
  milestones.map((milestone, index) => ({
    ...milestone,
    sortOrder: index,
  }));

const ListingRequestMilestonePlanEditor = ({
  milestones,
  agreementTotal,
  estimatedWorkDays,
  currency = "cad",
  validationErrors = [],
  disabled: disabledByParent = false,
  onChange,
}: ListingRequestMilestonePlanEditorProps) => {
  const t = useT();
  const isEligible =
    allowsMilestonePayments(estimatedWorkDays);

  // The plan is shown but locked until the project is long enough.
  const disabled = disabledByParent || !isEligible;

  const milestoneTotal =
    getListingRequestMilestonePlanTotal(milestones);

  const difference = roundCurrencyAmount(
    agreementTotal - milestoneTotal
  );

  const updateMilestone = (
    index: number,
    patch: Partial<ListingRequestMilestonePlanItem>
  ) => {
    onChange(
      milestones.map((milestone, currentIndex) =>
        currentIndex === index
          ? {
            ...milestone,
            ...patch,
          }
          : milestone
      )
    );
  };

  const addMilestone = () => {
    onChange([
      ...milestones,
      createEmptyMilestone(milestones.length),
    ]);
  };

  const removeMilestone = (index: number) => {
    onChange(
      normalizeSortOrders(
        milestones.filter(
          (_, currentIndex) =>
            currentIndex !== index
        )
      )
    );
  };

  const moveMilestone = (
    index: number,
    direction: -1 | 1
  ) => {
    const targetIndex = index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= milestones.length
    ) {
      return;
    }

    const nextMilestones = [...milestones];

    [
      nextMilestones[index],
      nextMilestones[targetIndex],
    ] = [
        nextMilestones[targetIndex],
        nextMilestones[index],
      ];

    onChange(
      normalizeSortOrders(nextMilestones)
    );
  };

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <div className={classes.heading}>
          <h3 className={classes.title}>
            {t("milestonePlan.title")}
          </h3>

          <p className={classes.text}>
            {t("milestonePlan.text")}
          </p>
        </div>

        <button
          className={classes.btnAdd}
          disabled={disabled}
          type="button"
          onClick={addMilestone}
        >
          {t("milestonePlan.add")}
        </button>
      </div>

      {isEligible ? (
        <div className={classes.eligibleNotice}>
          {t("milestonePlan.eligible")}
        </div>
      ) : (
        <div className={classes.notice}>
          {t("milestonePlan.notEligible")}
        </div>
      )}

      <div className={classes.list}>
        {milestones.map((milestone, index) => (
          <div
            className={classes.item}
            key={`milestone-${index}`}
          >
            <div className={classes.itemHeader}>
              <div className={classes.itemTitle}>
                {t("milestones.position", { number: index + 1 })}
              </div>

              <div className={classes.itemActions}>
                <button
                  aria-label={t("milestonePlan.moveUpLabel", { number: index + 1 })}
                  className={classes.btnOutline}
                  disabled={disabled || index === 0}
                  type="button"
                  onClick={() =>
                    moveMilestone(index, -1)
                  }
                >
                  {t("milestonePlan.moveUp")}
                </button>

                <button
                  aria-label={t("milestonePlan.moveDownLabel", { number: index + 1 })}
                  className={classes.btnOutline}
                  disabled={
                    disabled ||
                    index === milestones.length - 1
                  }
                  type="button"
                  onClick={() =>
                    moveMilestone(index, 1)
                  }
                >
                  {t("milestonePlan.moveDown")}
                </button>

                <button
                  aria-label={t("milestonePlan.removeLabel", { number: index + 1 })}
                  className={classes.btnDanger}
                  disabled={disabled}
                  type="button"
                  onClick={() =>
                    removeMilestone(index)
                  }
                >
                  {t("milestonePlan.remove")}
                </button>
              </div>
            </div>

            <div className={classes.grid}>
              <div className={classes.field}>
                <label
                  className={classes.label}
                  htmlFor={`milestone-${index}-title`}
                >
                  {t("milestonePlan.titleLabel", { number: index + 1 })}
                </label>

                <KeptPlaceholder>
                <input
                  className={classes.input}
                  disabled={disabled}
                  id={`milestone-${index}-title`}
                  placeholder={t("milestonePlan.titlePlaceholder")}
                  maxLength={160}
                  value={milestone.title}
                  onChange={(event) =>
                    updateMilestone(index, {
                      title:
                        event.currentTarget.value,
                    })
                  }
                />
                </KeptPlaceholder>
              </div>

              <div className={classes.field}>
                <label
                  className={classes.label}
                  htmlFor={`milestone-${index}-amount`}
                >
                  {t("milestonePlan.amountLabel", { number: index + 1 })}
                </label>

                <KeptPlaceholder>
                <input
                  className={classes.input}
                  disabled={disabled}
                  id={`milestone-${index}-amount`}
                  placeholder={t("milestonePlan.amountPlaceholder")}
                  min="0"
                  step="0.01"
                  type="number"
                  value={
                    milestone.amount > 0
                      ? milestone.amount
                      : ""
                  }
                  onChange={(event) => {
                    const amount = Number.parseFloat(
                      event.currentTarget.value
                    );

                    updateMilestone(index, {
                      amount: Number.isFinite(amount)
                        ? amount
                        : 0,
                    });
                  }}
                />
                </KeptPlaceholder>
              </div>

              <div className={classes.fullField}>
                <label
                  className={classes.label}
                  htmlFor={`milestone-${index}-description`}
                >
                  {t("milestonePlan.descriptionLabel", { number: index + 1 })}
                </label>

                <KeptPlaceholder>
                <textarea
                  className={classes.textarea}
                  disabled={disabled}
                  id={`milestone-${index}-description`}
                  placeholder={t("milestonePlan.descriptionPlaceholder")}
                  maxLength={2000}
                  value={
                    milestone.description ?? ""
                  }
                  onChange={(event) =>
                    updateMilestone(index, {
                      description:
                        event.currentTarget.value,
                    })
                  }
                />
                </KeptPlaceholder>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={classes.summaryGrid}>
        <div className={classes.summaryItem}>
          <div className={classes.summaryLabel}>
            {t("milestonePlan.agreementTotal")}
          </div>

          <div className={classes.summaryValue}>
            {formatMoney(
              agreementTotal,
              currency
            )}
          </div>
        </div>

        <div className={classes.summaryItem}>
          <div className={classes.summaryLabel}>
            {t("milestonePlan.milestoneTotal")}
          </div>

          <div className={classes.summaryValue}>
            {formatMoney(
              milestoneTotal,
              currency
            )}
          </div>
        </div>

        <div className={classes.summaryItem}>
          <div className={classes.summaryLabel}>
            {t("section.milestones")}
          </div>

          <div className={classes.summaryValue}>
            {milestones.length}
          </div>
        </div>
      </div>

      {difference === 0 ? (
        <div className={classes.match}>
          {t("milestonePlan.match")}
        </div>
      ) : difference > 0 ? (
        <div className={classes.mismatch}>
          {t("milestonePlan.unallocated", { amount: formatMoney(difference, currency) })}
        </div>
      ) : (
        <div className={classes.mismatch}>
          {t("milestonePlan.exceeds", {
            amount: formatMoney(
              Math.abs(difference),
              currency
            ),
          })}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className={classes.errors}>
          <strong>
            {t("milestonePlan.review")}
          </strong>

          <ul>
            {validationErrors.map(
              (validationError) => (
                <li
                  className={classes.errorItem}
                  key={validationError}
                >
                  {validationError}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ListingRequestMilestonePlanEditor;