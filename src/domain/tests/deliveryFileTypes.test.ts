import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  deliveryFileExtensions,
  deliveryFileTypesMessage,
  isAllowedDeliveryFileName,
  isSystemJunkFile,
  unityPackageNote,
} from "../listings/deliveryFileTypes";

describe("delivery file types", () => {
  it("matches the database's list exactly", () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/20261016_165_restrict_delivery_file_types.sql"),
      "utf8",
    );
    const body = migration.slice(
      migration.indexOf("create or replace function public.delivery_file_extensions()"),
      migration.indexOf("create or replace function public.is_allowed_delivery_file_name"),
    );
    const inDatabase = [...body.matchAll(/'([a-z0-9]+)'/g)].map((match) => match[1]);

    expect(inDatabase).toEqual([...deliveryFileExtensions]);
  });

  it("allows art, video, models and zips, and refuses programs and scripts", () => {
    for (const name of ["pack.zip", "Emote.PNG", "model.vrm", "Hiyori.model3.json", "source.psd", "intro.mp4"]) {
      expect(isAllowedDeliveryFileName(name)).toBe(true);
    }
    for (const name of ["setup.exe", "run.bat", "script.js", "avatar.unitypackage", "archive.rar", "noextension", ".png"]) {
      expect(isAllowedDeliveryFileName(name)).toBe(false);
    }
  });

  it("recognises files an operating system adds by itself", () => {
    expect(isSystemJunkFile("Pack/.DS_Store")).toBe(true);
    expect(isSystemJunkFile("__MACOSX/Pack/._emote.png")).toBe(true);
    expect(isSystemJunkFile("Pack/Thumbs.db")).toBe(true);
    expect(isSystemJunkFile("Pack/emote.png")).toBe(false);
  });

  it("says why, and names what was refused", () => {
    const message = deliveryFileTypesMessage(["a.exe", "b.bat", "c.js", "d.vbs", "e.msi", "f.cmd"]);

    expect(message).toMatch(/^For safety, only these file types can be uploaded: images \(PNG, JPG/);
    expect(message).toContain("archives (ZIP)");
    expect(message).toMatch(/Not allowed: a\.exe, b\.bat, c\.js, d\.vbs, e\.msi and 1 more\.$/);
  });

  it("tells a creator refused a Unity package to send it off site for now, also from inside a zip", () => {
    expect(deliveryFileTypesMessage(["avatar.unitypackage"])).toMatch(
      /Not allowed: avatar\.unitypackage\. We are working on a safe way to accept Unity packages .+ “Provided off site” .+\.$/,
    );
    expect(deliveryFileTypesMessage(["pack.zip: Pack/avatar.UnityPackage"])).toContain(unityPackageNote);
    expect(deliveryFileTypesMessage(["setup.exe"])).not.toContain("Unity");
  });
});
