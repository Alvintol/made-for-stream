import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATEGORIES } from "../catalog";
import {
  APPLICATION_OFFERINGS,
  REQUIRED_RECENT_UPLOAD_TITLE,
  getCreatorApplicationPhase,
  getCreatorApplicationRequirements,
  getCreatorApplicationStatusLabel,
  getFirstApplicationBlocker,
  getUrlValidationError,
  getWorkSampleCounts,
  isRequiredRecentUploadSample,
  meetsAudienceMinimum,
  getOfferingsError,
  normaliseOfferings,
  normaliseUrlInput,
  toOfferingsPatch,
  type ApplicationOffering,
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
  audience: { twitchStatus: "affiliate" as const, twitchFollowers: 300, youtubeSubscribers: null },
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

describe("audience minimum", () => {
  it("takes Twitch Affiliate or Partner with 300 followers, or 500 YouTube subscribers", () => {
    expect(meetsAudienceMinimum({ twitchStatus: "affiliate", twitchFollowers: 300, youtubeSubscribers: null })).toBe(true);
    expect(meetsAudienceMinimum({ twitchStatus: "partner", twitchFollowers: 5000, youtubeSubscribers: null })).toBe(true);
    expect(meetsAudienceMinimum({ twitchStatus: null, twitchFollowers: null, youtubeSubscribers: 500 })).toBe(true);
  });

  it("refuses anything below the minimums", () => {
    expect(meetsAudienceMinimum({ twitchStatus: "affiliate", twitchFollowers: 299, youtubeSubscribers: 499 })).toBe(false);
    expect(meetsAudienceMinimum({ twitchStatus: "none", twitchFollowers: 10000, youtubeSubscribers: null })).toBe(false);
    expect(meetsAudienceMinimum({ twitchStatus: null, twitchFollowers: null, youtubeSubscribers: null })).toBe(false);
  });

  it("blocks submission until it is met", () => {
    const blocker = getFirstApplicationBlocker(
      getCreatorApplicationRequirements({ ...ready, audience: { twitchStatus: "none", twitchFollowers: 0, youtubeSubscribers: 0 } })
    );

    expect(blocker?.key).toBe("audience");
  });
});

describe("what an applicant will offer", () => {
  it("offers every listing category plus something else, in the database's own list", () => {
    expect(APPLICATION_OFFERINGS).toEqual([...CATEGORIES.map((category) => category.key), "other"]);

    const migration = fs.readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/20261112_197_add_creator_application_offerings.sql"),
      "utf8",
    );
    const listed = [...(migration.match(/array\[([^\]]+)\]::text\[\]/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(listed).toEqual([...APPLICATION_OFFERINGS]);
  });

  it("keeps known answers in the list's order and drops the rest", () => {
    expect(normaliseOfferings(["other", "emotes", "emotes", "nonsense", null])).toEqual(["emotes", "other"]);
    expect(normaliseOfferings(null)).toEqual([]);
  });

  it("needs at least one offering to submit, when it's asked", () => {
    const base = {
      profileReady: true,
      hasLinkedPlatform: true,
      audience: { twitchStatus: "affiliate" as const, twitchFollowers: 300, youtubeSubscribers: null },
      samples: [],
      agreementsAccepted: true,
    };
    const offerings = (value: readonly ApplicationOffering[]) =>
      getCreatorApplicationRequirements({ ...base, offerings: value }).find((item) => item.key === "offerings");

    expect(offerings([])?.done).toBe(false);
    expect(offerings([])?.blocker).toBe("Choose at least one thing you'll offer before you apply.");
    expect(offerings(["games"])?.done).toBe(true);
    // Not asked: no requirement at all.
    expect(getCreatorApplicationRequirements(base).some((item) => item.key === "offerings")).toBe(false);
  });
});

describe("saving what someone offers", () => {
  it("needs at least one, and a description of 80 characters or fewer for something else", () => {
    expect(getOfferingsError([], "")).toBe("Choose at least one thing you'll offer before you apply.");
    expect(getOfferingsError(["other"], "  ")).toBe("Tell us what else you'll offer.");
    expect(getOfferingsError(["other"], "x".repeat(81))).toBe("Keep it to 80 characters.");
    expect(getOfferingsError(["other"], "Logo design")).toBeNull();
    expect(getOfferingsError(["emotes"], "")).toBeNull();
  });

  it("only keeps the description with something else, trimmed", () => {
    expect(toOfferingsPatch(["emotes", "other"], "  Logo design ")).toEqual({
      offering_types: ["emotes", "other"],
      offering_other: "Logo design",
    });
    expect(toOfferingsPatch(["emotes"], "left over")).toEqual({ offering_types: ["emotes"], offering_other: null });
  });
});
