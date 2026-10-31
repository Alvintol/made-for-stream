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

const classes = {
  banner: "mb-6",
  side: "fixed top-28 z-10 hidden w-40 min-[1880px]:block",
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

const AdUnit = ({ client, slot, format }: { client: string; slot: string; format: string }) => {
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
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </>
  );
};

export const AdBanner = () => {
  const { pathname } = useLocation();
  const config = useAdsense();

  return config ? (
    <aside className={classes.banner}>
      <AdUnit key={pathname} client={config.client} slot={config.bannerSlot} format="horizontal" />
    </aside>
  ) : null;
};

// The side gutters are only wide enough for a 160 pixel ad on very wide screens.
export const AdGutters = () => {
  const { pathname } = useLocation();
  const config = useAdsense();

  return config?.sideSlot ? (
    <>
      {[classes.sideLeft, classes.sideRight].map((side) => (
        <aside key={side} className={`${classes.side} ${side}`}>
          <AdUnit key={pathname} client={config.client} slot={config.sideSlot} format="vertical" />
        </aside>
      ))}
    </>
  ) : null;
};
