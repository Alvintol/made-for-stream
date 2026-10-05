import { describe, expect, it } from "vitest";
import {
  assessExternalLink,
  getExternalLinkConfirmMessage,
} from "../links/externalLinks";

describe("assessExternalLink", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
    "https://clips.twitch.tv/SomeClip",
    "https://www.artstation.com/artwork/xyz",
  ])("treats %s as a known site with nothing to warn about", (url) => {
    const result = assessExternalLink(url);

    expect(result.level).toBe("known");
    expect(result.href).toBe(new URL(url).href);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ["javascript:alert(document.cookie)", /"javascript" link/],
    ["data:text/html,<script>alert(1)</script>", /"data" link/],
    ["file:///C:/Windows/system32", /"file" link/],
    ["vbscript:msgbox(1)", /"vbscript" link/],
    ["not a url", /not a valid web address/],
    ["", /No link/],
    [null, /No link/],
  ])("never makes %s clickable", (url, reason) => {
    const result = assessExternalLink(url);

    expect(result.level).toBe("blocked");
    expect(result.href).toBeNull();
    expect(result.warnings[0]).toMatch(reason);
  });

  it("blocks an address dressed up as another site with an @", () => {
    const result = assessExternalLink("https://youtube.com@evil.example/watch");

    expect(result.level).toBe("blocked");
    expect(result.href).toBeNull();
    expect(result.warnings[0]).toContain("evil.example");
  });

  it("does not trust a lookalike that merely contains a known name", () => {
    for (const url of [
      "https://youtube.com.evil.example/watch",
      "https://notyoutube.com/watch",
      "https://evil.example/youtube.com",
    ]) {
      expect(assessExternalLink(url).level, url).toBe("unfamiliar");
    }
  });

  it("flags a punycode domain and shows it encoded", () => {
    // "уoutube.com" with a Cyrillic first letter.
    const result = assessExternalLink("https://\u0443outube.com/watch");

    expect(result.level).toBe("unfamiliar");
    expect(result.host).toMatch(/^xn--/);
    expect(result.warnings.join(" ")).toMatch(/imitate another site/);
  });

  it.each([
    ["https://bit.ly/3abc", /shortener or tracker/],
    ["https://grabify.link/ABC123", /shortener or tracker/],
    ["http://192.168.1.10/portfolio", /raw network address/],
    ["https://example.com/portfolio.exe", /file download/],
    ["https://example.com:8443/work", /unusual port/],
    ["http://example.com/work", /not encrypted/],
    ["https://my-portfolio.example/work", /isn't a site creators commonly use/],
  ])("warns about %s", (url, warning) => {
    const result = assessExternalLink(url);

    expect(result.level).toBe("unfamiliar");
    expect(result.href).not.toBeNull();
    expect(result.warnings.join(" ")).toMatch(warning);
  });

  it("downgrades a known site when something else is off", () => {
    const result = assessExternalLink("http://www.youtube.com/watch?v=abc");

    expect(result.level).toBe("unfamiliar");
    expect(result.warnings).toEqual(["The connection is not encrypted (http, not https)."]);
  });

  it("trims whitespace and reports the host without www", () => {
    expect(assessExternalLink("  https://www.twitch.tv/someone  ").host).toBe("twitch.tv");
  });
});

describe("getExternalLinkConfirmMessage", () => {
  it("shows the full address, the real host and every warning", () => {
    const message = getExternalLinkConfirmMessage(
      assessExternalLink("http://bit.ly/3abc"),
    );

    expect(message).toContain("http://bit.ly/3abc");
    expect(message).toContain("It goes to: bit.ly");
    expect(message).toContain("shortener or tracker");
    expect(message).toContain("not encrypted");
    expect(message).toContain("Don't sign in");
  });
});
