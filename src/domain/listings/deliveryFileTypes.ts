// The only file types a final delivery can carry, until uploaded files are
// scanned for viruses (decided 2026-10-16). Program and script files are
// left out on purpose. A zip is allowed, and what is inside it is checked
// against the same list before it is uploaded.
//
// The database holds the same list (public.delivery_file_extensions,
// 20261016_165) and refuses anything else; a test keeps the two equal.

export const deliveryFileTypeGroups = [
  { label: "images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "tif", "tiff", "bmp"] },
  {
    label: "artwork",
    extensions: ["psd", "psb", "clip", "kra", "procreate", "xcf", "ai", "eps", "afphoto", "afdesign"],
  },
  { label: "video", extensions: ["mp4", "mov", "webm", "mkv"] },
  { label: "audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] },
  {
    label: "models and Live2D",
    extensions: ["vrm", "fbx", "glb", "gltf", "obj", "blend", "moc3", "cmo3", "can3", "json"],
  },
  { label: "fonts", extensions: ["ttf", "otf", "woff", "woff2"] },
  { label: "documents", extensions: ["pdf", "txt"] },
  { label: "archives", extensions: ["zip"] },
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
export const deliveryFileTypesMessage = (refused: readonly string[]): string => {
  const groups = deliveryFileTypeGroups
    .map((group) => `${group.label} (${group.extensions.map((e) => e.toUpperCase()).join(", ")})`)
    .join("; ");

  const shown = refused.slice(0, 5).join(", ");
  const more = refused.length > 5 ? ` and ${refused.length - 5} more` : "";

  // Unity packages can carry scripts, so they wait for a safe way to accept
  // them; until then they go off site (decided 2026-10-28).
  const unity = refused.some((name) => extensionOf(name) === "unitypackage")
    ? ` ${unityPackageNote}`
    : "";

  return `For safety, only these file types can be uploaded: ${groups}. Not allowed: ${shown}${more}.${unity}`;
};

export const unityPackageNote =
  "We are working on a safe way to accept Unity packages (.unitypackage) in a future update. For now, send them outside Made for Stream and tick “Provided off site” so the buyer can confirm they arrived.";
