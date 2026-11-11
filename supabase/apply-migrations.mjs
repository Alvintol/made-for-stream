// Applies supabase/migrations/*.sql to the prod database, in filename order,
// each file in its own transaction, and records each one in
// supabase_migrations.schema_migrations so the next run only applies new files.
// Stops at the first failure; nothing from the failed file is kept.
//
// Uses Supabase's Management API, so it needs no database password or tools:
// set SUPABASE_ACCESS_TOKEN (Supabase -> Account -> Access tokens) in your shell.
//   node supabase/apply-migrations.mjs caqvtbahdhcznwnbixqq --dry-run   lists what would run
//   node supabase/apply-migrations.mjs caqvtbahdhcznwnbixqq             applies it
//
// Refuses a database that has tables but no record of migrations: that is dev
// (itbgxxczuazwroniiyot), which was migrated by hand, and replaying old files
// there would overwrite newer functions. See docs/environments.md.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

// "20260402_001_expand_profiles.sql" -> name "expand_profiles"; anything not
// shaped like a migration is skipped. The double ".sql.sql" on 042 is kept out.
export const parseMigrationFile = (file) => {
  const match = /^\d{8}_\d{3}_(.+?)(?:\.sql)+$/.exec(file);
  return match ? { file, name: match[1] } : null;
};

export const pendingMigrations = (files, appliedVersions) => {
  const applied = new Set(appliedVersions);
  return files
    .map(parseMigrationFile)
    .filter(Boolean)
    .sort((a, b) => (a.file < b.file ? -1 : 1)) // byte order, not locale: "_a_" must sort as written
    .filter((migration) => !applied.has(migration.file));
};

const sqlString = (value) => `'${value.replaceAll("'", "''")}'`;

const runQuery = async (ref, token, query) => {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return text ? JSON.parse(text) : [];
};

const main = async () => {
  const [ref, flag] = process.argv.slice(2);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.error("Usage: node supabase/apply-migrations.mjs <project-ref> [--dry-run], with SUPABASE_ACCESS_TOKEN set.");
    process.exit(1);
  }

  const [state] = await runQuery(
    ref,
    token,
    `select to_regclass('supabase_migrations.schema_migrations') is not null as tracked,
       (select count(*) from pg_tables where schemaname = 'public')::int as public_tables`,
  );
  if (!state.tracked && state.public_tables > 0) {
    console.error(`Refused: ${ref} has ${state.public_tables} tables but no migration record. Is this dev?`);
    process.exit(1);
  }

  // version holds the whole filename: two series share numbers 106-108.
  await runQuery(
    ref,
    token,
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations
       (version text primary key, statements text[], name text);`,
  );
  const applied = await runQuery(ref, token, "select version from supabase_migrations.schema_migrations");
  const pending = pendingMigrations(fs.readdirSync(migrationsDir), applied.map((row) => row.version));

  console.log(`${applied.length} applied, ${pending.length} to apply.`);
  if (flag === "--dry-run") {
    pending.forEach((migration) => console.log(`  ${migration.file}`));
    return;
  }

  for (const migration of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, migration.file), "utf8");
    try {
      await runQuery(
        ref,
        token,
        `begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name)
         values (${sqlString(migration.file)}, ${sqlString(migration.name)});\ncommit;`,
      );
      console.log(`applied ${migration.file}`);
    } catch (error) {
      console.error(`FAILED ${migration.file} (nothing from it was kept)\n${error.message}`);
      process.exit(1);
    }
  }
  console.log("Done.");
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
