// @vitest-environment node
import fs from "fs";
import path from "path";
// @ts-expect-error -- plain .mjs script, no types
import { parseMigrationFile, pendingMigrations } from "../apply-migrations.mjs";

describe("apply-migrations", () => {
  it("applies every migration file, in filename order, skipping applied ones", () => {
    const files = fs.readdirSync(path.join(__dirname, "../migrations"));
    const all = pendingMigrations(files, []);

    expect(all).toHaveLength(files.filter((file: string) => file.endsWith(".sql")).length);
    expect(all.map((m: { file: string }) => m.file)).toEqual([...all.map((m: { file: string }) => m.file)].sort());
    expect(pendingMigrations(files, [all[0].file])[0]).toEqual(all[1]);
  });

  it("keeps the double .sql out of the name and ignores other files", () => {
    expect(parseMigrationFile("20260502_042_add_history.sql.sql")).toEqual({
      file: "20260502_042_add_history.sql.sql",
      name: "add_history",
    });
    expect(parseMigrationFile("README.md")).toBeNull();
  });
});
