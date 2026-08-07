/**
 * The DDL — the single source of truth shared by both backends and the
 * migration script.
 *
 * It's an inline constant (not read from schema.sql at runtime) so it survives
 * bundling: Next traces server code and a stray `fs.readFileSync(schema.sql)`
 * wouldn't reliably ship. `src/db/schema.sql` is kept as the human-readable
 * mirror of this string — keep the two in sync.
 *
 * Rules: unqualified table names (search_path places them on Postgres), natural
 * TEXT primary keys (verbatim SQLite -> Postgres copy), types valid in both
 * engines.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS formats (
  format_id     TEXT   PRIMARY KEY,
  name          TEXT   NOT NULL,
  concept_class TEXT   NOT NULL,
  spec          TEXT   NOT NULL,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS instances (
  instance_id   TEXT   PRIMARY KEY,
  format_id     TEXT   NOT NULL,
  topic         TEXT   NOT NULL,
  misconception TEXT,
  items         TEXT   NOT NULL,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS results (
  result_id   TEXT   PRIMARY KEY,
  instance_id TEXT   NOT NULL,
  student_id  TEXT   NOT NULL,
  score       BIGINT NOT NULL,
  detail      TEXT,
  played_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instances_format ON instances(format_id);
CREATE INDEX IF NOT EXISTS idx_results_instance ON results(instance_id);
CREATE INDEX IF NOT EXISTS idx_results_student  ON results(student_id);
`;

export function schemaSql(): string {
  return SCHEMA_SQL;
}
