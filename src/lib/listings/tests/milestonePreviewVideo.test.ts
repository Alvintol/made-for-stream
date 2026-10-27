import { describe, expect, it } from "vitest";

import {
  getRecordingSize,
  pickRecordingType,
  validateMilestonePreviewVideoSource,
} from "../milestonePreviewVideo";

describe("milestone preview videos", () => {
  it("records WebM where the browser can, and MP4 on Safari", () => {
    expect(pickRecordingType(() => true)).toBe("video/webm;codecs=vp9");
    expect(pickRecordingType((type) => type === "video/mp4")).toBe("video/mp4");
    expect(pickRecordingType(() => false)).toBeNull();
  });

  it("fits the recording inside 1200 pixels, in even numbers", () => {
    expect(getRecordingSize(1920, 1080)).toEqual({ width: 1200, height: 674 });
    expect(getRecordingSize(641, 361)).toEqual({ width: 640, height: 360 });
    expect(getRecordingSize(1, 1)).toEqual({ width: 2, height: 2 });
  });

  it("accepts videos and GIFs, and refuses anything else or anything too large", () => {
    expect(validateMilestonePreviewVideoSource({ type: "video/quicktime", size: 1 })).toBeNull();
    expect(validateMilestonePreviewVideoSource({ type: "image/gif", size: 1 })).toBeNull();
    expect(validateMilestonePreviewVideoSource({ type: "video/x-msvideo", size: 1 })).toBe(
      "Choose an MP4, WebM or MOV video, or an animated GIF.",
    );
    expect(validateMilestonePreviewVideoSource({ type: "video/mp4", size: 501 * 1024 * 1024 })).toBe(
      "That video is over 500 MB. Trim it to the part you want to show.",
    );
  });
});
