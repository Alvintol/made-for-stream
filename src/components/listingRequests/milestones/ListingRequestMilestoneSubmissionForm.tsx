import { hasErrorMessage } from "../../../lib/errorMessage";
import {
  useEffect,
  useState,
  type SubmitEventHandler,
} from "react";

import {
  canSubmitListingRequestMilestone,
} from "../../../domain/listings/listingRequestMilestones";
import {
  emptyOffSiteDelivery,
  toOffSiteDeliveryInput,
  validateOffSiteDelivery,
  type OffSiteDeliveryFormState,
} from "../../../domain/listings/offSiteDelivery";
import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";
import {
  getListingPreviewWatermarkText,
  LISTING_PREVIEW_ACCEPT,
  renderListingPreviewImage,
  validateListingPreviewSource,
} from "../../../lib/listings/listingPreviewImage";
import { MILESTONE_PREVIEW_MAX_IMAGES } from "../../../lib/listings/milestonePreviewImage";
import {
  isMilestonePreviewVideoSource,
  MILESTONE_PREVIEW_VIDEO_ACCEPT,
  MILESTONE_PREVIEW_VIDEO_MAX_SECONDS,
  MilestonePreviewVideoError,
  renderMilestonePreviewVideo,
  validateMilestonePreviewVideoSource,
} from "../../../lib/listings/milestonePreviewVideo";
import type { SubmitListingRequestMilestoneInput } from "../../../hooks/creatorRequests/useSubmitListingRequestMilestone";
import OffSiteDeliveryFields from "../OffSiteDeliveryFields";
import KeptPlaceholder from "../../ui/KeptPlaceholder";

type SubmittableMilestone = Pick<
  ListingRequestMilestoneRow,
  "id" | "status" | "title" | "sort_order"
>;

type ListingRequestMilestoneSubmissionFormProps = {
  milestone: SubmittableMilestone | null;
  // The creator's handle, drawn into the watermark on preview images.
  watermarkHandle?: string | null;
  isPending?: boolean;
  error?: unknown;
  onSubmitMilestone: (
    input: SubmitListingRequestMilestoneInput
  ) => Promise<unknown> | unknown;
};

type MilestoneSubmissionFormState = {
  summary: string;
  deliveryLinksText: string;
};

// A watermarked copy ready to upload, and its in-page address for the
// thumbnail.
type PreparedPreviewImage = {
  blob: Blob;
  url: string;
  isVideo: boolean;
};

const PREVIEW_ACCEPT = `${LISTING_PREVIEW_ACCEPT},${MILESTONE_PREVIEW_VIDEO_ACCEPT}`;

// Images and videos are checked by their own rules; anything else gets one
// message naming both.
const validatePreviewSource = (file: File): string | null =>
  isMilestonePreviewVideoSource(file)
    ? validateMilestonePreviewVideoSource(file)
    : LISTING_PREVIEW_ACCEPT.split(",").includes(file.type)
      ? validateListingPreviewSource(file)
      : "Choose a JPEG, PNG or WebP image, an MP4, WebM or MOV video, or an animated GIF.";

type MilestoneSubmissionValidationErrors = {
  summary?: string;
  deliveryLinksText?: string;
  offSite?: string;
};

const classes = {
  card: "card p-6",
  section: "space-y-5",
  header: "space-y-1",
  title:
    "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  milestone:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  milestoneLabel:
    "text-xs font-bold uppercase tracking-wide text-zinc-500",
  milestoneTitle:
    "mt-1 text-sm font-extrabold text-zinc-900",
  notice:
    "notice noticeWarning",
  revisionNotice:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
  field: "space-y-2",
  label: "formLabel",
  textarea:
    "formControl min-h-32",
  linksTextarea:
    "min-h-28 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
  help: "formHint",
  fileInput: "formControl",
  imageGrid: "grid grid-cols-2 gap-3 sm:grid-cols-3",
  imageItem: "space-y-2",
  image:
    "w-full rounded-2xl border border-zinc-200 bg-zinc-100 object-contain",
  btnRemove: "btnOutline btnSm",
  errorText:
    "formError",
  errorBox:
    "notice noticeError",
  actions:
    "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
} as const;

const defaultFormState: MilestoneSubmissionFormState = {
  summary: "",
  deliveryLinksText: "",
};

const getErrorMessage = (
  error: unknown
): string =>
  hasErrorMessage(error)
    ? error.message
    : "The milestone submission could not be saved.";

const splitDeliveryLinks = (
  value: string
): string[] =>
  value
    .split("\n")
    .map((deliveryLink) =>
      deliveryLink.trim()
    )
    .filter(Boolean);

const validateForm = (
  form: MilestoneSubmissionFormState,
  offSite: OffSiteDeliveryFormState
): MilestoneSubmissionValidationErrors => {
  const errors: MilestoneSubmissionValidationErrors =
    {};

  const cleanSummary = form.summary.trim();

  const deliveryLinks = splitDeliveryLinks(
    form.deliveryLinksText
  );

  if (
    cleanSummary.length < 10 ||
    cleanSummary.length > 4000
  ) {
    errors.summary =
      "Milestone submission summary must be between 10 and 4000 characters.";
  }

  if (deliveryLinks.length > 20) {
    errors.deliveryLinksText =
      "A milestone submission can contain no more than 20 delivery links.";
  } else if (
    deliveryLinks.some(
      (deliveryLink) =>
        deliveryLink.length > 2000
    )
  ) {
    errors.deliveryLinksText =
      "Each milestone delivery link must be 2000 characters or fewer.";
  }

  const offSiteError = validateOffSiteDelivery(offSite);

  if (offSiteError) {
    errors.offSite = offSiteError;
  }

  return errors;
};

const ListingRequestMilestoneSubmissionForm = ({
  milestone,
  watermarkHandle,
  isPending = false,
  error,
  onSubmitMilestone,
}: ListingRequestMilestoneSubmissionFormProps) => {
  const [form, setForm] =
    useState<MilestoneSubmissionFormState>(
      defaultFormState
    );

  const [
    validationErrors,
    setValidationErrors,
  ] =
    useState<MilestoneSubmissionValidationErrors>(
      {}
    );

  const [offSite, setOffSite] =
    useState<OffSiteDeliveryFormState>(
      emptyOffSiteDelivery
    );

  const [previewImages, setPreviewImages] =
    useState<PreparedPreviewImage[]>([]);

  const [isPreparingImages, setIsPreparingImages] =
    useState(false);

  const [previewImageError, setPreviewImageError] =
    useState<string | null>(null);

  useEffect(() => {
    setForm(defaultFormState);
    setValidationErrors({});
    setOffSite(emptyOffSiteDelivery);
    setPreviewImages([]);
  }, [milestone?.id]);

  if (
    !milestone ||
    !canSubmitListingRequestMilestone(
      milestone.status
    )
  ) {
    return null;
  }

  const isRevisionSubmission =
    milestone.status === "revision_requested";

  const updateField = <
    Key extends keyof MilestoneSubmissionFormState,
  >(
    key: Key,
    value: MilestoneSubmissionFormState[Key]
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));

    setValidationErrors(
      (currentErrors) => ({
        ...currentErrors,
        [key]: undefined,
      })
    );
  };

  const watermarkText =
    getListingPreviewWatermarkText(watermarkHandle);

  // Prepares the copies straight away, so the thumbnails on screen are
  // exactly what will be uploaded and what the buyer will see.
  const handlePreviewFiles = async (
    files: File[]
  ) => {
    if (files.length === 0) {
      return;
    }

    const sourceError = files
      .map(validatePreviewSource)
      .find(Boolean);

    if (sourceError) {
      setPreviewImageError(sourceError);
      return;
    }

    if (
      previewImages.length + files.length >
      MILESTONE_PREVIEW_MAX_IMAGES
    ) {
      setPreviewImageError(
        `A milestone submission can contain no more than ${MILESTONE_PREVIEW_MAX_IMAGES} preview images and videos.`
      );
      return;
    }

    setIsPreparingImages(true);
    setPreviewImageError(null);

    // One at a time: a video is recorded in real time, and each one is
    // shown as soon as it is ready.
    let isVideo = false;

    try {
      for (const file of files) {
        isVideo =
          isMilestonePreviewVideoSource(file);
        const blob = isVideo
          ? await renderMilestonePreviewVideo(file, {
              watermarkText,
            })
          : await renderListingPreviewImage(file, {
              watermarkText,
            });

        setPreviewImages((currentImages) => [
          ...currentImages,
          {
            blob,
            url: URL.createObjectURL(blob),
            isVideo,
          },
        ]);
      }
    } catch (renderError) {
      setPreviewImageError(
        renderError instanceof MilestonePreviewVideoError
          ? renderError.message
          : isVideo
            ? "That video could not be read. Try an MP4 or WebM file."
            : "That image could not be read. Try a different file."
      );
    } finally {
      setIsPreparingImages(false);
    }
  };

  const removePreviewImage = (
    image: PreparedPreviewImage
  ) => {
    URL.revokeObjectURL(image.url);

    setPreviewImages((currentImages) =>
      currentImages.filter(
        (currentImage) => currentImage !== image
      )
    );
  };

  const handleSubmit: SubmitEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form, offSite);

    setValidationErrors(nextErrors);

    if (
      Object.keys(nextErrors).length > 0
    ) {
      return;
    }

    const offSiteDelivery =
      toOffSiteDeliveryInput(offSite);

    try {
      await onSubmitMilestone({
        milestoneId: milestone.id,
        summary: form.summary.trim(),
        deliveryLinks: splitDeliveryLinks(
          form.deliveryLinksText
        ),
        previewImages: previewImages.map(
          (image) => image.blob
        ),
        ...(offSiteDelivery
          ? { offSiteDelivery }
          : {}),
      });

      previewImages.forEach((image) =>
        URL.revokeObjectURL(image.url)
      );

      setForm(defaultFormState);
      setValidationErrors({});
      setOffSite(emptyOffSiteDelivery);
      setPreviewImages([]);
    } catch {
      // Mutation errors are rendered through the error prop.
    }
  };

  const errorMessage = error
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
            {isRevisionSubmission
              ? "Resubmit milestone"
              : "Submit milestone"}
          </h2>

          <p className={classes.text}>
            Provide the completed milestone work and
            supporting links for buyer review.
          </p>
        </div>

        <div className={classes.milestone}>
          <div
            className={classes.milestoneLabel}
          >
            Milestone{" "}
            {milestone.sort_order + 1}
          </div>

          <div
            className={classes.milestoneTitle}
          >
            {milestone.title}
          </div>
        </div>

        {isRevisionSubmission ? (
          <div
            className={classes.revisionNotice}
          >
            The buyer requested revisions. Submit an
            updated version after completing the
            requested changes.
          </div>
        ) : (
          <div className={classes.notice}>
            Submitting starts the buyer-review period.
            Payment becomes due only after the buyer
            approves this milestone.
          </div>
        )}

        {errorMessage && (
          <div className={classes.errorBox}>
            {errorMessage}
          </div>
        )}

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="milestone-submission-summary"
          >
            Milestone submission summary
          </label>

          <textarea
            className={classes.textarea}
            disabled={isPending}
            id="milestone-submission-summary"
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
            {form.summary.trim().length}/4000
            characters. Explain what was completed
            and any details the buyer should review.
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
            htmlFor="milestone-delivery-links"
          >
            Milestone delivery links
          </label>

          <KeptPlaceholder>
          <textarea
            className={classes.linksTextarea}
            disabled={isPending}
            id="milestone-delivery-links"
            value={form.deliveryLinksText}
            onChange={(event) =>
              updateField(
                "deliveryLinksText",
                event.currentTarget.value
              )
            }
            placeholder={
              "https://example.com/review-files\nhttps://example.com/source-files"
            }
          />
          </KeptPlaceholder>

          <p className={classes.help}>
            Optional. Add one link per line, up to
            20 links.
          </p>

          {validationErrors.deliveryLinksText && (
            <p className={classes.errorText}>
              {
                validationErrors.deliveryLinksText
              }
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="milestone-preview-images"
          >
            Preview images and videos
          </label>

          <input
            accept={PREVIEW_ACCEPT}
            className={classes.fileInput}
            disabled={isPending || isPreparingImages}
            id="milestone-preview-images"
            multiple
            type="file"
            onChange={(event) => {
              const files = Array.from(
                event.currentTarget.files ?? []
              );

              // Cleared so the same file can be chosen again after
              // it is removed.
              event.currentTarget.value = "";

              void handlePreviewFiles(files);
            }}
          />

          <p className={classes.help}>
            Optional. Up to{" "}
            {MILESTONE_PREVIEW_MAX_IMAGES} JPEG, PNG
            or WebP images, MP4, WebM or MOV videos,
            or animated GIFs. We upload a smaller copy
            of each, at most 1200 pixels on its
            longest side, with “{watermarkText}”
            repeated across it. Your originals stay
            on your device, and only you and the
            buyer can see the copies. A watermark
            discourages copying; it cannot fully
            prevent it.
          </p>

          <p className={classes.help}>
            Videos and GIFs show movement: we record
            the first{" "}
            {MILESTONE_PREVIEW_VIDEO_MAX_SECONDS}{" "}
            seconds, without sound, as it plays, so a
            clip takes about as long as it lasts to
            prepare. Keep this tab open meanwhile.
          </p>

          {previewImageError && (
            <p
              className={classes.errorText}
              role="alert"
            >
              {previewImageError}
            </p>
          )}

          {isPreparingImages && (
            <p className={classes.help}>
              Preparing your previews…
            </p>
          )}

          {previewImages.length > 0 && (
            <ul className={classes.imageGrid}>
              {previewImages.map((image, index) => (
                <li
                  className={classes.imageItem}
                  key={image.url}
                >
                  {image.isVideo ? (
                    <video
                      aria-label={`Preview video ${index + 1} as the buyer will see it`}
                      className={classes.image}
                      controls
                      loop
                      muted
                      playsInline
                      src={image.url}
                    />
                  ) : (
                    <img
                      alt={`Preview image ${index + 1} as the buyer will see it`}
                      className={classes.image}
                      src={image.url}
                    />
                  )}

                  <button
                    className={classes.btnRemove}
                    disabled={isPending || isPreparingImages}
                    type="button"
                    onClick={() =>
                      removePreviewImage(image)
                    }
                  >
                    Remove {image.isVideo ? "video" : "image"}{" "}
                    {index + 1}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <OffSiteDeliveryFields
          disabled={isPending}
          error={validationErrors.offSite}
          idPrefix="milestone"
          value={offSite}
          onChange={(nextOffSite) => {
            setOffSite(nextOffSite);
            setValidationErrors(
              (currentErrors) => ({
                ...currentErrors,
                offSite: undefined,
              })
            );
          }}
        />

        <div className={classes.actions}>
          <button
            className={classes.btnPrimary}
            disabled={isPending || isPreparingImages}
            type="submit"
          >
            {isPending
              ? "Submitting milestone…"
              : isRevisionSubmission
                ? "Resubmit milestone for review"
                : "Submit milestone for review"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestMilestoneSubmissionForm;