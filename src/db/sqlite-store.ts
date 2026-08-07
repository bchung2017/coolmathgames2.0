import Database from "better-sqlite3";
import { schemaSql } from "./schema-sql";
import type { Store, FormatRow, InstanceRow, ResultRow } from "./store";

/**
 * The zero-config default backend: an on-disk SQLite file. Opened lazily by
 * createSqliteStore(); applies the schema on first use (CREATE TABLE IF NOT
 * EXISTS …) so there is no separate migrate step to forget.
 *
 * better-sqlite3 is synchronous; the methods are async only to share one
 * interface with the Postgres backend.
 */
class SqliteStore implements Store {
  readonly backend = "sqlite" as const;
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(schemaSql());
  }

  async upsertFormat(r: FormatRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO formats(format_id,name,concept_class,spec,created_at)
         VALUES(@format_id,@name,@concept_class,@spec,@created_at)
         ON CONFLICT(format_id) DO UPDATE SET
           name=excluded.name,
           concept_class=excluded.concept_class,
           spec=excluded.spec,
           created_at=excluded.created_at`,
      )
      .run(r);
  }

  async getFormat(formatId: string): Promise<FormatRow | null> {
    const row = this.db
      .prepare(`SELECT * FROM formats WHERE format_id=?`)
      .get(formatId) as FormatRow | undefined;
    return row ?? null;
  }

  async allFormats(): Promise<FormatRow[]> {
    return this.db
      .prepare(`SELECT * FROM formats ORDER BY created_at`)
      .all() as FormatRow[];
  }

  async insertInstance(r: InstanceRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO instances(instance_id,format_id,topic,misconception,items,created_at)
         VALUES(@instance_id,@format_id,@topic,@misconception,@items,@created_at)`,
      )
      .run(r);
  }

  async getInstance(instanceId: string): Promise<InstanceRow | null> {
    const row = this.db
      .prepare(`SELECT * FROM instances WHERE instance_id=?`)
      .get(instanceId) as InstanceRow | undefined;
    return row ?? null;
  }

  async allInstances(): Promise<InstanceRow[]> {
    return this.db
      .prepare(`SELECT * FROM instances ORDER BY created_at DESC`)
      .all() as InstanceRow[];
  }

  async instancesByFormat(formatId: string): Promise<InstanceRow[]> {
    return this.db
      .prepare(`SELECT * FROM instances WHERE format_id=? ORDER BY created_at`)
      .all(formatId) as InstanceRow[];
  }

  async insertResult(r: ResultRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO results(result_id,instance_id,student_id,score,detail,played_at)
         VALUES(@result_id,@instance_id,@student_id,@score,@detail,@played_at)`,
      )
      .run(r);
  }

  async resultsForStudent(studentId: string): Promise<ResultRow[]> {
    return this.db
      .prepare(`SELECT * FROM results WHERE student_id=? ORDER BY played_at`)
      .all(studentId) as ResultRow[];
  }

  async resultsForInstance(instanceId: string): Promise<ResultRow[]> {
    return this.db
      .prepare(`SELECT * FROM results WHERE instance_id=? ORDER BY played_at`)
      .all(instanceId) as ResultRow[];
  }
}

export function createSqliteStore(): Store {
  const path = process.env.SQLITE_PATH ?? "coolmathgames.db";
  return new SqliteStore(path);
}
