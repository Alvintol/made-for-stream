import { formatMoney } from "../../../lib/formatMoney";
import {
  allowsMilestonePayments,
} from '../../../domain/listings/listingRequestAgreements';

import {
  getListingRequestMilestonePlanTotal,
  type ListingRequestMilestonePlanItem,
} from '../../../domain/listings/listingRequestMilestones';

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
            Milestone payment plan
          </h3>

          <p className={classes.text}>
            Define each buyer approval checkpoint and the
            payment that becomes due after approval.
          </p>
        </div>

        <button
          className={classes.btnAdd}
          disabled={disabled}
          type="button"
          onClick={addMilestone}
        >
          Add milestone
        </button>
      </div>

      {isEligible ? (
        <div className={classes.eligibleNotice}>
          This project is eligible for milestone payments
          because it is estimated to take at least 7 days.
        </div>
      ) : (
        <div className={classes.notice}>
          Milestone payments need an estimated project length
          of at least 7 days. Raise the estimated work days to
          edit this plan.
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
                Milestone {index + 1}
              </div>

              <div className={classes.itemActions}>
                <button
                  aria-label={`Move milestone ${index + 1
                    } up`}
                  className={classes.btnOutline}
                  disabled={disabled || index === 0}
                  type="button"
                  onClick={() =>
                    moveMilestone(index, -1)
                  }
                >
                  Move up
                </button>

                <button
                  aria-label={`Move milestone ${index + 1
                    } down`}
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
                  Move down
                </button>

                <button
                  aria-label={`Remove milestone ${index + 1
                    }`}
                  className={classes.btnDanger}
                  disabled={disabled}
                  type="button"
                  onClick={() =>
                    removeMilestone(index)
                  }
                >
                  Remove
                </button>
              </div>
            </div>

            <div className={classes.grid}>
              <div className={classes.field}>
                <label
                  className={classes.label}
                  htmlFor={`milestone-${index}-title`}
                >
                  Milestone {index + 1} title
                </label>

                <input
                  className={classes.input}
                  disabled={disabled}
                  id={`milestone-${index}-title`}
                  maxLength={160}
                  value={milestone.title}
                  onChange={(event) =>
                    updateMilestone(index, {
                      title:
                        event.currentTarget.value,
                    })
                  }
                />
              </div>

              <div className={classes.field}>
                <label
                  className={classes.label}
                  htmlFor={`milestone-${index}-amount`}
                >
                  Milestone {index + 1} amount
                </label>

                <input
                  className={classes.input}
                  disabled={disabled}
                  id={`milestone-${index}-amount`}
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
              </div>

              <div className={classes.fullField}>
                <label
                  className={classes.label}
                  htmlFor={`milestone-${index}-description`}
                >
                  Milestone {index + 1} description
                </label>

                <textarea
                  className={classes.textarea}
                  disabled={disabled}
                  id={`milestone-${index}-description`}
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
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={classes.summaryGrid}>
        <div className={classes.summaryItem}>
          <div className={classes.summaryLabel}>
            Agreement total
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
            Milestone total
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
            Milestones
          </div>

          <div className={classes.summaryValue}>
            {milestones.length}
          </div>
        </div>
      </div>

      {difference === 0 ? (
        <div className={classes.match}>
          Milestone amounts match the agreement total.
        </div>
      ) : difference > 0 ? (
        <div className={classes.mismatch}>
          {formatMoney(difference, currency)} remains
          unallocated.
        </div>
      ) : (
        <div className={classes.mismatch}>
          The milestone plan exceeds the agreement total
          by{" "}
          {formatMoney(
            Math.abs(difference),
            currency
          )}
          .
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className={classes.errors}>
          <strong>
            Review the milestone payment plan:
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