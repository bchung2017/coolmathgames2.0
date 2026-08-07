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
CREATE TABLE IF NOT EXISTS cartridges (
  cartridge_id      TEXT   PRIMARY KEY,          -- natural id, e.g. "balance-scale"
  name              TEXT   NOT NULL,
  slug              TEXT   NOT NULL,
  concept_class     TEXT   NOT NULL,             -- the isomorphic concept, e.g. "linear-equations"
  author_id         TEXT,                        -- User FK (nullable until User exists); NEVER reassigned
  schema_json       TEXT   NOT NULL,             -- JSON Schema the LLM/editor fills
  engine_bundle_url TEXT,                         -- compiled JS for the iframe (in-app engine today)
  status            TEXT   NOT NULL,             -- draft | published
  schema_version    BIGINT NOT NULL,             -- bump on breaking schema_json change
  created_at        BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  game_id                   TEXT   PRIMARY KEY,
  cartridge_id              TEXT   NOT NULL,      -- which mechanic this fills
  owner_id                  TEXT,                 -- User FK (nullable until User exists)
  modded_from_id            TEXT,                 -- self-ref to games.game_id — mod lineage
  title                     TEXT,
  topic                     TEXT   NOT NULL,      -- generation input, e.g. "2-step equations"
  misconception             TEXT,                 -- the broken mental model this targets
  instance_data_json        TEXT   NOT NULL,      -- filled schema, validated before insert
  visibility                TEXT   NOT NULL,      -- private | public
  status                    TEXT   NOT NULL,      -- draft | published | sent_to_student
  target_student_id         TEXT,                 -- User FK (nullable) — "sent to student" cards
  schema_version_at_creation BIGINT NOT NULL,     -- schema_version the instance was filled under
  created_at                BIGINT NOT NULL,
  updated_at                BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS play_sessions (
  session_id  TEXT   PRIMARY KEY,
  game_id     TEXT   NOT NULL,                    -- which game was played
  player_id   TEXT,                               -- User FK, NULL for anon plays (§5)
  score       BIGINT NOT NULL,
  completed   BIGINT NOT NULL,                    -- 0 | 1 (portable bool)
  detail      TEXT,                               -- JSON: per-item outcomes, timings
  started_at  BIGINT,                             -- epoch ms (nullable)
  ended_at    BIGINT NOT NULL                     -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_games_cartridge     ON games(cartridge_id);
CREATE INDEX IF NOT EXISTS idx_games_modded_from   ON games(modded_from_id);
CREATE INDEX IF NOT EXISTS idx_sessions_game       ON play_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player     ON play_sessions(player_id);
`;

export function schemaSql(): string {
  return SCHEMA_SQL;
}
