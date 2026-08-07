import { getStore } from "@/src/db/store";
import type { GameFilter, GameRow } from "@/src/db/store";
import { ensureCartridgesSeeded } from "@/src/games/registry.server";
import { ensureDemoGamesSeeded } from "@/src/demo/seed";
import { DEMO } from "@/src/demo/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/games — the games list, filtered + enriched. Backs the Arcade and
 * the Catalog (Mine / Marketplace). Query params:
 *   owner_id, visibility, status, target_student_id, cartridge_id  — AND filters
 *   arcade=student  — the Student arcade: public+published UNION games targeted
 *                     at the student (FOR YOU! cards), deduped.
 * Each row is enriched with cartridge_name + cartridge_author_id (the join the
 * "fmt:" and "cartridge by:" credit lines need — kept distinct from owner_id).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const store = await getStore();
  await ensureCartridgesSeeded(store);
  await ensureDemoGamesSeeded(store);

  let games: GameRow[];
  if (q.get("arcade") === "student") {
    const sid = q.get("student_id") ?? DEMO.student.id;
    const published = await store.queryGames({ visibility: "public", status: "published" });
    const targeted = await store.queryGames({ targetStudentId: sid });
    const seen = new Set<string>();
    games = [...targeted, ...published].filter((g) =>
      seen.has(g.game_id) ? false : (seen.add(g.game_id), true),
    );
  } else {
    const filter: GameFilter = {};
    const owner = q.get("owner_id");
    const visibility = q.get("visibility");
    const status = q.get("status");
    const target = q.get("target_student_id");
    const cartridge = q.get("cartridge_id");
    if (owner !== null) filter.ownerId = owner;
    if (visibility !== null) filter.visibility = visibility;
    if (status !== null) filter.status = status;
    if (target !== null) filter.targetStudentId = target;
    if (cartridge !== null) filter.cartridgeId = cartridge;
    games = await store.queryGames(filter);
  }

  const cartridges = await store.allCartridges();
  const byId = new Map(cartridges.map((c) => [c.cartridge_id, c]));
  const enriched = games.map((g) => ({
    ...g,
    cartridge_name: byId.get(g.cartridge_id)?.name ?? g.cartridge_id,
    cartridge_author_id: byId.get(g.cartridge_id)?.author_id ?? null,
  }));
  return Response.json(enriched);
}
