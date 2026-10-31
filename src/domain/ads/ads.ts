// Google AdSense. Off until VITE_ADSENSE_CLIENT is set at build time: with no
// publisher id there is no script, no ad space and no consent question. The
// Privacy Policy and Cookie Policy say no advertising is in use, so they must
// change before it is set.
// Playbook: docs/support/site/ads.md.

export type AdsenseConfig = {
  client: string;
  bannerSlot: string;
  phoneSlot: string;
  sideSlot: string;
};

const envValue = (value: unknown): string => String(value ?? "").trim();

export const getAdsenseConfig = (): AdsenseConfig | null => {
  const client = envValue(import.meta.env.VITE_ADSENSE_CLIENT);
  const bannerSlot = envValue(import.meta.env.VITE_ADSENSE_BANNER_SLOT);

  return client && bannerSlot
    ? {
        client,
        bannerSlot,
        phoneSlot: envValue(import.meta.env.VITE_ADSENSE_PHONE_SLOT),
        sideSlot: envValue(import.meta.env.VITE_ADSENSE_SIDE_SLOT),
      }
    : null;
};

// Dashed boxes where ads would sit, so the layout can be judged before any ad
// exists. Only on the test site, by its address, so they can never reach the
// real one. Real ads always win.
export const showAdPlaceholders = (): boolean =>
  window.location.hostname === "dev.madeforstream.com" && !getAdsenseConfig();

// Pages people browse. Never checkout, chat, settings, policies, the admin
// pages or a creator's own tools: nobody should see an ad while paying or
// reading what they agree to.
const AD_PAGES = [
  /^\/$/,
  /^\/market$/,
  /^\/free$/,
  /^\/creators$/,
  /^\/live$/,
  /^\/listing\/[^/]+$/,
  /^\/creator\/(?!dashboard$|listings$|requests$)[^/]+$/,
];

export const isAdPage = (pathname: string): boolean => AD_PAGES.some((page) => page.test(pathname));
