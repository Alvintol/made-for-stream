import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdBanner, AdGutters } from "../ads/SiteAds";

const mocks = vi.hoisted(() => ({ consent: false }));

vi.mock("../../providers/CookiePreferencesProvider", () => ({
  useCookiePreferences: () => ({ hasConsent: () => mocks.consent }),
}));

const renderAds = (path = "/market") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdBanner />
      <AdGutters />
    </MemoryRouter>,
  );

const script = () => document.getElementById("adsense-script") as HTMLScriptElement | null;
const units = () => document.querySelectorAll("ins.adsbygoogle");

const configure = () => {
  vi.stubEnv("VITE_ADSENSE_CLIENT", "ca-pub-123");
  vi.stubEnv("VITE_ADSENSE_BANNER_SLOT", "111");
  vi.stubEnv("VITE_ADSENSE_SIDE_SLOT", "222");
};

describe("site ads", () => {
  beforeEach(() => {
    mocks.consent = false;
    window.adsbygoogle = undefined;
  });

  afterEach(() => {
    script()?.remove();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does nothing at all without a publisher id, even with consent", () => {
    mocks.consent = true;
    renderAds();

    expect(script()).toBeNull();
    expect(units()).toHaveLength(0);
  });

  it("loads nothing from Google until someone opts in", () => {
    configure();
    renderAds();

    expect(script()).toBeNull();
    expect(units()).toHaveLength(0);
  });

  it("shows a labelled banner and the side ads after opting in", () => {
    configure();
    mocks.consent = true;
    renderAds();

    expect(script()?.src).toContain("client=ca-pub-123");
    expect(units()).toHaveLength(3);
    expect(units()[0]).toHaveAttribute("data-ad-slot", "111");
    expect(units()[1]).toHaveAttribute("data-ad-slot", "222");
    expect(screen.getAllByText("Advertisement")).toHaveLength(3);
    expect(window.adsbygoogle).toHaveLength(3);
  });

  it("leaves out the side ads when they have no slot", () => {
    configure();
    vi.stubEnv("VITE_ADSENSE_SIDE_SLOT", "");
    mocks.consent = true;
    renderAds();

    expect(units()).toHaveLength(1);
  });

  it("shows no ad on a page where someone pays or manages their account", () => {
    configure();
    mocks.consent = true;
    renderAds("/payments/checkout/abc");

    expect(units()).toHaveLength(0);
  });

  it("reloads the page when someone opts out with the script running", () => {
    configure();
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    mocks.consent = true;
    const { unmount } = renderAds();

    unmount();
    mocks.consent = false;
    renderAds();

    expect(reload).toHaveBeenCalled();
  });
});
