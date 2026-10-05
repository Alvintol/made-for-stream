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
  status: CreatorApplicationStatus | null | undefined
): string => {
  switch (status) {
    case "draft":
      return "Draft";
    case "needs_changes":
      return "Changes requested";
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Not approved";
    case "suspended":
      return "Suspended";
    default:
      return "Not started";
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

export const getUrlValidationError = (value: string): string | null => {
  if (!value.trim()) return null;

  return isValidPublicUrl(normaliseUrlInput(value))
    ? null
    : "Enter a valid public link, e.g. youtube.com/watch?v=…";
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
  input: CreatorApplicationReadinessInput
): CreatorApplicationRequirement[] => {
  const counts = getWorkSampleCounts(input.samples);
  const samplesOk =
    counts.total >= MIN_WORK_SAMPLES &&
    counts.total <= MAX_WORK_SAMPLES &&
    counts.videos <= MAX_VIDEO_SAMPLES;

  return [
    {
      key: "profile",
      label: "Handle and display name set",
      done: input.profileReady,
      blocker: "Add a handle and display name in settings.",
    },
    {
      key: "platform",
      label: "Creator platform linked",
      done: input.hasLinkedPlatform,
      blocker: "Link Twitch or YouTube in settings.",
    },
    {
      key: "recentUpload",
      label: "Most recent upload or VOD added",
      done: counts.hasRecentUpload,
      blocker: "Add your most recent upload or VOD link.",
    },
    {
      key: "samples",
      label: `${MIN_WORK_SAMPLES}–${MAX_WORK_SAMPLES} work samples (max ${MAX_VIDEO_SAMPLES} video)`,
      done: samplesOk,
      blocker:
        counts.videos > MAX_VIDEO_SAMPLES
          ? `Only ${MAX_VIDEO_SAMPLES} video sample is allowed.`
          : counts.total > MAX_WORK_SAMPLES
            ? `Remove samples to stay within ${MAX_WORK_SAMPLES}.`
            : `Add at least ${MIN_WORK_SAMPLES} work samples (${counts.total} so far).`,
    },
    {
      key: "agreements",
      label: "Terms and acknowledgements accepted",
      done: input.agreementsAccepted,
      blocker: "Accept the creator terms and acknowledgements.",
    },
  ];
};

// The first unmet requirement, or null when the application can be submitted.
export const getFirstApplicationBlocker = (
  requirements: CreatorApplicationRequirement[]
): CreatorApplicationRequirement | null => requirements.find((item) => !item.done) ?? null;
