import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { getAdsenseConfig, isAdPage, type AdsenseConfig } from "../../domain/ads/ads";
import { useT } from "../../lib/i18n/i18n";
import { useCookiePreferences } from "../../providers/CookiePreferencesProvider";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const SCRIPT_ID = "adsense-script";

// Phones get one small fixed banner, under the page's content.
const PHONE_SCREEN = "(max-width: 767px)";
const PHONE_AD = { width: 320, height: 50 };

// The side gutters are only wide enough for a 160 pixel ad from here up. An ad
// hidden with CSS would still be requested, so it is not rendered at all.
const WIDE_SCREEN = "(min-width: 1880px)";

const screenMatches = (query: string): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia(query).matches;

const classes = {
  banner: "mb-6",
  phone: "-mx-4 mt-8 flex flex-col items-center sm:mx-0",
  side: "fixed top-28 z-10 w-40",
  sideLeft: "left-3",
  sideRight: "right-3",
  label: "mb-1 text-center text-[11px] text-zinc-500",
} as const;

const loadScript = (client: string) => {
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");

  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  script.onerror = () => console.warn("ADS-002: the AdSense script did not load.");
  document.head.appendChild(script);
};

// The Google script runs only after someone opts in to advertising, and a page
// holding it reloads when they opt out, so it stops at once. A blocked or
// unconfigured ad leaves the page as it was.
const useAdsense = (): AdsenseConfig | null => {
  const { pathname } = useLocation();
  const { hasConsent } = useCookiePreferences();
  const config = getAdsenseConfig();
  const allowed = Boolean(config) && hasConsent("advertising");

  useEffect(() => {
    if (allowed && config) {
      loadScript(config.client);
    } else if (document.getElementById(SCRIPT_ID)) {
      window.location.reload();
    }
  }, [allowed, config?.client]); // eslint-disable-line react-hooks/exhaustive-deps

  return allowed && isAdPage(pathname) ? config : null;
};

type AdUnitProps = { client: string; slot: string; format?: string };

// With no format, the ad is the fixed phone size. Otherwise Google sizes it.
const AdUnit = ({ client, slot, format }: AdUnitProps) => {
  const t = useT();

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch (error) {
      console.warn("ADS-001: AdSense could not fill a space.", error);
    }
  }, []);

  return (
    <>
      <p className={classes.label}>{t("ads.label")}</p>
      <ins
        className="adsbygoogle"
        style={format ? { display: "block" } : { display: "inline-block", ...PHONE_AD }}
        data-ad-client={client}
        data-ad-slot={slot}
        {...(format ? { "data-ad-format": format, "data-full-width-responsive": "true" } : {})}
      />
    </>
  );
};

// Larger screens show the banner above the page. Phones show theirs below it,
// and with no phone slot they show no ad at all rather than the large one.
export const AdBanner = ({ position }: { position: "top" | "bottom" }) => {
  const { pathname } = useLocation();
  const config = useAdsense();
  const phone = screenMatches(PHONE_SCREEN);
  if (!config || phone !== (position === "bottom")) return null;

  if (phone) {
    return config.phoneSlot ? (
      <aside className={classes.phone}>
        <AdUnit key={pathname} client={config.client} slot={config.phoneSlot} />
      </aside>
    ) : null;
  }

  return (
    <aside className={classes.banner}>
      <AdUnit key={pathname} client={config.client} slot={config.bannerSlot} format="horizontal" />
    </aside>
  );
};

export const AdGutters = () => {
  const { pathname } = useLocation();
  const config = useAdsense();

  return config?.sideSlot && screenMatches(WIDE_SCREEN) ? (
    <>
      {[classes.sideLeft, classes.sideRight].map((side) => (
        <aside key={side} className={`${classes.side} ${side}`}>
          <AdUnit key={pathname} client={config.client} slot={config.sideSlot} format="vertical" />
        </aside>
      ))}
    </>
  ) : null;
};
