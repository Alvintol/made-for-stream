import { describe, expect, it } from "vitest";

import {
  REQUIRED_RECENT_UPLOAD_TITLE,
  getCreatorApplicationPhase,
  getCreatorApplicationRequirements,
  getCreatorApplicationStatusLabel,
  getFirstApplicationBlocker,
  getUrlValidationError,
  getWorkSampleCounts,
  isRequiredRecentUploadSample,
  normaliseUrlInput,
  type WorkSample,
} from "../creatorApplication/creatorApplication";

const link = (title: string, url: string | null = "https://example.com"): WorkSample => ({
  sample_type: "link",
  title,
  url,
});

const recent = link(REQUIRED_RECENT_UPLOAD_TITLE, "https://youtube.com/watch?v=1");

const ready = {
  profileReady: true,
  hasLinkedPlatform: true,
  samples: [recent, link("One"), link("Two")],
  agreementsAccepted: true,
};

describe("creator application phase", () => {
  it("maps stored statuses to what the applicant can do", () => {
    expect(getCreatorApplicationPhase(null)).toBe("not_started");
    expect(getCreatorApplicationPhase("draft")).toBe("editing");
    expect(getCreatorApplicationPhase("needs_changes")).toBe("editing");
    expect(getCreatorApplicationPhase("submitted")).toBe("in_review");
    expect(getCreatorApplicationPhase("under_review")).toBe("in_review");
    expect(getCreatorApplicationPhase("approved")).toBe("approved");
    expect(getCreatorApplicationPhase("rejected")).toBe("closed");
    expect(getCreatorApplicationPhase("suspended")).toBe("closed");
  });

  it("labels statuses for applicants", () => {
    expect(getCreatorApplicationStatusLabel(undefined)).toBe("Not started");
    expect(getCreatorApplicationStatusLabel("needs_changes")).toBe("Changes requested");
    expect(getCreatorApplicationStatusLabel("rejected")).toBe("Not approved");
  });
});

describe("work sample links", () => {
  it("adds https:// to bare domains and validates the result", () => {
    expect(normaliseUrlInput("  youtube.com/watch?v=1 ")).toBe("https://youtube.com/watch?v=1");
    expect(normaliseUrlInput("http://example.com")).toBe("http://example.com");
    expect(normaliseUrlInput("   ")).toBe("");
    expect(getUrlValidationError("")).toBeNull();
    expect(getUrlValidationError("example.com/work")).toBeNull();
    expect(getUrlValidationError("ftp://example.com")).not.toBeNull();
  });

  it("refuses links the database would refuse", () => {
    expect(getUrlValidationError("https://youtube.com@evil.example/watch")).not.toBeNull();
    expect(getUrlValidationError("https://example.com/my work")).not.toBeNull();
    expect(getUrlValidationError("javascript:alert(1)")).not.toBeNull();
    expect(getUrlValidationError("youtube.com/watch?v=1")).toBeNull();
  });

  it("recognises the required recent-upload sample by title, ignoring case", () => {
    expect(isRequiredRecentUploadSample(link("most recent upload/vod"))).toBe(true);
    expect(isRequiredRecentUploadSample({ ...recent, sample_type: "video" })).toBe(false);
    expect(isRequiredRecentUploadSample(link("Portfolio"))).toBe(false);
  });

  it("counts samples, videos and whether the recent upload has a link", () => {
    expect(
      getWorkSampleCounts([recent, { sample_type: "video", title: "Reel", url: "https://x.com" }])
    ).toEqual({ total: 2, videos: 1, hasRecentUpload: true });
    expect(getWorkSampleCounts([link(REQUIRED_RECENT_UPLOAD_TITLE, " ")]).hasRecentUpload).toBe(false);
  });
});

describe("submission requirements", () => {
  it("is ready once every requirement is met", () => {
    expect(getFirstApplicationBlocker(getCreatorApplicationRequirements(ready))).toBeNull();
  });

  it("reports the first unmet requirement in order", () => {
    const blocker = getFirstApplicationBlocker(
      getCreatorApplicationRequirements({ ...ready, hasLinkedPlatform: false, agreementsAccepted: false })
    );

    expect(blocker?.key).toBe("platform");
  });

  it("requires the recent upload even when there are enough other samples", () => {
    const blocker = getFirstApplicationBlocker(
      getCreatorApplicationRequirements({ ...ready, samples: [link("One"), link("Two"), link("Three")] })
    );

    expect(blocker?.key).toBe("recentUpload");
  });

  it("explains why the sample set is not acceptable", () => {
    const tooFew = getCreatorApplicationRequirements({ ...ready, samples: [recent, link("One")] });
    expect(getFirstApplicationBlocker(tooFew)?.blocker).toBe("Add at least 3 work samples (2 so far).");

    const video = (title: string): WorkSample => ({ sample_type: "video", title, url: "https://x.com" });
    const tooManyVideos = getCreatorApplicationRequirements({
      ...ready,
      samples: [recent, video("A"), video("B")],
    });
    expect(getFirstApplicationBlocker(tooManyVideos)?.blocker).toBe("Only 1 video sample is allowed.");

    const tooMany = getCreatorApplicationRequirements({
      ...ready,
      samples: [recent, ...Array.from({ length: 10 }, (_, index) => link(`Sample ${index}`))],
    });
    expect(getFirstApplicationBlocker(tooMany)?.blocker).toBe("Remove samples to stay within 10.");
  });
});
