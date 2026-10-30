import { hasErrorMessage } from "../../../lib/errorMessage";
import {
  useState,
  type SubmitEventHandler,
} from "react";

import { canStartWorkForAcceptedRequest } from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import type {
  CreateListingRequestProgressUpdateInput,
  ListingRequestProgressUpdateKind,
} from "../../../hooks/creatorRequests/useCreateListingRequestProgressUpdate";
import { useT, type Translate } from "../../../lib/i18n/i18n";
type ProgressUpdateAgreement = Pick<
  ListingRequestAgreementRow,
  "id" | "status" | "starting_payment_status"
>;

type ListingRequestProgressUpdateFormProps = {
  requestStatus: string;
  agreement: ProgressUpdateAgreement | null;
  isPending?: boolean;
  error?: unknown;
  onCreateProgressUpdate: (
    input: CreateListingRequestProgressUpdateInput
  ) => Promise<unknown> | unknown;
};

type ProgressUpdateFormState = {
  updateKind: ListingRequestProgressUpdateKind;
  title: string;
  body: string;
  progressPercent: string;
};

type ProgressUpdateFormErrors = Partial<
  Record<keyof ProgressUpdateFormState, string>
>;

const classes = {
  card: "card p-6",
  section: "space-y-5",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  grid: "grid gap-4 sm:grid-cols-2",
  field: "space-y-2",
  label: "formLabel",
  hint: "formHint",
  input:
    "formControl",
  textarea:
    "formControl min-h-[160px]",
  errorText: "formError",
  errorBox:
    "notice noticeError",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
} as const;

const updateKindOptions = [
    {
      value: "progress",
      label: "progressForm.kindProgress",
    },
    {
      value: "milestone",
      label: "progressForm.kindMilestone",
    },
    {
      value: "delay",
      label: "progressForm.kindDelay",
    },
    {
      value: "final_preview",
      label: "updateKind.final_preview",
    },
  ] as const satisfies ReadonlyArray<{
    value: ListingRequestProgressUpdateKind;
    label: string;
  }>;

const defaultFormState: ProgressUpdateFormState = {
  updateKind: "progress",
  title: "",
  body: "",
  progressPercent: "",
};

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("progressForm.failed");

const parseProgressPercent = (
  value: string
): number | null => {
  const trimmedValue = value.trim();

  return trimmedValue === ""
    ? null
    : Number(trimmedValue);
};

const validateForm = (
  form: ProgressUpdateFormState,
  t: Translate
): ProgressUpdateFormErrors => {
  const errors: ProgressUpdateFormErrors = {};
  const title = form.title.trim();
  const body = form.body.trim();
  const progressPercent = parseProgressPercent(
    form.progressPercent
  );

  if (title.length < 3 || title.length > 160) {
    errors.title = t("progressForm.titleLength");
  }

  if (body.length < 10 || body.length > 4000) {
    errors.body = t("progressForm.bodyLength");
  }

  if (
    progressPercent !== null &&
    (
      !Number.isInteger(progressPercent) ||
      progressPercent < 0 ||
      progressPercent > 100
    )
  ) {
    errors.progressPercent = t("progressForm.percentRange");
  }

  return errors;
};

const ListingRequestProgressUpdateForm = ({
  requestStatus,
  agreement,
  isPending = false,
  error,
  onCreateProgressUpdate,
}: ListingRequestProgressUpdateFormProps) => {
  const t = useT();
  const [form, setForm] =
    useState<ProgressUpdateFormState>(
      defaultFormState
    );

  const [validationErrors, setValidationErrors] =
    useState<ProgressUpdateFormErrors>({});

  const canPostProgressUpdate = agreement
    ? canStartWorkForAcceptedRequest({
      requestStatus,
      agreementStatus: agreement.status,
      startingPaymentStatus:
        agreement.starting_payment_status,
    })
    : false;

  if (!agreement || !canPostProgressUpdate) {
    return null;
  }

  const updateField = <
    Key extends keyof ProgressUpdateFormState,
  >(
    key: Key,
    value: ProgressUpdateFormState[Key]
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

  const handleSubmit: SubmitEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form, t);

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const progressPercent = parseProgressPercent(
      form.progressPercent
    );

    try {
      await onCreateProgressUpdate({
        agreementId: agreement.id,
        updateKind: form.updateKind,
        title: form.title.trim(),
        body: form.body.trim(),
        progressPercent,
      });

      setForm(defaultFormState);
      setValidationErrors({});
    } catch {
      // The mutation error is rendered from the error prop.
    }
  };

  const hasError =
    error !== null && error !== undefined;

  return (
    <form
      className={classes.card}
      noValidate
      onSubmit={handleSubmit}
    >
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            {t("progressForm.title")}
          </h2>

          <p className={classes.text}>
            {t("progressForm.text")}
          </p>
        </div>

        {hasError && (
          <div className={classes.errorBox}>
            {getErrorMessage(error, t)}
          </div>
        )}

        <div className={classes.grid}>
          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="progress-update-kind"
            >
              {t("progressForm.typeLabel")}
            </label>

            <select
              className={classes.input}
              id="progress-update-kind"
              value={form.updateKind}
              onChange={(event) =>
                updateField(
                  "updateKind",
                  event.currentTarget
                    .value as ListingRequestProgressUpdateKind
                )
              }
            >
              {updateKindOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {t(option.label)}
                </option>
              ))}
            </select>
          </div>

          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="progress-update-percent"
            >
              {t("progressForm.percentLabel")}
            </label>

            <input
              className={classes.input}
              id="progress-update-percent"
              min="0"
              max="100"
              step="1"
              type="number"
              value={form.progressPercent}
              onChange={(event) =>
                updateField(
                  "progressPercent",
                  event.currentTarget.value
                )
              }
            />

            <p className={classes.hint}>
              {t("progressForm.percentHint")}
            </p>

            {validationErrors.progressPercent && (
              <p className={classes.errorText}>
                {validationErrors.progressPercent}
              </p>
            )}
          </div>
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="progress-update-title"
          >
            {t("progressForm.titleLabel")}
          </label>

          <input
            className={classes.input}
            id="progress-update-title"
            maxLength={160}
            value={form.title}
            onChange={(event) =>
              updateField(
                "title",
                event.currentTarget.value
              )
            }
          />

          <p className={classes.hint}>
            {t("report.characters", { count: form.title.trim().length, max: 160 })}
          </p>

          {validationErrors.title && (
            <p className={classes.errorText}>
              {validationErrors.title}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="progress-update-body"
          >
            {t("progressForm.detailsLabel")}
          </label>

          <textarea
            className={classes.textarea}
            id="progress-update-body"
            maxLength={4000}
            value={form.body}
            onChange={(event) =>
              updateField(
                "body",
                event.currentTarget.value
              )
            }
          />

          <p className={classes.hint}>
            {t("report.characters", { count: form.body.trim().length, max: 4000 })}
          </p>

          {validationErrors.body && (
            <p className={classes.errorText}>
              {validationErrors.body}
            </p>
          )}
        </div>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="submit"
          >
            {t(isPending ? "progressForm.posting" : "progressForm.post")}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestProgressUpdateForm;