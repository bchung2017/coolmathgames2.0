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

// Row shapes mirror the DDL in schema-sql.ts (TECH_SPEC.md §2 vocabulary).
// User-referencing ids are nullable strings until the User entity exists.

export interface CartridgeRow {
  cartridge_id: string;
  name: string;
  slug: string;
  concept_class: string;
  author_id: string | null;
  schema_json: string; // JSON string
  engine_bundle_url: string | null;
  status: string; // draft | published
  schema_version: number;
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
}

export interface GameRow {
  game_id: string;
  cartridge_id: string;
  owner_id: string | null;
  modded_from_id: string | null; // self-ref — mod lineage
  title: string | null;
  topic: string;
  misconception: string | null;
  instance_data_json: string; // JSON string
  visibility: string; // private | public
  status: string; // draft | published | sent_to_student
  target_student_id: string | null;
  schema_version_at_creation: number;
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
}

export interface PlaySessionRow {
  session_id: string;
  game_id: string;
  player_id: string | null; // NULL for anon plays
  score: number;
  completed: number; // 0 | 1
  detail: string | null; // JSON string
  started_at: number | null; // epoch ms
  ended_at: number; // epoch ms
}

// Filter for queryGames — only provided fields are constrained (AND-ed).
export interface GameFilter {
  ownerId?: string;
  cartridgeId?: string;
  visibility?: string;
  status?: string;
  targetStudentId?: string;
}

// Mutable subset of a game (UPDATE path). owner_id, cartridge_id, and lineage
// are intentionally NOT here — ownership/authorship/lineage are set once.
export type GamePatch = Partial<
  Pick<GameRow, "title" | "visibility" | "status" | "target_student_id">
> & { updated_at: number };

export interface Store {
  readonly backend: "sqlite" | "postgres";

  // cartridges — the mechanic library
  upsertCartridge(row: CartridgeRow): Promise<void>;
  getCartridge(cartridgeId: string): Promise<CartridgeRow | null>;
  allCartridges(): Promise<CartridgeRow[]>;

  // games — generated game instances
  insertGame(row: GameRow): Promise<void>;
  getGame(gameId: string): Promise<GameRow | null>;
  allGames(): Promise<GameRow[]>;
  gamesByCartridge(cartridgeId: string): Promise<GameRow[]>;
  queryGames(filter: GameFilter): Promise<GameRow[]>;
  updateGame(gameId: string, patch: GamePatch): Promise<void>;
  /**
   * Delete a game and its play sessions; detaches any mods derived from it
   * (their modded_from_id is nulled, not cascade-deleted). Returns games
   * deleted (0 or 1).
   */
  deleteGame(gameId: string): Promise<number>;

  // play_sessions — play outcomes
  insertPlaySession(row: PlaySessionRow): Promise<void>;
  sessionsForPlayer(playerId: string): Promise<PlaySessionRow[]>;
  sessionsForGame(gameId: string): Promise<PlaySessionRow[]>;
}

// Pin the instance on a global so dev hot-reload doesn't reopen the DB handle
// or the pool. Constructed lazily on first getStore() call — never at import
// time, so a production build opens nothing.
const globalForStore = globalThis as unknown as { __store?: Promise<Store> };

export function getStore(): Promise<Store> {
  if (!globalForStore.__store) {
    globalForStore.__store = process.env.DATABASE_URL
      ? import("./postgres-store").then((m) => m.createPostgresStore())
      : import("./sqlite-store").then((m) => m.createSqliteStore());
  }
  return globalForStore.__store;
}
