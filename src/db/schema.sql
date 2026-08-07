-- Single source of truth for the data layer's DDL.
--
-- Rules (shared by both the SQLite and Postgres backends):
--   * Table names are UNQUALIFIED. On Postgres, search_path places them inside
--     this app's schema; on SQLite there is only one namespace. Never write
--     `public.` or any hardcoded schema here.
--   * Natural TEXT primary keys — no SERIAL/AUTOINCREMENT sequences — so a
--     SQLite -> Postgres copy is a verbatim row insert with nothing to advance.
--   * Type names are chosen to be valid in both engines (SQLite uses type
--     affinity, so BIGINT/DOUBLE PRECISION are accepted and behave sanely).
--
-- Domain: the teaching-game engine.
--   formats   — the mechanic library (the moat): each row is one game format,
--               a mechanic verified isomorphic to a concept class, plus its
--               JSON spec/schema. LLM output never lands here directly.
--   instances — a generated game instance: the JSON the LLM emitted for a
--               (topic, misconception) pair, already schema-validated by the
--               engine before insert.
--   results   — a play outcome for one instance by one student.

CREATE TABLE IF NOT EXISTS formats (
  format_id     TEXT   PRIMARY KEY,   -- e.g. "balance-scale", "pipe-flow"
  name          TEXT   NOT NULL,      -- human label, e.g. "Balance Scale"
  concept_class TEXT   NOT NULL,      -- the isomorphic concept, e.g. "linear-equations"
  spec          TEXT   NOT NULL,      -- JSON: the instantiation schema for this mechanic
  created_at    BIGINT NOT NULL       -- epoch ms
);

CREATE TABLE IF NOT EXISTS instances (
  instance_id  TEXT   PRIMARY KEY,    -- opaque id for a generated instance
  format_id    TEXT   NOT NULL,       -- which mechanic this fills
  topic        TEXT   NOT NULL,       -- e.g. "solving 2-step equations"
  misconception TEXT,                 -- the broken mental model this targets (nullable)
  items        TEXT   NOT NULL,       -- JSON: item set + difficulty ramp + distractors
  created_at   BIGINT NOT NULL        -- epoch ms
);

CREATE TABLE IF NOT EXISTS results (
  result_id   TEXT   PRIMARY KEY,     -- opaque id for one play-through
  instance_id TEXT   NOT NULL,        -- which instance was played
  student_id  TEXT   NOT NULL,        -- natural id for the learner
  score       BIGINT NOT NULL,        -- items correct (or engine-defined score)
  detail      TEXT,                   -- JSON: per-item outcomes, timings, etc. (nullable)
  played_at   BIGINT NOT NULL         -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_instances_format  ON instances(format_id);
CREATE INDEX IF NOT EXISTS idx_results_instance  ON results(instance_id);
CREATE INDEX IF NOT EXISTS idx_results_student   ON results(student_id);
