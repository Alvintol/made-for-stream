import { useRef } from "react";
import { Link } from "react-router-dom";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap, motion, prefersReducedMotion, useGSAP } from "../../lib/motion";

gsap.registerPlugin(ScrollTrigger);

type HeroParallaxProps = {
  previewUrls: string[];
};

const classes = {
  // Full-bleed: break out of the page container; the app shell clips horizontal overflow.
  hero:
    "relative -mt-8 ml-[calc(50%-50vw)] w-screen overflow-hidden",
  stage:
    "container relative mx-auto grid min-h-[calc(100svh-5rem)] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20",

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
  arcs: "absolute right-[-8%] top-[-10%] h-[120%] text-[rgb(var(--accent)/0.18)] will-change-transform",

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

  art: "relative z-0 mx-auto hidden h-[520px] w-full max-w-[460px] lg:block",
  arch:
    "absolute inset-0 m-auto h-[460px] w-[300px] overflow-hidden rounded-t-full rounded-b-[2rem] border border-[var(--hairline-strong)] bg-zinc-100 shadow-[var(--shadow-lg)] will-change-transform",
  archImg: "h-[115%] w-full object-cover will-change-transform",
  introLayer: "absolute inset-0",
  tile:
    "absolute overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-zinc-100 shadow-[var(--shadow-lg)] will-change-transform",
  tileA: "left-0 top-[12%] h-36 w-32",
  tileB: "bottom-[6%] right-0 h-40 w-36",
  tileImg: "h-full w-full object-cover",
  fallback:
    "h-full w-full bg-[radial-gradient(120%_120%_at_0%_0%,rgb(var(--accent)/0.4),transparent_60%),radial-gradient(120%_120%_at_100%_100%,rgb(var(--brand)/0.35),transparent_55%)]",
  ring:
    "absolute inset-0 m-auto h-[540px] w-[380px] rounded-t-full rounded-b-[2.5rem] border border-dashed border-[rgb(var(--accent)/0.3)] will-change-transform",

  scrollCue:
    "absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 sm:flex",
  scrollCueLine: "h-8 w-px bg-gradient-to-b from-transparent to-[rgb(var(--ink)/0.4)]",
} as const;

const ArtImage = ({ url, className }: { url?: string; className: string }) =>
  url ? (
    <img src={url} alt="" className={className} loading="eager" />
  ) : (
    <div className={classes.fallback} />
  );

const HeroParallax = ({ previewUrls }: HeroParallaxProps) => {
  const heroRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const intro = gsap.timeline({ defaults: { ease: motion.ease.out } });
      intro
        .from("[data-hero-copy] > *", {
          autoAlpha: 0,
          y: 24,
          duration: 0.7,
          stagger: 0.08,
        })
        .from(
          "[data-intro='arch']",
          { autoAlpha: 0, y: 60, scale: 0.92, duration: 1 },
          0.1
        )
        .from(
          "[data-intro='tile']",
          { autoAlpha: 0, y: 40, duration: 0.8, stagger: 0.12 },
          0.35
        )
        .from("[data-intro='ring']", { autoAlpha: 0, scale: 0.96, duration: 1.2 }, 0.3);

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
      const layers: [string, gsap.TweenVars][] = [
        ["[data-depth='grid']", { yPercent: 18 }],
        ["[data-depth='arcs']", { yPercent: -12, rotate: 8 }],
        ["[data-depth='glows']", { yPercent: 25 }],
        ["[data-hero-copy]", { yPercent: -18, autoAlpha: 0.1 }],
        ["[data-hero-arch]", { y: -60, scale: 1.06 }],
        ["[data-hero-arch-img]", { yPercent: -10 }],
        ["[data-hero-ring]", { y: -110, rotate: -4 }],
        ["[data-hero-tile='a']", { y: -190, rotate: -8 }],
        ["[data-hero-tile='b']", { y: -140, rotate: 6 }],
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
      </div>

      <div className={classes.stage}>
        <div className={classes.copy} data-hero-copy>
          <p className={classes.tagline}>
            <span className={classes.taglineRule} aria-hidden="true" />
            For Creators, By Creators
          </p>

          <h1 id="home-hero-title" className={classes.title}>
            Made for Stream — assets & services,{" "}
            <span className={classes.titleAccent}>in one trusted place.</span>
          </h1>

          <p className={classes.lede}>
            Find emote artists, overlay designers, PNG/VTuber creators, riggers,
            editors, and audio help — with clear categories and “Live now”
            discovery.
          </p>

          <div className={classes.actions}>
            <Link to="/market" className={classes.primary}>
              Browse market
            </Link>

            <Link to="/creators" className={classes.secondary}>
              Find creators
            </Link>

            <Link to="/live" className={classes.secondary}>
              Live now
            </Link>
          </div>

          <div className={classes.chips}>
            <Link to="/market?cat=video-editing&video=long-form" className={classes.chip}>
              Long form edits
            </Link>

            <Link to="/market?cat=video-editing&video=short-form" className={classes.chip}>
              Short form edits
            </Link>

            <Link to="/market?cat=vtuber-rigging" className={classes.chip}>
              PNG/VTuber rigging help
            </Link>

            <Link to="/market?cat=audio-tech-help" className={classes.chip}>
              Audio tech help
            </Link>
          </div>
        </div>

        <div className={classes.art} aria-hidden="true">
          <div data-intro="ring" className={classes.introLayer}>
            <div data-hero-ring className={classes.ring} />
          </div>

          <div data-intro="arch" className={classes.introLayer}>
            <div data-hero-arch className={classes.arch}>
              <div data-hero-arch-img className="h-full w-full">
                <ArtImage url={previewUrls[0]} className={classes.archImg} />
              </div>
            </div>
          </div>

          <div data-intro="tile" className={classes.introLayer}>
            <div data-hero-tile="a" className={`${classes.tile} ${classes.tileA}`}>
              <ArtImage url={previewUrls[1]} className={classes.tileImg} />
            </div>
          </div>

          <div data-intro="tile" className={classes.introLayer}>
            <div data-hero-tile="b" className={`${classes.tile} ${classes.tileB}`}>
              <ArtImage url={previewUrls[2]} className={classes.tileImg} />
            </div>
          </div>
        </div>
      </div>

      <div className={classes.scrollCue} aria-hidden="true">
        <span>Scroll</span>
        <span className={classes.scrollCueLine} />
      </div>
    </section>
  );
};

export default HeroParallax;
