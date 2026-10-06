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
      nextErrors.title = "Title must be between 3 and 80 characters.";
    }

    if (short.length < 10 || short.length > 280) {
      nextErrors.short = "Short description must be between 10 and 280 characters.";
    }

    if (!category) {
      nextErrors.category = "Category is required.";
    }

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

    if (
      form.videoSubtype &&
      form.videoSubtype !== "long-form" &&
      form.videoSubtype !== "short-form"
    ) {
      nextErrors.videoSubtype = "Video subtype must be long-form or short-form.";
    }

    if (
      !getAllowedFulfilmentModes(form.offeringType).includes(form.fulfilmentMode)
    ) {
      nextErrors.fulfilmentMode =
        "This purchase flow is not allowed for the selected offering type.";
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
        throw new Error("Only draft listings can be edited right now.");
      }

      navigate(`/creator/listings/${updated.id}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The listing draft could not be updated.";

      setErrors((current) => ({
        ...current,
        submit: message,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← Back to my listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing not found</h1>
          <p className={classes.sub}>
            This listing could not be loaded from your creator account.
          </p>
        </div>
      </div>
    );
  }

  const isAdminHidden = isAdminHiddenListing(listing);

  if (isAdminHidden) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← Back to my listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing locked by moderation</h1>

          <p className={classes.sub}>
            This listing has been hidden by an admin and cannot be edited,
            published, restored, or deleted by the creator account right now.
          </p>

          <div className={classes.warningCard}>
            Check your reports page for moderator updates, or wait for an admin to
            restore the listing.
          </div>
        </div>
      </div>
    );
  }

  if (listing.status !== "draft" || listing.is_active) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← Back to my listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Draft-only editing</h1>
          <p className={classes.sub}>
            Only inactive draft listings can be edited in this first pass.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className={classes.page}>
      <Link to="/creator/listings" className={classes.backLink}>
        ← Back to my listings
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Edit draft listing</h1>

        <p className={classes.sub}>
          Update your private draft listing. Publishing and activation are still
          intentionally out of scope here.
        </p>
      </div>

      <form className={classes.card} onSubmit={handleSubmit}>
        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Basics</h2>
            <p className={classes.sectionText}>
              Edit the core listing details that will later feed the public view.
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
                Digital listings can be request-based or instant. Commissions and services
                stay request-only in this first pass.
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
              />

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
          </div>
        </div>

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Pricing</h2>
            <p className={classes.sectionText}>
              Draft updates keep the listing private and inactive.
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

        <div className={classes.section}>
          <div>
            <h2 className={classes.sectionTitle}>Deliverables and tags</h2>
            <p className={classes.sectionText}>
              These stay optional and are trimmed before saving.
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
              An image that shows your work. A listing needs one before it can be published.
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
            <div className={classes.infoTitle}>Update behaviour</div>

            <div className={classes.infoText}>
              Saving keeps this listing in private draft mode:
              <strong> status = draft</strong> and <strong>is_active = false</strong>.
            </div>
          </div>

          {errors.submit && (
            <div className={classes.submitError}>{errors.submit}</div>
          )}

          <div className={classes.row}>
            <button className={classes.btnPrimary} type="submit" disabled={isSaving}>
              {isSaving ? "Saving changes…" : "Save changes"}
            </button>

            <Link className={classes.btnOutline} to="/creator/listings">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditListing;