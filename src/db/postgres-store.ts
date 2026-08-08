import { Pool, types } from "pg";
import { pgSchema } from "./schema-name";
import { schemaSql } from "./schema-sql";
import type { Store, CartridgeRow, GameRow, PlaySessionRow, GameFilter, GamePatch } from "./store";

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

  async upsertCartridge(r: CartridgeRow): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO cartridges(cartridge_id,name,slug,concept_class,author_id,schema_json,engine_bundle_url,status,schema_version,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT(cartridge_id) DO UPDATE SET
         name=excluded.name,
         slug=excluded.slug,
         concept_class=excluded.concept_class,
         schema_json=excluded.schema_json,
         engine_bundle_url=excluded.engine_bundle_url,
         status=excluded.status,
         schema_version=excluded.schema_version,
         updated_at=excluded.updated_at`,
      [r.cartridge_id, r.name, r.slug, r.concept_class, r.author_id, r.schema_json, r.engine_bundle_url, r.status, r.schema_version, r.created_at, r.updated_at],
    );
  }

  async getCartridge(cartridgeId: string): Promise<CartridgeRow | null> {
    await this.ready;
    const res = await this.pool.query<CartridgeRow>(
      `SELECT * FROM cartridges WHERE cartridge_id=$1`,
      [cartridgeId],
    );
    return res.rows[0] ?? null;
  }

  async allCartridges(): Promise<CartridgeRow[]> {
    await this.ready;
    const res = await this.pool.query<CartridgeRow>(
      `SELECT * FROM cartridges ORDER BY created_at`,
    );
    return res.rows;
  }

  async insertGame(r: GameRow): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO games(game_id,cartridge_id,owner_id,modded_from_id,title,topic,misconception,instance_data_json,visibility,status,target_student_id,schema_version_at_creation,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [r.game_id, r.cartridge_id, r.owner_id, r.modded_from_id, r.title, r.topic, r.misconception, r.instance_data_json, r.visibility, r.status, r.target_student_id, r.schema_version_at_creation, r.created_at, r.updated_at],
    );
  }

  async getGame(gameId: string): Promise<GameRow | null> {
    await this.ready;
    const res = await this.pool.query<GameRow>(
      `SELECT * FROM games WHERE game_id=$1`,
      [gameId],
    );
    return res.rows[0] ?? null;
  }

  async allGames(): Promise<GameRow[]> {
    await this.ready;
    const res = await this.pool.query<GameRow>(
      `SELECT * FROM games ORDER BY created_at DESC`,
    );
    return res.rows;
  }

  async gamesByCartridge(cartridgeId: string): Promise<GameRow[]> {
    await this.ready;
    const res = await this.pool.query<GameRow>(
      `SELECT * FROM games WHERE cartridge_id=$1 ORDER BY created_at`,
      [cartridgeId],
    );
    return res.rows;
  }

  async queryGames(f: GameFilter): Promise<GameRow[]> {
    await this.ready;
    const clauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (f.ownerId !== undefined) { clauses.push(`owner_id=$${i++}`); params.push(f.ownerId); }
    if (f.cartridgeId !== undefined) { clauses.push(`cartridge_id=$${i++}`); params.push(f.cartridgeId); }
    if (f.visibility !== undefined) { clauses.push(`visibility=$${i++}`); params.push(f.visibility); }
    if (f.status !== undefined) { clauses.push(`status=$${i++}`); params.push(f.status); }
    if (f.targetStudentId !== undefined) { clauses.push(`target_student_id=$${i++}`); params.push(f.targetStudentId); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const res = await this.pool.query<GameRow>(
      `SELECT * FROM games ${where} ORDER BY created_at DESC`,
      params,
    );
    return res.rows;
  }

  async updateGame(gameId: string, patch: GamePatch): Promise<void> {
    await this.ready;
    const cols = ["title", "visibility", "status", "target_student_id", "updated_at"] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const c of cols) {
      if (c in patch) { sets.push(`${c}=$${i++}`); params.push((patch as Record<string, unknown>)[c]); }
    }
    if (!sets.length) return;
    params.push(gameId);
    await this.pool.query(`UPDATE games SET ${sets.join(",")} WHERE game_id=$${i}`, params);
  }

  async deleteGame(gameId: string): Promise<number> {
    await this.ready;
    // Detach mods, drop play sessions, then the game — one transaction, one conn.
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE games SET modded_from_id=NULL WHERE modded_from_id=$1`, [gameId]);
      await client.query(`DELETE FROM play_sessions WHERE game_id=$1`, [gameId]);
      const res = await client.query(`DELETE FROM games WHERE game_id=$1`, [gameId]);
      await client.query("COMMIT");
      return res.rowCount ?? 0;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async insertPlaySession(r: PlaySessionRow): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO play_sessions(session_id,game_id,player_id,score,completed,detail,started_at,ended_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [r.session_id, r.game_id, r.player_id, r.score, r.completed, r.detail, r.started_at, r.ended_at],
    );
  }

  async sessionsForPlayer(playerId: string): Promise<PlaySessionRow[]> {
    await this.ready;
    const res = await this.pool.query<PlaySessionRow>(
      `SELECT * FROM play_sessions WHERE player_id=$1 ORDER BY ended_at`,
      [playerId],
    );
    return res.rows;
  }

  async sessionsForGame(gameId: string): Promise<PlaySessionRow[]> {
    await this.ready;
    const res = await this.pool.query<PlaySessionRow>(
      `SELECT * FROM play_sessions WHERE game_id=$1 ORDER BY ended_at`,
      [gameId],
    );
    return res.rows;
  }
}

export function createPostgresStore(): Store {
  return new PostgresStore();
}
