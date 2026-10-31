import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdsenseConfig, isAdPage } from "../ads/ads";

describe("isAdPage", () => {
  it.each([
    "/",
    "/market",
    "/free",
    "/creators",
    "/live",
    "/listing/abc",
    "/listing/abc/request",
    "/creator/meowington",
    "/creator/dashboard",
    "/creator/listings/abc",
    "/creator/requests/abc",
    "/settings/profile",
    "/settings/preferences",
    "/messages/abc",
    "/requests/abc",
    "/terms",
    "/policies/refunds",
  ])(
    "allows ads on %s",
    (path) => {
      expect(isAdPage(path)).toBe(true);
    },
  );

  it.each([
    "/signin",
    "/settings/personal",
    "/payments/checkout/abc",
    "/payments/return",
    "/admin",
    "/admin/requests/abc",
  ])("keeps ads off %s", (path) => {
    expect(isAdPage(path)).toBe(false);
  });
});

describe("getAdsenseConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off without both a publisher id and a banner slot", () => {
    vi.stubEnv("VITE_ADSENSE_CLIENT", "");
    vi.stubEnv("VITE_ADSENSE_BANNER_SLOT", "111");
    expect(getAdsenseConfig()).toBeNull();

    vi.stubEnv("VITE_ADSENSE_CLIENT", "ca-pub-123");
    vi.stubEnv("VITE_ADSENSE_BANNER_SLOT", " ");
    expect(getAdsenseConfig()).toBeNull();
  });

  it("is on with both, and the side slot is optional", () => {
    vi.stubEnv("VITE_ADSENSE_CLIENT", " ca-pub-123 ");
    vi.stubEnv("VITE_ADSENSE_BANNER_SLOT", "111");
    vi.stubEnv("VITE_ADSENSE_SIDE_SLOT", "");
    vi.stubEnv("VITE_ADSENSE_PHONE_SLOT", "333");

    expect(getAdsenseConfig()).toEqual({
      client: "ca-pub-123",
      bannerSlot: "111",
      phoneSlot: "333",
      sideSlot: "",
    });
  });
});
