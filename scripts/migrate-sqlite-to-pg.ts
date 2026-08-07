/**
 * One-shot SQLite -> Postgres copy.
 *
 * Applies the schema into this app's namespace (idempotent), then REFUSES to
 * run if any target table already holds rows, so a second accidental run can't
 * double-insert. Natural TEXT primary keys mean rows copy verbatim with no
 * sequence to advance.
 *
 * Usage:
 *   DATABASE_URL=... DB_SCHEMA=coolmathgames \
 *     tsx scripts/migrate-sqlite-to-pg.ts [path/to/coolmathgames.db]
 */
import Database from "better-sqlite3";
import { Pool } from "pg";
import { pgSchema } from "../src/db/schema-name";
import { schemaSql } from "../src/db/schema-sql";

const TABLES = ["cartridges", "games", "play_sessions"] as const;

async function main(): Promise<void> {
  const srcPath = process.argv[2] ?? process.env.SQLITE_PATH ?? "coolmathgames.db";
  const dsn = process.env.DATABASE_URL;
  if (!dsn) {
    console.error("DATABASE_URL is required (the Postgres/Supabase target).");
    process.exit(1);
  }
  const schema = pgSchema();

  const src = new Database(srcPath, { readonly: true });
  const dst = new Pool({
    connectionString: dsn,
    ssl:
      process.env.DATABASE_SSL === "disable"
        ? false
        : { rejectUnauthorized: false },
    options: `-c search_path=${schema}`,
  });

  await dst.query(`CREATE SCHEMA IF NOT EXISTS ${schema}; ${schemaSql()}`);

  // Guard: refuse to copy into any populated table.
  for (const table of TABLES) {
    const { rows } = await dst.query(`SELECT count(*)::int AS n FROM ${table}`);
    if (rows[0].n) {
      console.error(
        `refusing to run: ${table} already has ${rows[0].n} rows in schema ${schema}`,
      );
      process.exit(1);
    }
  }

  const columns: Record<(typeof TABLES)[number], string[]> = {
    cartridges: [
      "cartridge_id", "name", "slug", "concept_class", "author_id", "schema_json",
      "engine_bundle_url", "status", "schema_version", "created_at", "updated_at",
    ],
    games: [
      "game_id", "cartridge_id", "owner_id", "modded_from_id", "title", "topic",
      "misconception", "instance_data_json", "visibility", "status",
      "target_student_id", "schema_version_at_creation", "created_at", "updated_at",
    ],
    play_sessions: [
      "session_id", "game_id", "player_id", "score", "completed", "detail",
      "started_at", "ended_at",
    ],
  };
  const inserts: Record<(typeof TABLES)[number], string> = {
    cartridges: `INSERT INTO cartridges(${columns.cartridges.join(",")}) VALUES(${columns.cartridges.map((_, i) => `$${i + 1}`).join(",")})`,
    games: `INSERT INTO games(${columns.games.join(",")}) VALUES(${columns.games.map((_, i) => `$${i + 1}`).join(",")})`,
    play_sessions: `INSERT INTO play_sessions(${columns.play_sessions.join(",")}) VALUES(${columns.play_sessions.map((_, i) => `$${i + 1}`).join(",")})`,
  };

  for (const table of TABLES) {
    const rows = src.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    for (const row of rows) {
      await dst.query(inserts[table], columns[table].map((c) => row[c]));
    }
    console.log(`copied ${rows.length} rows into ${schema}.${table}`);
  }

  await dst.end();
  src.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
