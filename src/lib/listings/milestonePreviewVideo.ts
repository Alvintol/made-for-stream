import { english, type Translate } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages/en";
import { getGifPlayOnceMs } from "./listingAnimatedPreview";
import { drawWatermark, getListingPreviewSize } from "./listingPreviewImage";

// Moving previews on a milestone submission: a short video or an animated
// GIF, re-recorded in the creator's browser with the same watermark as the
// preview images drawn on every frame. Only that recording is uploaded, so
// what the buyer reviews before paying is never the clean file. No sound is
// kept. It uses the browser's own canvas and recorder, with no extra library,
// so the recording runs in real time: a 30-second clip takes 30 seconds.
// The bucket's types and size cap are in
// supabase/migrations/20261027_168_allow_milestone_preview_videos.sql.

export const MILESTONE_PREVIEW_VIDEO_MAX_SECONDS = 30;
// What the creator may pick. It never leaves their device.
export const MILESTONE_PREVIEW_VIDEO_MAX_SOURCE_BYTES = 500 * 1024 * 1024;
export const MILESTONE_PREVIEW_VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,image/gif";

const ACCEPTED_TYPES = new Set(MILESTONE_PREVIEW_VIDEO_ACCEPT.split(","));
const FRAMES_PER_SECOND = 30;
// About 9 MB for 30 seconds, under the bucket's 20 MB cap.
const BITS_PER_SECOND = 2_500_000;

// WebM where the browser can record it (Chrome, Edge, Firefox), MP4 on Safari.
const RECORDING_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

export const pickRecordingType = (isSupported: (type: string) => boolean): string | null =>
  RECORDING_TYPES.find(isSupported) ?? null;

export const isMilestonePreviewVideoSource = (file: { type: string }): boolean =>
  ACCEPTED_TYPES.has(file.type);

export const validateMilestonePreviewVideoSource = (file: {
  type: string;
  size: number;
}, t: Translate = english): string | null =>
  !ACCEPTED_TYPES.has(file.type)
    ? t("preview.videoType")
    : file.size > MILESTONE_PREVIEW_VIDEO_MAX_SOURCE_BYTES
      ? t("preview.videoTooBig")
      : null;

// The image size rule, rounded down to even numbers, which video needs.
export const getRecordingSize = (width: number, height: number) => {
  const size = getListingPreviewSize(width, height);

  return {
    width: Math.max(2, size.width - (size.width % 2)),
    height: Math.max(2, size.height - (size.height % 2)),
  };
};

// A problem the creator can act on. The message is the English wording; the
// form shows the key in the page's language.
export class MilestonePreviewVideoError extends Error {
  readonly key?: MessageKey;

  constructor(message: string, key?: MessageKey) {
    super(message);
    this.key = key;
  }
}

const videoError = (key: MessageKey) => new MilestonePreviewVideoError(english(key), key);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Draw = (frame: CanvasImageSource) => void;

// Records whatever `play` draws, with the watermark over every frame.
const record = async (
  width: number,
  height: number,
  watermarkText: string,
  play: (draw: Draw) => Promise<void>,
): Promise<Blob> => {
  const type = pickRecordingType(
    (candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate),
  );
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!type || !context) {
    throw videoError("preview.cannotRecord");
  }

  const recorder = new MediaRecorder(canvas.captureStream(FRAMES_PER_SECOND), {
    mimeType: type,
    videoBitsPerSecond: BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.start();

  try {
    await play((frame) => {
      context.drawImage(frame, 0, 0, width, height);
      drawWatermark(context, width, height, watermarkText);
    });
  } finally {
    recorder.stop();
  }

  await stopped;

  return new Blob(chunks, { type: type.split(";")[0] });
};

const recordVideo = async (file: Blob, watermarkText: string): Promise<Blob> => {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");

  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(videoError("preview.videoUnreadable"));
      video.src = url;
    });

    const seconds = Math.min(
      Number.isFinite(video.duration) ? video.duration : MILESTONE_PREVIEW_VIDEO_MAX_SECONDS,
      MILESTONE_PREVIEW_VIDEO_MAX_SECONDS,
    );
    const { width, height } = getRecordingSize(video.videoWidth, video.videoHeight);

    return await record(width, height, watermarkText, async (draw) => {
      await video.play();

      const startedAt = performance.now();

      // Stops at the end, at the time limit, or a few seconds past it if the
      // video stalls, so it never runs on.
      while (
        !video.ended &&
        video.currentTime < seconds &&
        performance.now() - startedAt < (seconds + 5) * 1000
      ) {
        draw(video);
        await wait(1000 / FRAMES_PER_SECOND);
      }

      video.pause();
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
};

// A GIF is played frame by frame at its own speed, once, up to the limit.
// Needs the browser's image decoder; where it is missing the creator is
// asked for a video instead.
const recordGif = async (file: Blob, watermarkText: string): Promise<Blob> => {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (getGifPlayOnceMs(bytes) === null) {
    throw videoError("preview.gifStill");
  }

  if (typeof ImageDecoder === "undefined") {
    throw videoError("preview.gifBrowser");
  }

  const decoder = new ImageDecoder({ data: bytes, type: "image/gif" });

  try {
    await decoder.tracks.ready;

    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    const first = (await decoder.decode({ frameIndex: 0 })).image;
    const { width, height } = getRecordingSize(first.displayWidth, first.displayHeight);

    first.close();

    return await record(width, height, watermarkText, async (draw) => {
      let elapsedMs = 0;

      for (
        let frameIndex = 0;
        frameIndex < frameCount && elapsedMs < MILESTONE_PREVIEW_VIDEO_MAX_SECONDS * 1000;
        frameIndex += 1
      ) {
        const { image } = await decoder.decode({ frameIndex });
        // Frame times are in microseconds. Browsers play a delay of 10 ms or
        // less as a tenth of a second (as getGifPlayOnceMs does).
        const delayMs = (image.duration ?? 0) / 1000 <= 10 ? 100 : (image.duration ?? 0) / 1000;

        draw(image);
        image.close();
        await wait(delayMs);
        elapsedMs += delayMs;
      }
    });
  } finally {
    decoder.close();
  }
};

// Returns the watermarked recording to upload.
export const renderMilestonePreviewVideo = (
  file: Blob,
  { watermarkText }: { watermarkText: string },
): Promise<Blob> =>
  file.type === "image/gif" ? recordGif(file, watermarkText) : recordVideo(file, watermarkText);
