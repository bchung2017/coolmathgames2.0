/**
 * db:check — verify the Postgres/Supabase connection AND the schema isolation
 * before trusting a deploy. Runs the same connection recipe as the app's
 * Postgres backend (search_path pinned via libpq options), applies the schema
 * idempotently, confirms the tables landed in DB_SCHEMA and NOT in public, and
 * round-trips a probe row.
 *
 * Usage (tsx does not auto-load .env, so pass the env in):
 *   DATABASE_URL='postgres://…pooler.supabase.com:5432/postgres' \
 *     DB_SCHEMA=coolmathgames npm run db:check
 *   # or:  set -a; . .env.local; set +a; npm run db:check
 */
import { Pool } from "pg";
import { pgSchema } from "../src/db/schema-name";
import { schemaSql } from "../src/db/schema-sql";

async function main(): Promise<void> {
  const dsn = process.env.DATABASE_URL;
  if (!dsn) {
    console.error(
      "DATABASE_URL not set → the app would use SQLite. Set it (Session pooler URI) to check Postgres.",
    );
    process.exit(1);
  }
  const schema = pgSchema(); // validates DB_SCHEMA as a bare identifier
  const pool = new Pool({
    connectionString: dsn,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
    max: 2,
    options: `-c search_path=${schema}`,
  });
  const ok = (m: string) => console.log("  ✓ " + m);

  try {
    const who = await pool.query("select current_database() db, current_user usr");
    console.log(`Connected: db=${who.rows[0].db} user=${who.rows[0].usr}  schema=${schema}`);

    // 1. Is search_path actually pinned? (The Session-pooler litmus test.)
    const sp = (await pool.query("show search_path")).rows[0].search_path as string;
    console.log(`  search_path = ${sp}`);
    if (!sp.split(",").map((s) => s.trim().replace(/"/g, "")).includes(schema)) {
      throw new Error(
        `search_path is not pinned to "${schema}". This is the Transaction-pooler (:6543) failure — ` +
          `switch to the SESSION pooler (:5432), which preserves connection options.`,
      );
    }
    ok(`search_path pinned to "${schema}"`);

    // 2. Apply schema + tables idempotently.
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}; ${schemaSql()}`);
    ok("schema + tables applied (idempotent)");

    // 3. Did the tables land in OUR schema, and not leak into public?
    const rows = (
      await pool.query(
        `select table_schema from information_schema.tables where table_name = 'instances'`,
      )
    ).rows.map((r) => r.table_schema as string);
    console.log(`  'instances' found in schema(s): ${rows.join(", ") || "(none)"}`);
    if (!rows.includes(schema)) throw new Error(`'instances' is not in "${schema}"`);
    if (schema !== "public" && rows.includes("public")) {
      console.warn(
        "  ! also present in public — a prior run likely used the transaction pooler; investigate before trusting isolation.",
      );
    } else {
      ok(`isolated to "${schema}" (public not touched)`);
    }

    // 4. Round-trip a probe row through unqualified SQL, then clean it up.
    const probe = "db-check-probe";
    await pool.query(
      `insert into instances(instance_id,format_id,topic,misconception,items,created_at)
       values($1,'balance-scale','db:check probe',null,'{}',0)
       on conflict(instance_id) do nothing`,
      [probe],
    );
    const back = await pool.query(`select instance_id from instances where instance_id=$1`, [probe]);
    if (back.rowCount !== 1) throw new Error("probe row did not read back");
    await pool.query(`delete from instances where instance_id=$1`, [probe]);
    ok("write → read → delete round-trip works");

    console.log(
      `\nPASS — persists to schema "${schema}" on "${who.rows[0].db}", isolated from other apps.`,
    );
  } catch (e) {
    console.error(`\nFAIL — ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
