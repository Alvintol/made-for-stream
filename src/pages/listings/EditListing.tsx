import { hasErrorMessage } from "../../lib/errorMessage";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import ListingPreviewImageField, {
  type ListingPreviewSelection,
} from "../../components/listings/ListingPreviewImageField";
import { uploadListingPreviewImage } from "../../lib/listings/listingPreviewImage";
import { useMyProfile } from "../../hooks/profile/useMyProfile";
import ListingAnimatedPreviewField, {
  type ListingAnimationChoice,
} from "../../components/listings/ListingAnimatedPreviewField";
import { uploadListingAnimation } from "../../lib/listings/listingAnimatedPreview";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { useMyListing } from "../../hooks/listings/useMyListing";
import { getAllowedFulfilmentModes, isAdminHiddenListing, ListingFulfilmentMode, listingFulfilmentModeOptions, normaliseFulfilmentMode } from '../../domain/listings/listings';
import { useT } from "../../lib/i18n/i18n";
type ListingOfferingType = "digital" | "commission" | "service";
type ListingPriceType = "fixed" | "starting_at" | "range";
type ListingVideoSubtype = "" | "long-form" | "short-form";

type FormState = {
  title: string;
  short: string;
  offeringType: ListingOfferingType;
  fulfilmentMode: ListingFulfilmentMode;
  category: string;
  videoSubtype: ListingVideoSubtype;
  priceType: ListingPriceType;
  priceMin: string;
  priceMax: string;
  deliverablesText: string;
  tagsText: string;
  previewUrl: string;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  submit?: string;
};

const classes = {
  page: "space-y-6",
  backLink: "backLink",

  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "sectionHeading",
  sectionText: "text-sm text-zinc-600",

  grid: "grid gap-4 md:grid-cols-2",
  full: "md:col-span-2",

  field: "space-y-2",
  label: "formLabel",
  hint: "formHint",
  error: "formError",

  input:
    "formControl",
  textarea:
    "formControl min-h-[120px]",
  select:
    "formControl",

  infoBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  infoTitle: "text-sm font-bold text-zinc-900",
  infoText: "mt-1 text-sm text-zinc-600",

  submitError:
    "notice noticeError",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",

  loadingText: "text-sm text-zinc-600",
  warningCard:
    "notice noticeWarning",
} as const;

const offeringTypeOptions = [
    { value: "digital", label: "offering.digital" },
    { value: "commission", label: "offering.commission" },
    { value: "service", label: "offering.service" },
  ] as const satisfies ReadonlyArray<{ value: ListingOfferingType; label: string }>;

const priceTypeOptions = [
    { value: "fixed", label: "listingForm.priceFixed" },
    { value: "starting_at", label: "listingForm.priceStarting" },
    { value: "range", label: "listingForm.priceRange" },
  ] as const satisfies ReadonlyArray<{ value: ListingPriceType; label: string }>;

const videoSubtypeOptions = [
    { value: "", label: "listingForm.videoNone" },
    { value: "long-form", label: "listingForm.videoLong" },
    { value: "short-form", label: "listingForm.videoShort" },
  ] as const satisfies ReadonlyArray<{ value: ListingVideoSubtype; label: string }>;

const initialState: FormState = {
  title: "",
  short: "",
  offeringType: "digital",
  fulfilmentMode: "request",
  category: "",
  videoSubtype: "",
  priceType: "fixed",
  priceMin: "",
  priceMax: "",
  deliverablesText: "",
  tagsText: "",
  previewUrl: "",
};

// Splits newline-separated deliverables into a clean array
const parseDeliverables = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

// Splits comma-separated tags into a clean array
const parseTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Keeps only whole-number digits for price inputs
const normaliseIntegerInput = (value: string) =>
  value.replace(/[^\d]/g, "");

// Parses an integer field while keeping empty input as null
const parseInteger = (value: string) => {
  if (!value.trim()) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// Maps a loaded listing row into editable form state
const toFormState = (listing: {
  title: string;
  short: string;
  offering_type: ListingOfferingType;
  fulfilment_mode: ListingFulfilmentMode;
  category: string;
  video_subtype: "long-form" | "short-form" | null;
  price_type: ListingPriceType;
  price_min: number;
  price_max: number | null;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
}): FormState => ({
  title: listing.title,
  short: listing.short,
  offeringType: listing.offering_type,
  fulfilmentMode: listing.fulfilment_mode,
  category: listing.category,
  videoSubtype: listing.video_subtype ?? "",
  priceType: listing.price_type,
  priceMin: String(listing.price_min),
  priceMax:
    listing.price_type === "range" && listing.price_max !== null
      ? String(listing.price_max)
      : "",
  deliverablesText: listing.deliverables.join("\n"),
  tagsText: listing.tags.join(", "),
  previewUrl: listing.preview_url ?? "",
});

const EditListing = () => {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: listing, isLoading, error } = useMyListing(id ?? null);

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedForm, setHasLoadedForm] = useState(false);
  // A replacement thumbnail, uploaded when the draft is saved.
  const [previewSelection, setPreviewSelection] = useState<ListingPreviewSelection | null>(null);
  const [animationChoice, setAnimationChoice] = useState<ListingAnimationChoice>({
    action: "keep",
  });
  const { data: profile } = useMyProfile();

  useEffect(() => {
    if (!listing || hasLoadedForm) return;

    setForm(toFormState(listing));
    setHasLoadedForm(true);
  }, [listing, hasLoadedForm]);

  const isRangePrice = form.priceType === "range";

  const deliverablePreview = useMemo(
    () => parseDeliverables(form.deliverablesText),
    [form.deliverablesText]
  );

  const tagPreview = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, submit: undefined }));
  };

  const setOfferingType = (value: ListingOfferingType) => {
    setForm((current) => ({
      ...current,
      offeringType: value,
      fulfilmentMode: normaliseFulfilmentMode(value, current.fulfilmentMode),
    }));

    setErrors((current) => ({
      ...current,
      offeringType: undefined,
      fulfilmentMode: undefined,
      submit: undefined,
    }));
  };

  const setPriceType = (value: ListingPriceType) => {
    setForm((current) => ({
      ...current,
      priceType: value,
      priceMax: value === "range" ? current.priceMax : "",
    }));

    setErrors((current) => ({
      ...current,
      priceMax: undefined,
      submit: undefined,
    }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    const title = form.title.trim();
    const short = form.short.trim();
    const category = form.category.trim();

    const priceMin = parseInteger(form.priceMin);
    const rawPriceMax =
      form.priceType === "range" ? parseInteger(form.priceMax) : null;

    if (title.length < 3 || title.length > 80) {
      nextErrors.title = t("listingForm.errorTitle");
    }

    if (short.length < 10 || short.length > 280) {
      nextErrors.short = t("listingForm.errorShort");
    }

    if (!category) {
      nextErrors.category = t("listingForm.errorCategory");
    }

    if (priceMin === null || priceMin < 0) {
      nextErrors.priceMin = t("listingForm.errorPriceMin");
    }

    if (form.priceType === "range") {
      if (rawPriceMax === null) {
        nextErrors.priceMax = t("listingForm.errorPriceMaxNeeded");
      } else if (priceMin !== null && rawPriceMax < priceMin) {
        nextErrors.priceMax = t("listingForm.errorPriceMax");
      }
    } else if (rawPriceMax !== null && priceMin !== null && rawPriceMax < priceMin) {
      nextErrors.priceMax = t("listingForm.errorPriceMax");
    }

    if (
      form.videoSubtype &&
      form.videoSubtype !== "long-form" &&
      form.videoSubtype !== "short-form"
    ) {
      nextErrors.videoSubtype = t("listingForm.errorVideo");
    }

    if (
      !getAllowedFulfilmentModes(form.offeringType).includes(form.fulfilmentMode)
    ) {
      nextErrors.fulfilmentMode = t("listingForm.errorFlow");
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      priceMin,
      rawPriceMax,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { isValid, priceMin, rawPriceMax } = validate();
    if (!isValid || !user?.id || !id || priceMin === null) return;

    setIsSaving(true);

    try {
      const nextPriceMax =
        form.priceType === "fixed"
          ? priceMin
          : form.priceType === "starting_at"
            ? null
            : rawPriceMax;

      // Only touch the image when a new one was chosen. An unchanged value
      // is left exactly as it is, including an older pasted link.
      const previewFields = previewSelection
        ? {
            preview_url: await uploadListingPreviewImage({
              userId: user.id,
              blob: previewSelection.blob,
            }),
            preview_watermarked: previewSelection.watermarked,
          }
        : {};

      const animationFields =
        animationChoice.action === "upload"
          ? {
              animated_preview_url: await uploadListingAnimation({
                userId: user.id,
                file: animationChoice.file,
                kind: animationChoice.kind,
              }),
            }
          : animationChoice.action === "remove"
            ? { animated_preview_url: null }
            : {};

      const { data: updated, error: updateError } = await supabase
        .from("listings")
        .update({
          title: form.title.trim(),
          short: form.short.trim(),
          offering_type: form.offeringType,
          fulfilment_mode: normaliseFulfilmentMode(
            form.offeringType,
            form.fulfilmentMode
          ),
          category: form.category.trim(),
          video_subtype: form.videoSubtype || null,
          price_type: form.priceType,
          price_min: priceMin,
          price_max: nextPriceMax,
          deliverables: parseDeliverables(form.deliverablesText),
          tags: parseTags(form.tagsText),
          ...previewFields,
          ...animationFields,
          status: "draft",
          is_active: false,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!updated?.id) {
        throw new Error(t("listingForm.draftOnly"));
      }

      navigate(`/creator/listings/${updated.id}`);
    } catch (error) {
      const message =
        hasErrorMessage(error)
          ? error.message
          : t("listingForm.updateFailed");

      setErrors((current) => ({
        ...current,
        submit: message,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>{t("common.loading")}</div>;
  }

  if (error || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← {t("listingForm.back")}
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>{t("listingForm.notFound")}</h1>
          <p className={classes.sub}>{t("listingForm.notFoundText")}</p>
        </div>
      </div>
    );
  }

  const isAdminHidden = isAdminHiddenListing(listing);

  if (isAdminHidden) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← {t("listingForm.back")}
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>{t("listingForm.lockedTitle")}</h1>

          <p className={classes.sub}>{t("listingForm.lockedText")}</p>

          <div className={classes.warningCard}>
            {t("listingForm.lockedNote")}
          </div>
        </div>
      </div>
    );
  }

  if (listing.status !== "draft" || listing.is_active) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← {t("listingForm.back")}
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>{t("listingForm.draftOnlyTitle")}</h1>
          <p className={classes.sub}>{t("listingForm.draftOnlyText")}</p>
        </div>
      </div>
    );
  }


  return (
    <div className={classes.page}>
      <Link to="/creator/listings" className={classes.backLink}>
        ← {t("listingForm.back")}
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>{t("listingForm.editTitle")}</h1>

        <p className={classes.sub}>{t("listingForm.editText")}</p>
      </div>

      <form className={classes.card} onSubmit={handleSubmit}>
        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>{t("listingForm.basics")}</h2>
            <p className={classes.sectionText}>
              {t("listingForm.editBasicsText")}
            </p>
          </div>

          <div className={classes.grid}>
            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="title">
                {t("listingForm.titleLabel")}
              </label>

              <input
                id="title"
                className={classes.input}
                type="text"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                maxLength={80}
              />

              <div className={classes.hint}>{t("listingForm.titleHint")}</div>

              {errors.title && <div className={classes.error}>{errors.title}</div>}
            </div>

            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="short">
                {t("listingForm.shortLabel")}
              </label>

              <textarea
                id="short"
                className={classes.textarea}
                value={form.short}
                onChange={(event) => setField("short", event.target.value)}
                maxLength={280}
              />

              <div className={classes.hint}>{t("listingForm.shortHint")}</div>

              {errors.short && <div className={classes.error}>{errors.short}</div>}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="offeringType">
                {t("listingForm.offeringLabel")}
              </label>

              <select
                id="offeringType"
                className={classes.select}
                value={form.offeringType}
                onChange={(event) =>
                  setOfferingType(event.target.value as ListingOfferingType)
                }
              >
                {offeringTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="fulfilmentMode">
                {t("buyerRequests.purchaseFlow")}
              </label>

              <select
                id="fulfilmentMode"
                className={classes.select}
                value={form.fulfilmentMode}
                onChange={(event) =>
                  setField(
                    "fulfilmentMode",
                    event.target.value as ListingFulfilmentMode
                  )
                }
              >
                {listingFulfilmentModeOptions
                  .filter((option) =>
                    getAllowedFulfilmentModes(form.offeringType).includes(option.value)
                  )
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
              </select>

              <div className={classes.hint}>
                {t("listingForm.flowHint")}
              </div>

              {errors.fulfilmentMode && (
                <div className={classes.error}>{errors.fulfilmentMode}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="category">
                {t("snapshot.category")}
              </label>

              <input
                id="category"
                className={classes.input}
                type="text"
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
              />

              {errors.category && (
                <div className={classes.error}>{errors.category}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="videoSubtype">
                {t("listingForm.videoLabel")}
              </label>

              <select
                id="videoSubtype"
                className={classes.select}
                value={form.videoSubtype}
                onChange={(event) =>
                  setField("videoSubtype", event.target.value as ListingVideoSubtype)
                }
              >
                {videoSubtypeOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>

              <div className={classes.hint}>
                {t("listingForm.videoHint")}
              </div>

              {errors.videoSubtype && (
                <div className={classes.error}>{errors.videoSubtype}</div>
              )}
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>{t("listingForm.pricing")}</h2>
            <p className={classes.sectionText}>
              {t("listingForm.editPricingText")}
            </p>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceType">
                {t("listingForm.priceTypeLabel")}
              </label>

              <select
                id="priceType"
                className={classes.select}
                value={form.priceType}
                onChange={(event) =>
                  setPriceType(event.target.value as ListingPriceType)
                }
              >
                {priceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceMin">
                {t(isRangePrice ? "listingForm.priceMin" : "snapshot.price")}
              </label>

              <input
                id="priceMin"
                className={classes.input}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.priceMin}
                onChange={(event) =>
                  setField("priceMin", normaliseIntegerInput(event.target.value))
                }
              />

              {errors.priceMin && (
                <div className={classes.error}>{errors.priceMin}</div>
              )}
            </div>

            {isRangePrice && (
              <div className={classes.field}>
                <label className={classes.label} htmlFor="priceMax">
                  {t("listingForm.priceMax")}
                </label>

                <input
                  id="priceMax"
                  className={classes.input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.priceMax}
                  onChange={(event) =>
                    setField("priceMax", normaliseIntegerInput(event.target.value))
                  }
                />

                <div className={classes.hint}>
                  {t("listingForm.priceMaxHint")}
                </div>

                {errors.priceMax && (
                  <div className={classes.error}>{errors.priceMax}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>{t("listingForm.deliverablesTags")}</h2>
            <p className={classes.sectionText}>
              {t("listingForm.deliverablesTagsText")}
            </p>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="deliverablesText">
                {t("snapshot.deliverables")}
              </label>

              <textarea
                id="deliverablesText"
                className={classes.textarea}
                value={form.deliverablesText}
                onChange={(event) =>
                  setField("deliverablesText", event.target.value)
                }
              />

              <div className={classes.hint}>{t("listingForm.deliverablesHint")}</div>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="tagsText">
                {t("snapshot.tags")}
              </label>

              <textarea
                id="tagsText"
                className={classes.textarea}
                value={form.tagsText}
                onChange={(event) => setField("tagsText", event.target.value)}
              />

              <div className={classes.hint}>{t("listingForm.tagsHint")}</div>
            </div>

            <div className={`${classes.infoBox} ${classes.full}`}>
              <div className={classes.infoTitle}>{t("listingForm.parsedPreview")}</div>

              <div className={classes.infoText}>
                {t("listingForm.parsedDeliverables", {
                  value:
                    deliverablePreview.length > 0
                      ? deliverablePreview.join(", ")
                      : t("listingForm.videoNone"),
                })}
              </div>

              <div className={classes.infoText}>
                {t("listingForm.parsedTags", {
                  value: tagPreview.length > 0 ? tagPreview.join(", ") : t("listingForm.videoNone"),
                })}
              </div>
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>{t("listingForm.preview")}</h2>
            <p className={classes.sectionText}>
              {t("listingForm.previewTextEdit")}
            </p>
          </div>

          <ListingPreviewImageField
            existingUrl={form.previewUrl || null}
            handle={profile?.handle}
            disabled={isSaving}
            onChange={setPreviewSelection}
          />

          <ListingAnimatedPreviewField
            hasExisting={Boolean(listing?.animated_preview_url)}
            disabled={isSaving}
            onChange={setAnimationChoice}
          />
        </div>

        <div className={classes.section}>
          <div className={classes.infoBox}>
            <div className={classes.infoTitle}>{t("listingForm.updateBehaviour")}</div>

            <div className={classes.infoText}>
              {t("listingForm.updateBehaviourText")}
            </div>
          </div>

          {errors.submit && (
            <div className={classes.submitError}>{errors.submit}</div>
          )}

          <div className={classes.row}>
            <button className={classes.btnPrimary} type="submit" disabled={isSaving}>
              {t(isSaving ? "listingForm.savingChanges" : "listingForm.saveChanges")}
            </button>

            <Link className={classes.btnOutline} to="/creator/listings">
              {t("common.cancel")}
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditListing;