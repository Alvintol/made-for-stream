import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("email logo", () => {
  it("shows the white logo at its set size once EMAIL_LOGO_URL is set", async () => {
    vi.resetModules();
    vi.stubEnv("EMAIL_LOGO_URL", "https://madeforstream.com/brand/logo-white.png");

    const { renderActionEmail } = await import("../emailTemplates.js");
    const { html } = renderActionEmail({ subject: "Hi", title: "Hi", ctaUrl: "https://madeforstream.com", ctaLabel: "Open" });

    expect(html).toContain(
      '<img src="https://madeforstream.com/brand/logo-white.png" alt="Made for Stream" width="138" height="40"',
    );
    // The website serves the file that address points at (tests run from the repository root).
    expect(existsSync("public/brand/logo-white.png")).toBe(true);

    vi.unstubAllEnvs();
  });
});
