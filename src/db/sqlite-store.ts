import Database from "better-sqlite3";
import { schemaSql } from "./schema-sql";
import type { Store, CartridgeRow, GameRow, PlaySessionRow, GameFilter, GamePatch } from "./store";

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

  async upsertCartridge(r: CartridgeRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO cartridges(cartridge_id,name,slug,concept_class,author_id,schema_json,engine_bundle_url,status,schema_version,created_at,updated_at)
         VALUES(@cartridge_id,@name,@slug,@concept_class,@author_id,@schema_json,@engine_bundle_url,@status,@schema_version,@created_at,@updated_at)
         ON CONFLICT(cartridge_id) DO UPDATE SET
           name=excluded.name,
           slug=excluded.slug,
           concept_class=excluded.concept_class,
           schema_json=excluded.schema_json,
           engine_bundle_url=excluded.engine_bundle_url,
           status=excluded.status,
           schema_version=excluded.schema_version,
           updated_at=excluded.updated_at`,
      )
      .run(r);
  }

  async getCartridge(cartridgeId: string): Promise<CartridgeRow | null> {
    const row = this.db
      .prepare(`SELECT * FROM cartridges WHERE cartridge_id=?`)
      .get(cartridgeId) as CartridgeRow | undefined;
    return row ?? null;
  }

  async allCartridges(): Promise<CartridgeRow[]> {
    return this.db
      .prepare(`SELECT * FROM cartridges ORDER BY created_at`)
      .all() as CartridgeRow[];
  }

  async insertGame(r: GameRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO games(game_id,cartridge_id,owner_id,modded_from_id,title,topic,misconception,instance_data_json,visibility,status,target_student_id,schema_version_at_creation,created_at,updated_at)
         VALUES(@game_id,@cartridge_id,@owner_id,@modded_from_id,@title,@topic,@misconception,@instance_data_json,@visibility,@status,@target_student_id,@schema_version_at_creation,@created_at,@updated_at)`,
      )
      .run(r);
  }

  async getGame(gameId: string): Promise<GameRow | null> {
    const row = this.db
      .prepare(`SELECT * FROM games WHERE game_id=?`)
      .get(gameId) as GameRow | undefined;
    return row ?? null;
  }

  async allGames(): Promise<GameRow[]> {
    return this.db
      .prepare(`SELECT * FROM games ORDER BY created_at DESC`)
      .all() as GameRow[];
  }

  async gamesByCartridge(cartridgeId: string): Promise<GameRow[]> {
    return this.db
      .prepare(`SELECT * FROM games WHERE cartridge_id=? ORDER BY created_at`)
      .all(cartridgeId) as GameRow[];
  }

  async queryGames(f: GameFilter): Promise<GameRow[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (f.ownerId !== undefined) { clauses.push("owner_id=?"); params.push(f.ownerId); }
    if (f.cartridgeId !== undefined) { clauses.push("cartridge_id=?"); params.push(f.cartridgeId); }
    if (f.visibility !== undefined) { clauses.push("visibility=?"); params.push(f.visibility); }
    if (f.status !== undefined) { clauses.push("status=?"); params.push(f.status); }
    if (f.targetStudentId !== undefined) { clauses.push("target_student_id=?"); params.push(f.targetStudentId); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return this.db
      .prepare(`SELECT * FROM games ${where} ORDER BY created_at DESC`)
      .all(...params) as GameRow[];
  }

  async updateGame(gameId: string, patch: GamePatch): Promise<void> {
    const cols = ["title", "visibility", "status", "target_student_id", "updated_at"] as const;
    const sets: string[] = [];
    const params: Record<string, unknown> = { game_id: gameId };
    for (const c of cols) {
      if (c in patch) { sets.push(`${c}=@${c}`); params[c] = (patch as Record<string, unknown>)[c]; }
    }
    if (!sets.length) return;
    this.db.prepare(`UPDATE games SET ${sets.join(",")} WHERE game_id=@game_id`).run(params);
  }

  async insertPlaySession(r: PlaySessionRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO play_sessions(session_id,game_id,player_id,score,completed,detail,started_at,ended_at)
         VALUES(@session_id,@game_id,@player_id,@score,@completed,@detail,@started_at,@ended_at)`,
      )
      .run(r);
  }

  async sessionsForPlayer(playerId: string): Promise<PlaySessionRow[]> {
    return this.db
      .prepare(`SELECT * FROM play_sessions WHERE player_id=? ORDER BY ended_at`)
      .all(playerId) as PlaySessionRow[];
  }

  async sessionsForGame(gameId: string): Promise<PlaySessionRow[]> {
    return this.db
      .prepare(`SELECT * FROM play_sessions WHERE game_id=? ORDER BY ended_at`)
      .all(gameId) as PlaySessionRow[];
  }
}

export function createSqliteStore(): Store {
  const path = process.env.SQLITE_PATH ?? "coolmathgames.db";
  return new SqliteStore(path);
}
