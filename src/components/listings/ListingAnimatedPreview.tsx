import { useEffect, useState } from "react";
import { getGifPlayOnceMs } from "../../lib/listings/listingAnimatedPreview";

type ListingAnimatedPreviewProps = {
  coverUrl: string | null;
  animationUrl: string;
  className: string;
};

type LoadedAnimation = { blob: Blob; playOnceMs: number };

const classes = {
  wrap: "relative",
  button: "btnPrimary absolute bottom-3 right-3",
} as const;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The listing page's picture when the listing has an animated preview. It
// shows the static cover, plays the GIF through once, then goes back to the
// cover with a "Play again" button.
//
// The GIF is fetched in the background and shown from a temporary in-page
// (blob:) address, so its real address never appears in the page, and
// right-click and drag are blocked. That deters casual copying only: the
// download is still visible to anyone who opens the browser's network tools.
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

    fetch(animationUrl)
      .then((response) =>
        response.ok ? response.arrayBuffer() : Promise.reject(new Error("not found")),
      )
      .then((buffer) => {
        const playOnceMs = getGifPlayOnceMs(new Uint8Array(buffer));

        if (cancelled || playOnceMs === null) return;

        const animation = {
          blob: new Blob([buffer], { type: "image/gif" }),
          playOnceMs,
        };

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

  // Stop after one pass, and release the temporary address.
  useEffect(() => {
    if (!playingUrl || !loaded) return;

    const timer = window.setTimeout(() => setPlayingUrl(null), loaded.playOnceMs);

    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(playingUrl);
    };
  }, [playingUrl, loaded]);

  const shownUrl = playingUrl ?? coverUrl;

  return (
    <div className={classes.wrap} onContextMenu={(event) => event.preventDefault()}>
      {shownUrl ? (
        <img src={shownUrl} alt="" className={className} draggable={false} />
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
