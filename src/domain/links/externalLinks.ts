// Decides how a link a user typed in should be shown to someone else
// (first use: work-sample links in the admin application review).
//
// Nothing here can tell whether a page is malicious. What it can do is make
// sure only ordinary web links are clickable, show where a link really goes,
// and point out the tricks that make a dangerous link look harmless. The
// database enforces the web-link shape too (20261005_141), so this is the
// second check, not the only one.

export type ExternalLinkLevel = "known" | "unfamiliar" | "blocked";

export type ExternalLinkAssessment = {
  level: ExternalLinkLevel;
  // Safe to put in an href. Null when blocked: render it as plain text.
  href: string | null;
  // What the browser will actually connect to. Punycode stays encoded on
  // purpose, so a lookalike domain reads as "xn--…" rather than as its disguise.
  host: string | null;
  // Plain-language reasons to be careful, most serious first.
  warnings: string[];
};

// Sites creators commonly keep work on. A link here still goes to
// user-posted content, but the site itself is who it says it is.
const KNOWN_HOSTS = [
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  "kick.com",
  "x.com",
  "twitter.com",
  "bsky.app",
  "instagram.com",
  "tiktok.com",
  "vimeo.com",
  "soundcloud.com",
  "artstation.com",
  "behance.net",
  "deviantart.com",
  "github.com",
  "imgur.com",
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
];

// These hide the real destination until you have already gone there.
const SHORTENER_HOSTS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "cutt.ly",
  "rebrand.ly",
  "shorturl.at",
  "ow.ly",
  "rb.gy",
  "tiny.cc",
  "lnkd.in",
  "grabify.link",
  "iplogger.org",
];

const DOWNLOAD_EXTENSIONS =
  /\.(exe|msi|scr|bat|cmd|com|pif|ps1|vbs|js|jar|apk|dmg|pkg|iso|img|zip|rar|7z|docm|xlsm|pptm|lnk|hta)$/i;

const matchesHost = (host: string, list: string[]): boolean =>
  list.some((known) => host === known || host.endsWith(`.${known}`));

const isIpAddress = (host: string): boolean =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");

const blocked = (reason: string): ExternalLinkAssessment => ({
  level: "blocked",
  href: null,
  host: null,
  warnings: [reason],
});

export const assessExternalLink = (
  value: string | null | undefined,
): ExternalLinkAssessment => {
  const raw = (value ?? "").trim();

  if (!raw) {
    return blocked("No link was provided.");
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return blocked("This is not a valid web address.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return blocked(
      `This is a "${url.protocol.replace(":", "")}" link, not a web page. It can't be opened from here.`,
    );
  }

  // https://youtube.com@evil.example goes to evil.example.
  if (url.username || url.password) {
    return blocked(
      `This address is written to look like one site while going to another (${url.hostname}).`,
    );
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const warnings: string[] = [];

  if (host.split(".").some((label) => label.startsWith("xn--"))) {
    warnings.push(
      "The domain uses special characters that can imitate another site's name.",
    );
  }

  if (isIpAddress(host) || host === "localhost") {
    warnings.push("This goes to a raw network address, not a named website.");
  }

  if (matchesHost(host, SHORTENER_HOSTS)) {
    warnings.push(
      "This is a link shortener or tracker. It hides where you will actually end up.",
    );
  }

  if (DOWNLOAD_EXTENSIONS.test(url.pathname)) {
    warnings.push("This links straight to a file download, not a page.");
  }

  if (url.port) {
    warnings.push(`It uses an unusual port (${url.port}).`);
  }

  if (url.protocol === "http:") {
    warnings.push("The connection is not encrypted (http, not https).");
  }

  if (!matchesHost(host, KNOWN_HOSTS)) {
    warnings.push("This isn't a site creators commonly use. Check the domain before opening it.");
  }

  return {
    level: warnings.length === 0 ? "known" : "unfamiliar",
    href: url.href,
    host,
    warnings,
  };
};

// Shown before opening an unfamiliar link.
export const getExternalLinkConfirmMessage = (
  assessment: ExternalLinkAssessment,
): string =>
  [
    `You're about to open:\n${assessment.href}`,
    `It goes to: ${assessment.host}`,
    ...assessment.warnings.map((warning) => `• ${warning}`),
    "Don't sign in to anything or download anything from it. Continue?",
  ].join("\n\n");
