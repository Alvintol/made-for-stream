import { english, type Translate } from "../../lib/i18n/i18n";

export type CreatorApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "suspended";

// What the applicant can do right now, derived from the stored status.
export type CreatorApplicationPhase = "not_started" | "editing" | "in_review" | "approved" | "closed";

export const MIN_WORK_SAMPLES = 3;
export const MAX_WORK_SAMPLES = 10;
export const MAX_VIDEO_SAMPLES = 1;

// Saved with the sample and matched on, so it stays English; the page shows
// apply.recentSampleTitle.
export const REQUIRED_RECENT_UPLOAD_TITLE = "Most Recent Upload/Vod";
export const REQUIRED_RECENT_UPLOAD_DESCRIPTION =
  "Link to your most recent public upload, VOD, or equivalent recent creator work.";

export type WorkSample = {
  sample_type: "link" | "image" | "video";
  title: string;
  url: string | null;
};

export const getCreatorApplicationPhase = (
  status: CreatorApplicationStatus | null | undefined
): CreatorApplicationPhase => {
  switch (status) {
    case undefined:
    case null:
      return "not_started";
    case "draft":
    case "needs_changes":
      return "editing";
    case "submitted":
    case "under_review":
      return "in_review";
    case "approved":
      return "approved";
    default:
      return "closed";
  }
};

export const getCreatorApplicationStatusLabel = (
  status: CreatorApplicationStatus | null | undefined,
  t: Translate = english
): string => {
  switch (status) {
    case "draft":
    case "needs_changes":
    case "submitted":
    case "under_review":
    case "approved":
    case "rejected":
    case "suspended":
      return t(`apply.status.${status}`);
    default:
      return t("apply.status.none");
  }
};

// Accepts bare domains by assuming https://.
export const normaliseUrlInput = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) return "";

  return /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const isValidPublicUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    // Same rule the database enforces (20261005_141): an ordinary web
    // address, no spaces, and no "user@" part that disguises the real site.
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !/\s/.test(value.trim())
    );
  } catch {
    return false;
  }
};

export const getUrlValidationError = (value: string, t: Translate = english): string | null => {
  if (!value.trim()) return null;

  return isValidPublicUrl(normaliseUrlInput(value))
    ? null
    : t("apply.urlError");
};

export const isRequiredRecentUploadSample = (sample: WorkSample): boolean =>
  sample.sample_type === "link" &&
  sample.title.trim().toLowerCase() === REQUIRED_RECENT_UPLOAD_TITLE.toLowerCase();

export type CreatorApplicationRequirementKey =
  | "profile"
  | "platform"
  | "recentUpload"
  | "samples"
  | "agreements";

export type CreatorApplicationRequirement = {
  key: CreatorApplicationRequirementKey;
  label: string;
  done: boolean;
  // Shown when the requirement blocks submission.
  blocker: string;
};

export type CreatorApplicationReadinessInput = {
  profileReady: boolean;
  hasLinkedPlatform: boolean;
  samples: WorkSample[];
  agreementsAccepted: boolean;
};

export const getWorkSampleCounts = (samples: WorkSample[]) => ({
  total: samples.length,
  videos: samples.filter((sample) => sample.sample_type === "video").length,
  hasRecentUpload: samples.some(
    (sample) => isRequiredRecentUploadSample(sample) && Boolean(sample.url?.trim())
  ),
});

export const getCreatorApplicationRequirements = (
  input: CreatorApplicationReadinessInput,
  t: Translate = english
): CreatorApplicationRequirement[] => {
  const counts = getWorkSampleCounts(input.samples);
  const samplesOk =
    counts.total >= MIN_WORK_SAMPLES &&
    counts.total <= MAX_WORK_SAMPLES &&
    counts.videos <= MAX_VIDEO_SAMPLES;

  return [
    {
      key: "profile",
      label: t("apply.reqProfile"),
      done: input.profileReady,
      blocker: t("apply.reqProfileBlock"),
    },
    {
      key: "platform",
      label: t("apply.reqPlatform"),
      done: input.hasLinkedPlatform,
      blocker: t("apply.reqPlatformBlock"),
    },
    {
      key: "recentUpload",
      label: t("apply.reqRecent"),
      done: counts.hasRecentUpload,
      blocker: t("apply.reqRecentBlock"),
    },
    {
      key: "samples",
      label: t("apply.reqSamples", {
        min: MIN_WORK_SAMPLES,
        max: MAX_WORK_SAMPLES,
        videos: MAX_VIDEO_SAMPLES,
      }),
      done: samplesOk,
      blocker:
        counts.videos > MAX_VIDEO_SAMPLES
          ? t("apply.reqSamplesVideos", { count: MAX_VIDEO_SAMPLES })
          : counts.total > MAX_WORK_SAMPLES
            ? t("apply.reqSamplesMax", { max: MAX_WORK_SAMPLES })
            : t("apply.reqSamplesMin", { min: MIN_WORK_SAMPLES, count: counts.total }),
    },
    {
      key: "agreements",
      label: t("apply.reqAgreements"),
      done: input.agreementsAccepted,
      blocker: t("apply.reqAgreementsBlock"),
    },
  ];
};

// The first unmet requirement, or null when the application can be submitted.
export const getFirstApplicationBlocker = (
  requirements: CreatorApplicationRequirement[]
): CreatorApplicationRequirement | null => requirements.find((item) => !item.done) ?? null;
