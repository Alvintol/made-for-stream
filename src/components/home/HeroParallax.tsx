import { useRef } from "react";
import { Link } from "react-router-dom";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap, motion, prefersReducedMotion, useGSAP } from "../../lib/motion";
import { useT } from "../../lib/i18n/i18n";
gsap.registerPlugin(ScrollTrigger);

// The showcase pieces (public/hero/, 2026-11-10), all cutouts on the page:
// a VTuber model in the middle (mirrored, so it faces the headline), an emote
// sheet and a pixel-art GIF on its left, and a short-form edit behind it on the
// right. The emotes and the video turn in toward the model for depth. The video plays silently
// on a loop, like a GIF; with reduced motion it stays on its still frame.
const media = {
  model: "/hero/vtuber-model.webp",
  emotes: "/hero/emote-pack.webp",
  pixelArt: "/hero/pixel-art.gif",
  video: "/hero/video-edit.mp4",
  videoPoster: "/hero/video-edit-poster.jpg",
} as const;

const classes = {
  // Full-bleed: break out of the page container; the app shell clips horizontal overflow.
  hero:
    "relative -mt-8 ml-[calc(50%-50vw)] w-screen overflow-hidden",
  stage:
    "container relative mx-auto grid min-h-[calc(100svh-5rem)] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-20",

  // Fades every backdrop layer out toward the bottom so the hero melts into the page instead of ending on an edge.
  backdrop:
    "pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]",
  glow: "absolute rounded-full blur-3xl will-change-transform",
  glowAccent: "-left-[10%] -top-[20%] h-[60vmax] w-[60vmax] bg-[rgb(var(--accent)/0.22)]",
  glowBrand: "right-[-12%] top-[10%] h-[45vmax] w-[45vmax] bg-[rgb(var(--brand)/0.16)]",
  glowIndigo:
    "bottom-[-30%] left-[30%] h-[50vmax] w-[50vmax] bg-[rgb(39_24_112/0.18)] dark:bg-[rgb(var(--accent)/0.08)]",
  grid:
    "absolute inset-[-20%] bg-[radial-gradient(rgb(var(--ink)/0.12)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)] will-change-transform",
  // Behind the model, centred a little right of her; the bottom fades out with her.
  // Tall enough that the outer two arches run off the top of the hero.
  arcs: "absolute bottom-0 left-[9%] h-[140%] max-w-none text-[rgb(var(--accent)/0.18)] [mask-image:linear-gradient(to_bottom,black_70%,transparent)] will-change-transform",

  copy: "relative z-10 space-y-7 will-change-transform",
  tagline:
    "inline-flex items-center gap-3 font-display text-lg font-bold tracking-tight text-[rgb(var(--accent-text))] sm:text-xl",
  taglineRule: "h-px w-10 bg-[rgb(var(--brand))]",
  title:
    "font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl xl:text-7xl",
  titleAccent:
    "bg-gradient-to-r from-[rgb(var(--accent))] via-[rgb(var(--accent))] to-[rgb(var(--brand))] bg-clip-text text-transparent",
  lede: "max-w-xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8",
  actions: "flex flex-wrap gap-3",
  primary: "btnPrimary px-6 py-3",
  secondary: "btnOutline px-6 py-3",
  chips: "flex flex-wrap items-center gap-2",
  chip: "chip",

  // Laid out in percentages of one box, so the group keeps its shape at any width.
  // Sits on the bottom of the first screen (the -mb cancels the stage padding),
  // so the model stands on the page edge.
  art: "relative z-0 mx-auto hidden aspect-[800/560] w-full max-w-[680px] lg:-mb-20 lg:block lg:self-end",
  introLayer: "absolute inset-0",
  // Each turned piece: a spot with perspective, a static CSS turn inside it,
  // and the element GSAP moves inside that, so the two transforms never clash.
  // rotateY(+) brings the left edge forward; rotateY(-) the right edge.
  // The emotes sit on a card, upper left of the model, tucked behind her hair.
  emotesSpot: "absolute right-[70%] top-[8%] w-[40%] [perspective:900px]",
  emotesTurn: "[transform:rotateY(30deg)] [transform-style:preserve-3d]",
  emotes: "card block p-2 will-change-transform",
  emotesImage: "block h-auto w-full",
  // The model, the video, the emotes and the pixel art share one box the size
  // of the picture, so they keep their places around her at any screen size.
  figure: "absolute bottom-0 left-1/2 aspect-[462/540] h-[80svh] -translate-x-1/2",
  videoSpot: "absolute left-[74%] top-[16%] aspect-[9/14] w-[34%] [perspective:900px]",
  videoTurn: "h-full w-full [transform:rotateY(-30deg)] [transform-style:preserve-3d]",
  videoFrame:
    "h-full w-full overflow-hidden rounded-xl bg-zinc-900 shadow-[var(--shadow-lg)] will-change-transform",
  videoMedia: "h-[115%] w-full object-cover will-change-transform",
  // The main piece: 80% of the screen height, centred in the group. The
  // picture ends at the waist, so its bottom fades out. Stacked shadows: a
  // wide soft one, a tight one at the edge, and one cast back onto the video.
  // Dark mode uses black plus a faint accent rim so she still lifts off the page.
  model:
    "absolute inset-0 h-full w-full [filter:drop-shadow(0_32px_44px_rgb(39_24_112/0.38))_drop-shadow(0_6px_10px_rgb(39_24_112/0.28))_drop-shadow(18px_8px_22px_rgb(39_24_112/0.22))] dark:[filter:drop-shadow(0_32px_48px_rgb(0_0_0/0.8))_drop-shadow(0_6px_12px_rgb(0_0_0/0.6))_drop-shadow(18px_8px_24px_rgb(0_0_0/0.55))_drop-shadow(0_0_26px_rgb(var(--accent)/0.3))] [mask-image:linear-gradient(to_bottom,black_82%,transparent)] will-change-transform",
  // Transparent GIF, no card; the shadow follows its outline. Below the emote
  // card and a little left of its centre, in front of the model.
  sprite:
    "absolute bottom-[6%] -left-[16%] w-[44%] drop-shadow-[0_12px_16px_rgb(39_24_112/0.3)] [image-rendering:pixelated] will-change-transform",

  scrollCue:
    "absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 sm:flex",
  scrollCueLine: "h-8 w-px bg-gradient-to-b from-transparent to-[rgb(var(--ink)/0.4)]",
} as const;

const HeroParallax = () => {
  const heroRef = useRef<HTMLElement>(null);
  const t = useT();
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const intro = gsap.timeline({ defaults: { ease: motion.ease.out } });
      intro
        .from("[data-hero-copy] > *", {
          opacity: 0,
          y: 24,
          duration: 0.7,
          stagger: 0.08,
        })
        .from(
          "[data-intro='video']",
          { opacity: 0, y: 40, scale: 0.92, duration: 1 },
          0.05
        )
        .from(
          "[data-intro='model']",
          { opacity: 0, y: 60, scale: 0.94, duration: 1 },
          0.2
        )
        .from(
          "[data-intro='tile']",
          { opacity: 0, y: 40, duration: 0.8, stagger: 0.12 },
          0.35
        );

      gsap.to("[data-hero-glow]", {
        x: "random(-40, 40)",
        y: "random(-30, 30)",
        duration: "random(6, 9)",
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
      });

      const scrub = {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      };

      // Each layer travels a different distance over the same scroll range, which reads as depth.
      // Opacity, not autoAlpha: autoAlpha reads the inherited visibility, and
      // while the page fade-in is still hidden it recorded the text as invisible.
      const layers: [string, gsap.TweenVars][] = [
        ["[data-depth='grid']", { yPercent: 18 }],
        ["[data-depth='arcs']", { yPercent: -12, rotate: 8 }],
        ["[data-depth='glows']", { yPercent: 25 }],
        ["[data-hero-copy]", { yPercent: -18, opacity: 0.1 }],
        ["[data-hero-video]", { y: -40 }],
        ["[data-hero-video-media]", { yPercent: -10 }],
        ["[data-hero-model]", { y: -70, scale: 1.05 }],
        ["[data-hero-emotes]", { y: -150 }],
        ["[data-hero-sprite]", { y: -120, rotate: 6 }],
      ];

      layers.forEach(([target, vars]) => {
        gsap.to(target, { ...vars, ease: "none", scrollTrigger: scrub });
      });

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh, { once: true });
      const refreshTimer = window.setTimeout(refresh, 600);

      return () => {
        window.removeEventListener("load", refresh);
        window.clearTimeout(refreshTimer);
      };
    },
    { scope: heroRef }
  );

  return (
    <section ref={heroRef} className={classes.hero} aria-labelledby="home-hero-title">
      <div className={classes.backdrop} aria-hidden="true">
        <div data-depth="glows" className="absolute inset-0">
          <div data-hero-glow className={`${classes.glow} ${classes.glowAccent}`} />
          <div data-hero-glow className={`${classes.glow} ${classes.glowBrand}`} />
          <div data-hero-glow className={`${classes.glow} ${classes.glowIndigo}`} />
        </div>
        <div data-depth="grid" className={classes.grid} />
      </div>

      <div className={classes.stage}>
        <div className={classes.copy} data-hero-copy>
          <p className={classes.tagline}>
            <span className={classes.taglineRule} aria-hidden="true" />
            {t("home.tagline")}
          </p>

          <h1 id="home-hero-title" className={classes.title}>
            {t("home.titleStart")}{" "}
            <span className={classes.titleAccent}>{t("home.titleAccent")}</span>
          </h1>

          <p className={classes.lede}>
            {t("home.lede")}
          </p>

          <div className={classes.actions}>
            <Link to="/market" className={classes.primary}>
              {t("home.browseMarket")}
            </Link>

            <Link to="/creators" className={classes.secondary}>
              {t("home.findCreators")}
            </Link>

            <Link to="/live" className={classes.secondary}>
              {t("home.liveNow")}
            </Link>
          </div>

          <div className={classes.chips}>
            <Link to="/market?cat=video-editing&video=long-form" className={classes.chip}>
              {t("home.chipLongForm")}
            </Link>

            <Link to="/market?cat=video-editing&video=short-form" className={classes.chip}>
              {t("home.chipShortForm")}
            </Link>

            <Link to="/market?cat=vtuber-rigging" className={classes.chip}>
              {t("home.chipRigging")}
            </Link>

            <Link to="/market?cat=audio-tech-help" className={classes.chip}>
              {t("home.chipAudio")}
            </Link>
          </div>
        </div>

        <div className={classes.art} aria-hidden="true">
          <div className={classes.figure}>
            <svg data-depth="arcs" className={classes.arcs} viewBox="0 0 600 800" fill="none">
              {[0, 1, 2, 3, 4].map((ring) => (
                <path
                  key={ring}
                  d={`M${60 + ring * 40} 800V${300 + ring * 10}a${240 - ring * 40} ${240 - ring * 40} 0 0 1 ${480 - ring * 80} 0V800`}
                  stroke="currentColor"
                  strokeWidth="1"
                />
              ))}
            </svg>

            <div data-intro="tile" className={classes.introLayer}>
              <div className={classes.emotesSpot}>
                <div className={classes.emotesTurn}>
                  <div data-hero-emotes className={classes.emotes}>
                    <img src={media.emotes} alt="" className={classes.emotesImage} loading="eager" />
                  </div>
                </div>
              </div>
            </div>

            <div data-intro="video" className={classes.introLayer}>
              <div className={classes.videoSpot}>
                <div className={classes.videoTurn}>
                  <div data-hero-video className={classes.videoFrame}>
                    <div data-hero-video-media className="h-full w-full">
                      <video
                        className={classes.videoMedia}
                        src={media.video}
                        poster={media.videoPoster}
                        autoPlay={!prefersReducedMotion()}
                        muted
                        loop
                        playsInline
                        preload="auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div data-intro="model" className={classes.introLayer}>
              <img data-hero-model src={media.model} alt="" className={classes.model} loading="eager" />
            </div>

            <div data-intro="tile" className={classes.introLayer}>
              <img data-hero-sprite src={media.pixelArt} alt="" className={classes.sprite} loading="eager" />
            </div>
          </div>
        </div>
      </div>

      <div className={classes.scrollCue} aria-hidden="true">
        <span>{t("home.scroll")}</span>
        <span className={classes.scrollCueLine} />
      </div>
    </section>
  );
};

export default HeroParallax;
