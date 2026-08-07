import { Pool, types } from "pg";
import { pgSchema } from "./schema-name.js";
import { schemaSql } from "./schema-sql.js";
import type {
  Store,
  FormatRow,
  InstanceRow,
  ResultRow,
} from "./store.js";

// pg returns BIGINT (OID 20) as a string. Our BIGINTs are epoch-ms and small
// scores, all inside JS's safe-integer range, so parse to Number to match the
// SQLite backend's row shape exactly.
types.setTypeParser(20, (v) => (v == null ? null : Number(v)) as unknown as number);

/**
 * The shared-Supabase backend. Isolated in its own Postgres schema so it can
 * coexist with other apps in one project without their tables ever colliding.
 *
 * The five no-collision rules (see references/nocollision-schema.md):
 *   1. DB_SCHEMA validated as a bare identifier (pgSchema()).
 *   2. search_path pinned at the CONNECTION level via libpq `options`.
 *   3. Which requires a SESSION-mode connection — the Supabase Session pooler
 *      (`:5432` on *.pooler.supabase.com`). A transaction pooler resets session
 *      state and would silently drop search_path into `public`.
 *   4. DDL is unqualified; search_path places it. CREATE SCHEMA first, then the
 *      unqualified tables, in one idempotent batch on first use.
 *   5. Every query is unqualified — nothing outside the schema is on the path,
 *      so a stray DELETE can only ever hit this app's own tables.
 */
class PostgresStore implements Store {
  readonly backend = "postgres" as const;
  private pool: Pool;
  private ready: Promise<void>;

  constructor() {
    const schema = pgSchema(); // validated bare identifier
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "disable"
          ? false
          : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX ?? 3), // keep small behind the pooler / free tier
      options: `-c search_path=${schema}`, // <-- the crux; needs the Session pooler
    });
    // Apply schema + tables once, in one batch on the same connection, so the
    // tables land in the just-created schema. Memoized via this.ready.
    this.ready = this.pool
      .query(`CREATE SCHEMA IF NOT EXISTS ${schema}; ${schemaSql()}`)
      .then(() => undefined);
  }

  async upsertFormat(r: FormatRow): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO formats(format_id,name,concept_class,spec,created_at)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(format_id) DO UPDATE SET
         name=excluded.name,
         concept_class=excluded.concept_class,
         spec=excluded.spec,
         created_at=excluded.created_at`,
      [r.format_id, r.name, r.concept_class, r.spec, r.created_at],
    );
  }

  async getFormat(formatId: string): Promise<FormatRow | null> {
    await this.ready;
    const res = await this.pool.query<FormatRow>(
      `SELECT * FROM formats WHERE format_id=$1`,
      [formatId],
    );
    return res.rows[0] ?? null;
  }

  async allFormats(): Promise<FormatRow[]> {
    await this.ready;
    const res = await this.pool.query<FormatRow>(
      `SELECT * FROM formats ORDER BY created_at`,
    );
    return res.rows;
  }

  async insertInstance(r: InstanceRow): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO instances(instance_id,format_id,topic,misconception,items,created_at)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [r.instance_id, r.format_id, r.topic, r.misconception, r.items, r.created_at],
    );
  }

  async getInstance(instanceId: string): Promise<InstanceRow | null> {
    await this.ready;
    const res = await this.pool.query<InstanceRow>(
      `SELECT * FROM instances WHERE instance_id=$1`,
      [instanceId],
    );
    return res.rows[0] ?? null;
  }

  async instancesByFormat(formatId: string): Promise<InstanceRow[]> {
    await this.ready;
    const res = await this.pool.query<InstanceRow>(
      `SELECT * FROM instances WHERE format_id=$1 ORDER BY created_at`,
      [formatId],
    );
    return res.rows;
  }

  async insertResult(r: ResultRow): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO results(result_id,instance_id,student_id,score,detail,played_at)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [r.result_id, r.instance_id, r.student_id, r.score, r.detail, r.played_at],
    );
  }

  async resultsForStudent(studentId: string): Promise<ResultRow[]> {
    await this.ready;
    const res = await this.pool.query<ResultRow>(
      `SELECT * FROM results WHERE student_id=$1 ORDER BY played_at`,
      [studentId],
    );
    return res.rows;
  }

  async resultsForInstance(instanceId: string): Promise<ResultRow[]> {
    await this.ready;
    const res = await this.pool.query<ResultRow>(
      `SELECT * FROM results WHERE instance_id=$1 ORDER BY played_at`,
      [instanceId],
    );
    return res.rows;
  }
}

export function createPostgresStore(): Store {
  return new PostgresStore();
}
