import { hasErrorMessage } from "../../../lib/errorMessage";
import {
  useState,
  type SubmitEventHandler,
} from "react";

import {
  emptyOffSiteDelivery,
  toOffSiteDeliveryInput,
  validateOffSiteDelivery,
  type OffSiteDeliveryFormState,
} from "../../../domain/listings/offSiteDelivery";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import type { CreateListingRequestFinalDeliveryInput } from "../../../hooks/creatorRequests/useCreateListingRequestFinalDelivery";
import OffSiteDeliveryFields from "../OffSiteDeliveryFields";
import DeliveryFilesField from "./DeliveryFilesField";
import type { CommissionStorageUsage } from "../../../hooks/creatorRequests/useCommissionStorageUsage";

type FinalDeliveryAgreement = Pick<
  ListingRequestAgreementRow,
  "id" | "status" | "starting_payment_status"
>;

type ListingRequestFinalDeliveryBuilderProps = {
  // For the commission storage bar; without it the bar is not shown.
  storageUsage?: CommissionStorageUsage | null;
  requestStatus: string;
  agreement: FinalDeliveryAgreement | null;
  isPending?: boolean;
  error?: unknown;
  onCreateFinalDelivery: (
    input: CreateListingRequestFinalDeliveryInput
  ) => Promise<unknown> | unknown;
};

type BuilderFormState = {
  title: string;
  summary: string;
  deliveryLinksText: string;
  submitNow: boolean;
};

type BuilderValidationErrors = {
  title?: string;
  summary?: string;
  deliveryLinksText?: string;
  offSite?: string;
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
  linksTextarea:
    "min-h-28 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)]",
  submitRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkbox: "mt-1 h-4 w-4 rounded border-zinc-300",
  checkboxLabel: "text-sm font-semibold text-zinc-800",
  notice:
    "notice noticeWarning",
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
  deliveryLinksText: "",
  submitNow: true,
};

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The final project delivery could not be created.";

const splitDeliveryLinks = (value: string): string[] =>
  value
    .split("\n")
    .map((deliveryLink) => deliveryLink.trim())
    .filter(Boolean);

const validateForm = (
  form: BuilderFormState,
  offSite: OffSiteDeliveryFormState
): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};
  const cleanTitle = form.title.trim();
  const cleanSummary = form.summary.trim();
  const deliveryLinks = splitDeliveryLinks(
    form.deliveryLinksText
  );

  if (
    cleanTitle.length < 3 ||
    cleanTitle.length > 160
  ) {
    errors.title =
      "Final delivery title must be between 3 and 160 characters.";
  }

  if (
    cleanSummary.length < 10 ||
    cleanSummary.length > 4000
  ) {
    errors.summary =
      "Final delivery summary must be between 10 and 4000 characters.";
  }

  if (deliveryLinks.length > 20) {
    errors.deliveryLinksText =
      "A final delivery can contain no more than 20 delivery links.";
  } else if (
    deliveryLinks.some(
      (deliveryLink) => deliveryLink.length > 2000
    )
  ) {
    errors.deliveryLinksText =
      "Each final delivery link must be 2000 characters or fewer.";
  }

  const offSiteError = validateOffSiteDelivery(offSite);

  if (offSiteError) {
    errors.offSite = offSiteError;
  }

  return errors;
};

const ListingRequestFinalDeliveryBuilder = ({
  storageUsage = null,
  requestStatus,
  agreement,
  isPending = false,
  error,
  onCreateFinalDelivery,
}: ListingRequestFinalDeliveryBuilderProps) => {
  const [form, setForm] =
    useState<BuilderFormState>(defaultFormState);

  const [validationErrors, setValidationErrors] =
    useState<BuilderValidationErrors>({});

  const [offSite, setOffSite] =
    useState<OffSiteDeliveryFormState>(
      emptyOffSiteDelivery
    );

  const [deliveryFiles, setDeliveryFiles] =
    useState<File[]>([]);

  const [uploadStatus, setUploadStatus] =
    useState<string | null>(null);


  const agreementCanDeliver =
    agreement?.status === "buyer_accepted" &&
    (
      agreement.starting_payment_status === "paid" ||
      agreement.starting_payment_status ===
        "not_required"
    );

  if (
    requestStatus !== "accepted" ||
    !agreement ||
    !agreementCanDeliver
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
    }));
  };

  const handleSubmit: SubmitEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form, offSite);
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const offSiteDelivery =
      toOffSiteDeliveryInput(offSite);

    const input: CreateListingRequestFinalDeliveryInput = {
      agreementId: agreement.id,
      status: form.submitNow
        ? "submitted"
        : "draft",
      title: form.title.trim(),
      summary: form.summary.trim(),
      deliveryLinks: splitDeliveryLinks(
        form.deliveryLinksText
      ),
      ...(offSiteDelivery
        ? { offSiteDelivery }
        : {}),
      ...(deliveryFiles.length > 0
        ? {
            deliveryFiles,
            onUploadProgress: setUploadStatus,
          }
        : {}),
    };

    try {
      await onCreateFinalDelivery(input);
    } catch {
      // Mutation errors are surfaced through the error prop.
    } finally {
      setUploadStatus(null);
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
            Create final project delivery
          </h2>

          <p className={classes.text}>
            Provide the completed work and supporting
            delivery links for buyer review.
          </p>
        </div>

        {createErrorMessage && (
          <div className={classes.errorBox}>
            {createErrorMessage}
          </div>
        )}

        <div className={classes.notice}>
          Submitting the final delivery may activate any
          remaining balance payment that is due before
          final release.
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="final-delivery-title"
          >
            Delivery title
          </label>

          <input
            className={classes.input}
            id="final-delivery-title"
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
            htmlFor="final-delivery-summary"
          >
            Delivery summary
          </label>

          <textarea
            className={classes.textarea}
            id="final-delivery-summary"
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
            Explain what is included, where the completed
            work can be found, and any important usage or
            handoff notes.
          </p>

          {validationErrors.summary && (
            <p className={classes.errorText}>
              {validationErrors.summary}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="final-delivery-links"
          >
            Delivery links
          </label>

          <textarea
            className={classes.linksTextarea}
            id="final-delivery-links"
            value={form.deliveryLinksText}
            onChange={(event) =>
              updateField(
                "deliveryLinksText",
                event.currentTarget.value
              )
            }
            placeholder={
              "https://example.com/final-files\nhttps://example.com/source-files"
            }
          />

          <p className={classes.help}>
            Add one link per line. Up to 20 links may be
            included.
          </p>

          {validationErrors.deliveryLinksText && (
            <p className={classes.errorText}>
              {validationErrors.deliveryLinksText}
            </p>
          )}
        </div>

        <DeliveryFilesField
          disabled={isPending}
          files={deliveryFiles}
          usage={storageUsage}
          onChange={setDeliveryFiles}
        />

        <OffSiteDeliveryFields
          disabled={isPending}
          error={validationErrors.offSite}
          idPrefix="final-delivery"
          value={offSite}
          onChange={(nextOffSite) => {
            setOffSite(nextOffSite);
            setValidationErrors((currentErrors) => ({
              ...currentErrors,
              offSite: undefined,
            }));
          }}
        />

        <label className={classes.submitRow}>
          <input
            checked={form.submitNow}
            className={classes.checkbox}
            type="checkbox"
            onChange={(event) =>
              updateField(
                "submitNow",
                event.currentTarget.checked
              )
            }
          />

          <span className={classes.checkboxLabel}>
            Submit to the buyer now. Uncheck to save as a
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
              ? uploadStatus ?? "Saving final delivery…"
              : form.submitNow
                ? "Create and submit final delivery"
                : "Save final delivery draft"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestFinalDeliveryBuilder;