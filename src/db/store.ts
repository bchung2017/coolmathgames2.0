/**
 * The data-layer interface, plus lazy+memoized backend selection.
 *
 * Keep this interface to raw row-level reads/writes. Domain logic — schema
 * validation of LLM output, difficulty tuning, progress rollups — lives ABOVE
 * the store, so the two backends stay trivially swappable and row-for-row
 * identical.
 *
 * Backend selection: DATABASE_URL set -> Postgres/Supabase; unset -> on-disk
 * SQLite (the zero-config default).
 */

export interface FormatRow {
  format_id: string;
  name: string;
  concept_class: string;
  spec: string; // JSON string
  created_at: number; // epoch ms
}

export interface InstanceRow {
  instance_id: string;
  format_id: string;
  topic: string;
  misconception: string | null;
  items: string; // JSON string
  created_at: number; // epoch ms
}

export interface ResultRow {
  result_id: string;
  instance_id: string;
  student_id: string;
  score: number;
  detail: string | null; // JSON string
  played_at: number; // epoch ms
}

export interface Store {
  readonly backend: "sqlite" | "postgres";

  // formats — the mechanic library
  upsertFormat(row: FormatRow): Promise<void>;
  getFormat(formatId: string): Promise<FormatRow | null>;
  allFormats(): Promise<FormatRow[]>;

  // instances — generated game instances
  insertInstance(row: InstanceRow): Promise<void>;
  getInstance(instanceId: string): Promise<InstanceRow | null>;
  instancesByFormat(formatId: string): Promise<InstanceRow[]>;

  // results — play outcomes
  insertResult(row: ResultRow): Promise<void>;
  resultsForStudent(studentId: string): Promise<ResultRow[]>;
  resultsForInstance(instanceId: string): Promise<ResultRow[]>;
}

// Pin the instance on a global so dev hot-reload doesn't reopen the DB handle
// or the pool. Constructed lazily on first getStore() call — never at import
// time, so a production build opens nothing.
const globalForStore = globalThis as unknown as { __store?: Promise<Store> };

export function getStore(): Promise<Store> {
  if (!globalForStore.__store) {
    globalForStore.__store = process.env.DATABASE_URL
      ? import("./postgres-store.js").then((m) => m.createPostgresStore())
      : import("./sqlite-store.js").then((m) => m.createSqliteStore());
  }
  return globalForStore.__store;
}
