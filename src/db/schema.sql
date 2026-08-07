-- Single source of truth for the data layer's DDL (human-readable mirror of
-- SCHEMA_SQL in schema-sql.ts — keep the two in sync).
--
-- Rules (shared by both the SQLite and Postgres backends):
--   * Table names are UNQUALIFIED. On Postgres, search_path places them inside
--     this app's schema; on SQLite there is only one namespace. Never write
--     `public.` or any hardcoded schema here.
--   * Natural TEXT primary keys — no SERIAL/AUTOINCREMENT sequences — so a
--     SQLite -> Postgres copy is a verbatim row insert with nothing to advance.
--   * Type names are chosen to be valid in both engines (SQLite uses type
--     affinity, so BIGINT/DOUBLE PRECISION are accepted and behave sanely).
--   * Enums are modeled as TEXT with the allowed values in a comment (no CHECK
--     constraint) to stay portable; booleans as BIGINT 0/1.
--   * User-referencing columns (author_id, owner_id, target_student_id,
--     player_id) are plain nullable columns for now — the User table (spec §2)
--     is not built yet, so no FK constraint is declared; it lands with User.
--
-- Domain: the teaching-game engine (TECH_SPEC.md §2 vocabulary).
--   cartridges    — the mechanic library (the moat): each row is one cartridge,
--                   a mechanic verified isomorphic to a concept class, plus its
--                   JSON schema. LLM output never lands here directly.
--   games         — a generated game instance: the JSON the LLM emitted for a
--                   (topic, misconception) pair, schema-validated before insert.
--   play_sessions — a play outcome for one game by one player (or anon).

CREATE TABLE IF NOT EXISTS cartridges (
  cartridge_id      TEXT   PRIMARY KEY,   -- natural id, e.g. "balance-scale"
  name              TEXT   NOT NULL,      -- human label, e.g. "Balance Scale"
  slug              TEXT   NOT NULL,      -- url slug (= cartridge_id for seeds)
  concept_class     TEXT   NOT NULL,      -- the isomorphic concept, e.g. "linear-equations"
  author_id         TEXT,                 -- User FK (nullable until User exists); NEVER reassigned
  schema_json       TEXT   NOT NULL,      -- JSON Schema the LLM/editor fills
  engine_bundle_url TEXT,                 -- compiled JS for the iframe (in-app engine today)
  status            TEXT   NOT NULL,      -- draft | published
  schema_version    BIGINT NOT NULL,      -- bump on breaking schema_json change
  created_at        BIGINT NOT NULL,      -- epoch ms
  updated_at        BIGINT NOT NULL       -- epoch ms
);

CREATE TABLE IF NOT EXISTS games (
  game_id                    TEXT   PRIMARY KEY,  -- opaque id for a generated game
  cartridge_id               TEXT   NOT NULL,     -- which mechanic this fills
  owner_id                   TEXT,                -- User FK (nullable until User exists)
  modded_from_id             TEXT,                -- self-ref to games.game_id — mod lineage (§3.3)
  title                      TEXT,                -- display title (nullable)
  topic                      TEXT   NOT NULL,     -- generation input, e.g. "2-step equations"
  misconception              TEXT,                -- the broken mental model this targets (nullable)
  instance_data_json         TEXT   NOT NULL,     -- filled schema, validated before insert
  visibility                 TEXT   NOT NULL,     -- private | public
  status                     TEXT   NOT NULL,     -- draft | published | sent_to_student
  target_student_id          TEXT,                -- User FK (nullable) — "sent to student" cards
  schema_version_at_creation BIGINT NOT NULL,     -- schema_version the instance was filled under
  created_at                 BIGINT NOT NULL,     -- epoch ms
  updated_at                 BIGINT NOT NULL      -- epoch ms
);

CREATE TABLE IF NOT EXISTS play_sessions (
  session_id  TEXT   PRIMARY KEY,     -- opaque id for one play-through
  game_id     TEXT   NOT NULL,        -- which game was played
  player_id   TEXT,                   -- User FK, NULL for anon plays (§5)
  score       BIGINT NOT NULL,        -- items correct (or engine-defined score)
  completed   BIGINT NOT NULL,        -- 0 | 1 (portable bool)
  detail      TEXT,                   -- JSON: per-item outcomes, timings (nullable)
  started_at  BIGINT,                 -- epoch ms (nullable)
  ended_at    BIGINT NOT NULL         -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_games_cartridge   ON games(cartridge_id);
CREATE INDEX IF NOT EXISTS idx_games_modded_from ON games(modded_from_id);
CREATE INDEX IF NOT EXISTS idx_sessions_game     ON play_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player   ON play_sessions(player_id);
