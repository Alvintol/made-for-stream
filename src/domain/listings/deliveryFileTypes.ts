// The only file types a final delivery can carry, until uploaded files are
// scanned for viruses (decided 2026-10-16). Program and script files are
// left out on purpose. A zip is allowed, and what is inside it is checked
// against the same list before it is uploaded.
//
// The database holds the same list (public.delivery_file_extensions,
// 20261016_165) and refuses anything else; a test keeps the two equal.

import { english, type Translate } from "../../lib/i18n/i18n";

export const deliveryFileTypeGroups = [
  { key: "images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "tif", "tiff", "bmp"] },
  {
    key: "artwork",
    extensions: ["psd", "psb", "clip", "kra", "procreate", "xcf", "ai", "eps", "afphoto", "afdesign"],
  },
  { key: "video", extensions: ["mp4", "mov", "webm", "mkv"] },
  { key: "audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] },
  {
    key: "models",
    extensions: ["vrm", "fbx", "glb", "gltf", "obj", "blend", "moc3", "cmo3", "can3", "json"],
  },
  { key: "fonts", extensions: ["ttf", "otf", "woff", "woff2"] },
  { key: "documents", extensions: ["pdf", "txt"] },
  { key: "archives", extensions: ["zip"] },
] as const;

export const deliveryFileExtensions: readonly string[] = deliveryFileTypeGroups.flatMap(
  (group) => group.extensions,
);

const extensionOf = (name: string) => {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export const isAllowedDeliveryFileName = (name: string): boolean =>
  deliveryFileExtensions.includes(extensionOf(name));

// Files an operating system adds by itself (Finder, Explorer). They are
// left out of a zip made here and ignored inside an uploaded one.
export const isSystemJunkFile = (path: string): boolean => {
  const parts = path.split("/");
  const base = parts[parts.length - 1] ?? "";

  return (
    parts.includes("__MACOSX") ||
    base.startsWith("._") ||
    base === ".DS_Store" ||
    base === "Thumbs.db" ||
    base === "desktop.ini"
  );
};

// The sentence shown when something is refused, naming what was refused.
export const deliveryFileTypesMessage = (
  refused: readonly string[],
  t: Translate = english,
): string => {
  const groups = deliveryFileTypeGroups
    .map((group) => `${t(`fileGroup.${group.key}`)} (${group.extensions.map((e) => e.toUpperCase()).join(", ")})`)
    .join("; ");

  const shown = refused.slice(0, 5).join(", ");
  // Unity packages can carry scripts, so they wait for a safe way to accept
  // them; until then they go off site (decided 2026-10-28).
  const unity = refused.some((name) => extensionOf(name) === "unitypackage")
    ? ` ${t("fileTypes.unityNote")}`
    : "";

  const message = t("fileTypes.message", {
    groups,
    refused: refused.length > 5
      ? t("fileTypes.more", { shown, count: refused.length - 5 })
      : shown,
  });

  return `${message}${unity}`;
};

export const unityPackageNote = english("fileTypes.unityNote");
