import { useEffect, useState } from "react";
import {
  getGifPlayOnceMs,
  getListingAnimationKindFromUrl,
  LISTING_ANIMATION_CONTENT_TYPES,
} from "../../lib/listings/listingAnimatedPreview";

type ListingAnimatedPreviewProps = {
  coverUrl: string | null;
  animationUrl: string;
  className: string;
};

// A GIF cannot say when it has finished, so one pass is timed from its own
// frame delays. A video reports its own end.
type LoadedAnimation =
  | { type: "gif"; blob: Blob; playOnceMs: number }
  | { type: "video"; blob: Blob };

const classes = {
  wrap: "relative",
  button: "btnPrimary absolute bottom-3 right-3",
} as const;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The listing page's picture when the listing has an animated preview (a
// GIF or a short video). It shows the static cover, plays the preview
// through once, then goes back to the cover with a "Play again" button.
//
// The file is fetched in the background and shown from a temporary in-page
// (blob:) address, so its real address never appears in the page, and
// right-click, drag and the video download controls are blocked. That deters
// casual copying only: the download is still visible to anyone who opens the
// browser's network tools.
const ListingAnimatedPreview = ({
  coverUrl,
  animationUrl,
  className,
}: ListingAnimatedPreviewProps) => {
  const [loaded, setLoaded] = useState<LoadedAnimation | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  const play = (animation: LoadedAnimation) => {
    // A fresh address each time: that is what restarts a GIF from frame one.
    setPlayingUrl(URL.createObjectURL(animation.blob));
    setHasPlayed(true);
  };

  useEffect(() => {
    let cancelled = false;
    const kind = getListingAnimationKindFromUrl(animationUrl);

    fetch(animationUrl)
      .then((response) =>
        response.ok ? response.arrayBuffer() : Promise.reject(new Error("not found")),
      )
      .then((buffer) => {
        if (cancelled) return;

        const blob = new Blob([buffer], { type: LISTING_ANIMATION_CONTENT_TYPES[kind] });
        let animation: LoadedAnimation;

        if (kind === "gif") {
          const playOnceMs = getGifPlayOnceMs(new Uint8Array(buffer));

          if (playOnceMs === null) return;

          animation = { type: "gif", blob, playOnceMs };
        } else {
          animation = { type: "video", blob };
        }

        setLoaded(animation);

        // People who ask for less motion get the Play button, not autoplay.
        if (!prefersReducedMotion()) play(animation);
      })
      // The cover stays up; a missing animation is not worth an error.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [animationUrl]);

  // Release the temporary address once it is no longer shown.
  useEffect(() => {
    if (!playingUrl) return;

    return () => URL.revokeObjectURL(playingUrl);
  }, [playingUrl]);

  // Stop a GIF after one pass.
  useEffect(() => {
    if (!playingUrl || loaded?.type !== "gif") return;

    const timer = window.setTimeout(() => setPlayingUrl(null), loaded.playOnceMs);

    return () => window.clearTimeout(timer);
  }, [playingUrl, loaded]);

  const stop = () => setPlayingUrl(null);

  return (
    <div className={classes.wrap} onContextMenu={(event) => event.preventDefault()}>
      {playingUrl && loaded?.type === "video" ? (
        <video
          src={playingUrl}
          className={className}
          poster={coverUrl ?? undefined}
          autoPlay
          // Browsers only allow autoplay without sound.
          muted
          playsInline
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          draggable={false}
          onEnded={stop}
          // A format this browser cannot play: keep the cover, offer nothing.
          onError={() => {
            setPlayingUrl(null);
            setLoaded(null);
          }}
        />
      ) : (playingUrl ?? coverUrl) ? (
        <img src={playingUrl ?? coverUrl ?? ""} alt="" className={className} draggable={false} />
      ) : (
        <div className={className} />
      )}

      {loaded && !playingUrl && (
        <button className={classes.button} type="button" onClick={() => play(loaded)}>
          {hasPlayed ? "Play again" : "Play preview"}
        </button>
      )}
    </div>
  );
};

export default ListingAnimatedPreview;
