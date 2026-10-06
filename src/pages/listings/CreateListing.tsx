import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import {
  allowsFreeListing,
  FREE_ASSET_MAX_BYTES,
  freeDeliveryTypeOptions,
  FreeDeliveryType,
  getAllowedFulfilmentModes,
  ListingFulfilmentMode,
  listingFulfilmentModeOptions,
  normaliseFulfilmentMode,
  validateFreeListingInput,
} from '../../domain/listings/listings';
import { getListingPublishReadiness } from "../../lib/listings/listingPublishReadiness";
import { usePublishListing } from "../../hooks/listings/usePublishListing";
import ListingPublishChecklist from "../../components/listings/ListingPublishChecklist";
import ListingPreviewImageField, {
  type ListingPreviewSelection,
} from "../../components/listings/ListingPreviewImageField";
import { uploadListingPreviewImage } from "../../lib/listings/listingPreviewImage";
import { useMyProfile } from "../../hooks/profile/useMyProfile";
import ListingAnimatedPreviewField, {
  type ListingAnimationChoice,
} from "../../components/listings/ListingAnimatedPreviewField";
import { uploadListingAnimation } from "../../lib/listings/listingAnimatedPreview";

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
  isFree: boolean;
  freeDeliveryType: FreeDeliveryType | "";
  freeExternalUrl: string;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  submit?: string;
  free?: string;
};

const classes = {
  page: "space-y-6",
  backLink: "backLink",

  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  layout: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start",
  // Clears the sticky site header, like the other side panels.
  aside: "card space-y-4 p-4 lg:order-last lg:sticky lg:top-24",
  asideTitle: "text-base font-bold text-zinc-900",
  asideStatus:
    "rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  asideButtons: "flex flex-col gap-2",

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
} as const;

const offeringTypeOptions: Array<{
  value: ListingOfferingType;
  label: string;
}> = [
    { value: "digital", label: "Digital" },
    { value: "commission", label: "Commission" },
    { value: "service", label: "Service" },
  ];

const priceTypeOptions: Array<{
  value: ListingPriceType;
  label: string;
}> = [
    { value: "fixed", label: "Fixed price" },
    { value: "starting_at", label: "Starting at" },
    { value: "range", label: "Price range" },
  ];

const videoSubtypeOptions: Array<{
  value: ListingVideoSubtype;
  label: string;
}> = [
    { value: "", label: "None" },
    { value: "long-form", label: "Long-form" },
    { value: "short-form", label: "Short-form" },
  ];

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
  isFree: false,
  freeDeliveryType: "",
  freeExternalUrl: "",
};

// Keeps the free-listing file input's error text short and readable
const formatFileSize = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

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

// Parses a numeric field while keeping empty input as null
const normaliseIntegerInput = (value: string) =>
  value.replace(/[^\d]/g, "");

const parseInteger = (value: string) => {
  if (!value.trim()) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};


const CreateListing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [freeFile, setFreeFile] = useState<File | null>(null);
  // The prepared thumbnail, uploaded when the listing is saved.
  const [previewSelection, setPreviewSelection] = useState<ListingPreviewSelection | null>(null);
  // The optional GIF, also uploaded on save.
  const [animationChoice, setAnimationChoice] = useState<ListingAnimationChoice>({
    action: "keep",
  });
  const { data: profile } = useMyProfile();

  // Which button submitted the form: save a draft, or save and publish.
  const publishAfterSaveRef = useRef(false);
  const publishListing = usePublishListing();

  const isRangePrice = form.priceType === "range";
  const canOfferFree = allowsFreeListing(form.offeringType);
  const isFreeListing = canOfferFree && form.isFree;

  const deliverablePreview = useMemo(
    () => parseDeliverables(form.deliverablesText),
    [form.deliverablesText]
  );

  const tagPreview = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  // The same checklist the details page uses, fed from what is typed so far,
  // so the creator can see what publishing needs before saving anything.
  const publishReadiness = useMemo(() => {
    const priceMin = isFreeListing ? 0 : parseInteger(form.priceMin);
    const priceMax = isFreeListing
      ? 0
      : form.priceType === "fixed"
        ? priceMin
        : form.priceType === "starting_at"
          ? null
          : parseInteger(form.priceMax);

    return getListingPublishReadiness({
      title: form.title,
      short: form.short,
      category: form.category,
      video_subtype: form.videoSubtype || null,
      price_type: isFreeListing ? "fixed" : form.priceType,
      // An empty price fails the check rather than counting as zero.
      price_min: priceMin ?? -1,
      price_max: priceMax,
      deliverables: deliverablePreview,
      tags: tagPreview,
      // Not uploaded yet, but chosen: that is what the checklist asks for.
      preview_url: previewSelection ? "chosen" : "",
    });
  }, [deliverablePreview, form, isFreeListing, previewSelection, tagPreview]);

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, submit: undefined }));
  };

  const setOfferingType = (value: ListingOfferingType) => {
    setForm((current) => ({
      ...current,
      offeringType: value,
      fulfilmentMode: normaliseFulfilmentMode(value, current.fulfilmentMode),
      // Free listings are digital-only: switching away clears it rather
      // than leaving a hidden, invalid combination in state.
      isFree: allowsFreeListing(value) ? current.isFree : false,
    }));

    setErrors((current) => ({
      ...current,
      offeringType: undefined,
      fulfilmentMode: undefined,
      submit: undefined,
    }));
  };

  const setIsFree = (value: boolean) => {
    setForm((current) => ({ ...current, isFree: value }));
    if (!value) setFreeFile(null);

    setErrors((current) => ({
      ...current,
      free: undefined,
      priceMin: undefined,
      priceMax: undefined,
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
      nextErrors.title = "Title must be between 3 and 80 characters.";
    }

    if (short.length < 10 || short.length > 280) {
      nextErrors.short = "Short description must be between 10 and 280 characters.";
    }

    if (!category) {
      nextErrors.category = "Category is required.";
    }

    if (isFreeListing) {
      const freeError = validateFreeListingInput({
        isFree: true,
        deliveryType: form.freeDeliveryType || null,
        externalUrl: form.freeExternalUrl,
        hasFile: Boolean(freeFile),
        fileSizeBytes: freeFile?.size ?? null,
      });

      if (freeError) nextErrors.free = freeError;
    } else {
      if (priceMin === null || priceMin < 0) {
        nextErrors.priceMin = "Price min must be 0 or greater.";
      }

      if (form.priceType === "range") {
        if (rawPriceMax === null) {
          nextErrors.priceMax = "Price max is required for a range listing.";
        } else if (priceMin !== null && rawPriceMax < priceMin) {
          nextErrors.priceMax = "Price max must be greater than or equal to price min.";
        }
      } else if (rawPriceMax !== null && priceMin !== null && rawPriceMax < priceMin) {
        nextErrors.priceMax = "Price max must be greater than or equal to price min.";
      }
    }

    if (
      !getAllowedFulfilmentModes(form.offeringType).includes(form.fulfilmentMode)
    ) {
      nextErrors.fulfilmentMode =
        "This purchase flow is not allowed for the selected offering type.";
    }

    if (
      form.videoSubtype &&
      form.videoSubtype !== "long-form" &&
      form.videoSubtype !== "short-form"
    ) {
      nextErrors.videoSubtype = "Video subtype must be long-form or short-form.";
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      priceMin,
      rawPriceMax,
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const publishAfterSave = publishAfterSaveRef.current;
    publishAfterSaveRef.current = false;

    const { isValid, priceMin, rawPriceMax } = validate();
    if (!isValid || !user?.id) return;
    if (!isFreeListing && priceMin === null) return;
    if (publishAfterSave && !publishReadiness.isReady) return;

    setIsSaving(true);

    try {
      const nextPriceMax =
        form.priceType === "fixed"
          ? priceMin
          : form.priceType === "starting_at"
            ? null
            : rawPriceMax;

      // Free listings skip pricing entirely and carry their own delivery
      // fields instead: either an uploaded file, or an external link.
      let freeFields: {
        is_free: boolean;
        free_delivery_type: FreeDeliveryType | null;
        free_external_url: string | null;
        free_file_path: string | null;
        free_file_name: string | null;
        free_file_size_bytes: number | null;
      } = {
        is_free: false,
        free_delivery_type: null,
        free_external_url: null,
        free_file_path: null,
        free_file_name: null,
        free_file_size_bytes: null,
      };

      if (isFreeListing && form.freeDeliveryType === "download" && freeFile) {
        const filePath = `${user.id}/${crypto.randomUUID()}-${freeFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from("free-assets")
          .upload(filePath, freeFile);

        if (uploadError) throw uploadError;

        freeFields = {
          is_free: true,
          free_delivery_type: "download",
          free_external_url: null,
          free_file_path: filePath,
          free_file_name: freeFile.name,
          free_file_size_bytes: freeFile.size,
        };
      } else if (isFreeListing && form.freeDeliveryType === "external_link") {
        freeFields = {
          is_free: true,
          free_delivery_type: "external_link",
          free_external_url: form.freeExternalUrl.trim(),
          free_file_path: null,
          free_file_name: null,
          free_file_size_bytes: null,
        };
      }

      const previewUrl = previewSelection
        ? await uploadListingPreviewImage({ userId: user.id, blob: previewSelection.blob })
        : null;

      const animatedPreviewUrl =
        animationChoice.action === "upload"
          ? await uploadListingAnimation({ userId: user.id, file: animationChoice.file })
          : null;

      const { data: created, error } = await supabase.from("listings").insert({
        user_id: user.id,
        title: form.title.trim(),
        short: form.short.trim(),
        offering_type: form.offeringType,
        category: form.category.trim(),
        video_subtype: form.videoSubtype || null,
        // Free listings always carry a "fixed $0" price so the not-null
        // price columns stay satisfied without a schema change.
        price_type: isFreeListing ? "fixed" : form.priceType,
        price_min: isFreeListing ? 0 : priceMin,
        price_max: isFreeListing ? 0 : nextPriceMax,
        deliverables: parseDeliverables(form.deliverablesText),
        tags: parseTags(form.tagsText),
        preview_url: previewUrl,
        preview_watermarked: Boolean(previewSelection?.watermarked),
        animated_preview_url: animatedPreviewUrl,
        status: "draft",
        is_active: false,
        fulfilment_mode: normaliseFulfilmentMode(
          form.offeringType,
          form.fulfilmentMode
        ),
        ...freeFields,
      })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      const detailsPath = `/creator/listings/${created.id}`;

      if (!publishAfterSave) {
        navigate(detailsPath);
        return;
      }

      // The draft is saved either way. If publishing is refused (payouts not
      // set up, for example), land on the details page and say why there.
      try {
        await publishListing.mutateAsync(created.id);
        navigate(detailsPath);
      } catch (publishError) {
        navigate(detailsPath, {
          state: {
            publishError:
              publishError instanceof Error ? publishError.message : "please try again.",
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The listing draft could not be saved.";

      setErrors((current) => ({
        ...current,
        submit: message,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={classes.page}>
      <Link to="/creator/listings" className={classes.backLink}>
        ← Back to creator listings
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Create listing</h1>

        <p className={classes.sub}>
          Fill this in, then publish it straight away or save it as a private draft to finish
          later. Buyers only see a listing once it is published.
        </p>
      </div>

      <div className={classes.layout}>
      <aside className={classes.aside} aria-label="Publish checklist">
        <h2 className={classes.asideTitle}>Publish checklist</h2>

        <div className={classes.asideStatus} role="status">
          <strong>Not saved yet.</strong> Nothing is visible to buyers until you publish.
        </div>

        <ListingPublishChecklist readiness={publishReadiness} />

        <div className={classes.asideButtons}>
          <button
            className={classes.btnPrimary}
            type="submit"
            form="create-listing-form"
            disabled={isSaving || !publishReadiness.isReady}
            onClick={() => {
              publishAfterSaveRef.current = true;
            }}
          >
            {isSaving ? "Saving…" : "Publish now"}
          </button>

          <button
            className={classes.btnOutline}
            type="submit"
            form="create-listing-form"
            disabled={isSaving}
            onClick={() => {
              publishAfterSaveRef.current = false;
            }}
          >
            {isSaving ? "Saving…" : "Save as draft"}
          </button>
        </div>

        {!publishReadiness.isReady && (
          <p className={classes.sectionText}>
            Finish the checklist to publish now. You can save a draft at any point.
          </p>
        )}

        {errors.submit && <div className={classes.submitError}>{errors.submit}</div>}
      </aside>

      <form id="create-listing-form" className={classes.card} onSubmit={handleSubmit}>
        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Basics</h2>
            <p className={classes.sectionText}>
              Add the core details buyers will eventually see when publishing is
              added.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="title">
                Title
              </label>

              <input
                id="title"
                className={classes.input}
                type="text"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Cozy Emote Pack (12)"
                maxLength={80}
              />

              <div className={classes.hint}>3 to 80 characters.</div>

              {errors.title && <div className={classes.error}>{errors.title}</div>}
            </div>

            <div className={`${classes.field} ${classes.full}`}>
              <label className={classes.label} htmlFor="short">
                Short description
              </label>

              <textarea
                id="short"
                className={classes.textarea}
                value={form.short}
                onChange={(event) => setField("short", event.target.value)}
                placeholder="12 emotes + variants. Includes PNG + licence notes."
                maxLength={280}
              />

              <div className={classes.hint}>10 to 280 characters.</div>

              {errors.short && <div className={classes.error}>{errors.short}</div>}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="offeringType">
                Offering type
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
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="fulfilmentMode">
                Purchase flow
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
                      {option.label}
                    </option>
                  ))}
              </select>

              <div className={classes.hint}>
                Digital listings can be request-based or instant later. Commissions and
                services stay request-only in this first pass.
              </div>

              {errors.fulfilmentMode && (
                <div className={classes.error}>{errors.fulfilmentMode}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="category">
                Category
              </label>

              <input
                id="category"
                className={classes.input}
                type="text"
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
                placeholder="emotes"
              />

              <div className={classes.hint}>
                Keep this aligned with your existing marketplace category values.
              </div>

              {errors.category && (
                <div className={classes.error}>{errors.category}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="videoSubtype">
                Video subtype
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
                    {option.label}
                  </option>
                ))}
              </select>

              <div className={classes.hint}>
                Leave empty unless this listing is for video work.
              </div>

              {errors.videoSubtype && (
                <div className={classes.error}>{errors.videoSubtype}</div>
              )}
            </div>

            {canOfferFree && (
              <div className={`${classes.field} ${classes.full}`}>
                <label className={classes.label} htmlFor="isFree">
                  <input
                    id="isFree"
                    type="checkbox"
                    checked={form.isFree}
                    onChange={(event) => setIsFree(event.target.checked)}
                  />{" "}
                  Give this away for free
                </label>

                <div className={classes.hint}>
                  Free listings skip pricing and Stripe entirely. Buyers get it
                  through a direct download or a link you provide, no payment step.
                </div>
              </div>
            )}
          </div>
        </div>

        {isFreeListing ? (
          <div className={classes.section}>
            <div>
              <h2 className={classes.sectionTitle}>Free delivery</h2>
              <p className={classes.sectionText}>
                Choose how buyers get this listing. Downloadable assets are
                uploaded and hosted here; games or anything not downloadable
                should link out to wherever it&apos;s hosted.
              </p>
            </div>

            <div className={classes.grid}>
              <div className={classes.field}>
                <label className={classes.label} htmlFor="freeDeliveryType">
                  Delivery method
                </label>

                <select
                  id="freeDeliveryType"
                  className={classes.select}
                  value={form.freeDeliveryType}
                  onChange={(event) =>
                    setField(
                      "freeDeliveryType",
                      event.target.value as FreeDeliveryType | ""
                    )
                  }
                >
                  <option value="">Choose one…</option>
                  {freeDeliveryTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {form.freeDeliveryType === "download" && (
                <div className={classes.field}>
                  <label className={classes.label} htmlFor="freeFile">
                    File
                  </label>

                  <input
                    id="freeFile"
                    className={classes.input}
                    type="file"
                    onChange={(event) =>
                      setFreeFile(event.target.files?.[0] ?? null)
                    }
                  />

                  <div className={classes.hint}>
                    {freeFile
                      ? `${freeFile.name} (${formatFileSize(freeFile.size)})`
                      : `Up to ${formatFileSize(FREE_ASSET_MAX_BYTES)} per file.`}
                  </div>
                </div>
              )}

              {form.freeDeliveryType === "external_link" && (
                <div className={classes.field}>
                  <label className={classes.label} htmlFor="freeExternalUrl">
                    Link
                  </label>

                  <input
                    id="freeExternalUrl"
                    className={classes.input}
                    type="text"
                    value={form.freeExternalUrl}
                    onChange={(event) =>
                      setField("freeExternalUrl", event.target.value)
                    }
                    placeholder="https://itch.io/my-game"
                  />

                  <div className={classes.hint}>
                    Buyers are sent here directly — itch.io, Steam, GitHub, a
                    playable build, wherever it lives.
                  </div>
                </div>
              )}

              {errors.free && (
                <div className={`${classes.error} ${classes.full}`}>
                  {errors.free}
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Pricing</h2>
            <p className={classes.sectionText}>
              Draft listings stay private and inactive even after saving.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceType">
                Price type
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
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceMin">
                {isRangePrice ? "Price min" : "Price"}
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
                placeholder={form.priceType === "starting_at" ? "5" : "18"}
              />

              {errors.priceMin && (
                <div className={classes.error}>{errors.priceMin}</div>
              )}
            </div>

            {isRangePrice && (
              <div className={classes.field}>
                <label className={classes.label} htmlFor="priceMax">
                  Price max
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
                  placeholder="30"
                />

                <div className={classes.hint}>
                  Required only when price type is set to range.
                </div>

                {errors.priceMax && (
                  <div className={classes.error}>{errors.priceMax}</div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Deliverables and tags</h2>
            <p className={classes.sectionText}>
              These are optional in the first pass and can stay empty.
            </p>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="deliverablesText">
                Deliverables
              </label>

              <textarea
                id="deliverablesText"
                className={classes.textarea}
                value={form.deliverablesText}
                onChange={(event) =>
                  setField("deliverablesText", event.target.value)
                }
                placeholder={"png\npsd\nsource files"}
              />

              <div className={classes.hint}>Enter one deliverable per line.</div>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="tagsText">
                Tags
              </label>

              <textarea
                id="tagsText"
                className={classes.textarea}
                value={form.tagsText}
                onChange={(event) => setField("tagsText", event.target.value)}
                placeholder="emotes, png, cozy"
              />

              <div className={classes.hint}>Separate tags with commas.</div>
            </div>

            <div className={`${classes.infoBox} ${classes.full}`}>
              <div className={classes.infoTitle}>Parsed preview</div>

              <div className={classes.infoText}>
                Deliverables:{" "}
                {deliverablePreview.length > 0
                  ? deliverablePreview.join(", ")
                  : "None"}
              </div>

              <div className={classes.infoText}>
                Tags: {tagPreview.length > 0 ? tagPreview.join(", ") : "None"}
              </div>
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Preview</h2>
            <p className={classes.sectionText}>
              An image that shows your work. A draft can be saved without one, but a listing
              needs one before it can be published.
            </p>
          </div>

          <ListingPreviewImageField
            existingUrl={null}
            handle={profile?.handle}
            disabled={isSaving}
            onChange={setPreviewSelection}
          />

          <ListingAnimatedPreviewField
            hasExisting={false}
            disabled={isSaving}
            onChange={setAnimationChoice}
          />
        </div>

        <div className={classes.section}>
          <div className={classes.infoBox}>
            <div className={classes.infoTitle}>What happens next</div>

            <div className={classes.infoText}>
              <strong>Publish now</strong> saves the listing and puts it in the market.{" "}
              <strong>Save as draft</strong> keeps it private. Either way you land on the
              listing's page, which shows its status.
            </div>
          </div>

          {errors.submit && (
            <div className={classes.submitError}>{errors.submit}</div>
          )}

          <div className={classes.row}>
            <button
              className={classes.btnPrimary}
              type="submit"
              disabled={isSaving || !publishReadiness.isReady}
              onClick={() => {
                publishAfterSaveRef.current = true;
              }}
            >
              {isSaving ? "Saving…" : "Publish now"}
            </button>

            <button
              className={classes.btnOutline}
              type="submit"
              disabled={isSaving}
              onClick={() => {
                publishAfterSaveRef.current = false;
              }}
            >
              {isSaving ? "Saving…" : "Save as draft"}
            </button>

            <Link className={classes.btnOutline} to="/creator/listings">
              Cancel
            </Link>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};

export default CreateListing;