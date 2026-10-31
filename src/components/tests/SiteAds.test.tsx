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
      <p>Page content</p>
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
  vi.stubEnv("VITE_ADSENSE_PHONE_SLOT", "333");
};

const onPhone = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width") }));
const onWideScreen = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width") }));
const onSite = (hostname: string) => vi.stubGlobal("location", { ...window.location, hostname });
const onTestSite = () => onSite("dev.madeforstream.com");

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
    onWideScreen();
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
    onWideScreen();
    mocks.consent = true;
    renderAds();

    expect(units()).toHaveLength(1);
  });

  it("requests no side ad on the home page", () => {
    configure();
    onWideScreen();
    mocks.consent = true;
    renderAds("/");

    expect(units()).toHaveLength(1);
    expect(units()[0]).toHaveAttribute("data-ad-slot", "111");
  });

  it("does not request a side ad on a screen too narrow to show it", () => {
    configure();
    mocks.consent = true;
    renderAds();

    expect(units()).toHaveLength(1);
    expect(units()[0]).toHaveAttribute("data-ad-slot", "111");
    expect(window.adsbygoogle).toHaveLength(1);
  });
  it("shows no ad on a page where someone pays or manages their account", () => {
    configure();
    mocks.consent = true;
    renderAds("/payments/checkout/abc");

    expect(units()).toHaveLength(0);
  });

  it("gives a phone one small fixed banner, under the page's content", () => {
    configure();
    onPhone();
    mocks.consent = true;
    renderAds();

    const ads = units();

    expect(ads).toHaveLength(1);
    expect(ads[0]).toHaveAttribute("data-ad-slot", "333");
    expect(ads[0]).toHaveStyle({ width: "320px", height: "50px" });
    expect(ads[0]).not.toHaveAttribute("data-ad-format");
    expect(screen.getByText("Page content").compareDocumentPosition(ads[0])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("shows a phone no ad rather than the large one when it has no phone slot", () => {
    configure();
    vi.stubEnv("VITE_ADSENSE_PHONE_SLOT", "");
    onPhone();
    mocks.consent = true;
    renderAds();

    expect(units()).toHaveLength(0);
  });

  describe("placeholders", () => {
    const placeholders = () => screen.queryAllByText(/^Ad space:/);

    it("never shows on the real site or anywhere else", () => {
      onWideScreen();

      for (const hostname of ["madeforstream.com", "www.madeforstream.com", "localhost"]) {
        onSite(hostname);
        const { unmount } = renderAds();

        expect(placeholders()).toHaveLength(0);
        unmount();
      }
    });

    it("marks the banner and both side ads on a wide screen, and loads nothing", () => {
      onTestSite();
      onWideScreen();
      renderAds();

      expect(placeholders().map((box) => box.textContent)).toEqual([
        "Ad space: 100% × 90",
        "Ad space: 160 × 600",
        "Ad space: 160 × 600",
      ]);
      expect(script()).toBeNull();
      expect(window.adsbygoogle).toBeUndefined();
    });

    it("marks one small banner under the content on a phone", () => {
      onTestSite();
      onPhone();
      renderAds();

      expect(placeholders().map((box) => box.textContent)).toEqual(["Ad space: 320 × 50"]);
      expect(screen.getByText("Page content").compareDocumentPosition(placeholders()[0])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it("marks the banner under the content on a larger screen too", () => {
      onTestSite();
      onWideScreen();
      renderAds();

      expect(screen.getByText("Page content").compareDocumentPosition(placeholders()[0])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it("keeps side ads off the home page, so it opens with no ads in view", () => {
      onTestSite();
      onWideScreen();
      renderAds("/");

      expect(placeholders().map((box) => box.textContent)).toEqual(["Ad space: 100% × 90"]);
    });

    it("marks nothing on a page that would never show ads", () => {
      onTestSite();
      renderAds("/payments/checkout/abc");

      expect(placeholders()).toHaveLength(0);
    });

    it("gives way to real ads", () => {
      configure();
      onTestSite();
      mocks.consent = true;
      renderAds();

      expect(placeholders()).toHaveLength(0);
      expect(units()).toHaveLength(1);
    });
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
