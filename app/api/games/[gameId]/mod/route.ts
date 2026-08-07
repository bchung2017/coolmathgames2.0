import { getStore } from "@/src/db/store";
import { DEMO } from "@/src/demo/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/games/:gameId/mod — fork a game (Catalog "Mod" action, §3.8).
 * Creates a NEW draft game owned by the demo tutor, with modded_from_id set to
 * the source and the source's instance_data copied as the starting point. The
 * source is never mutated — lineage is a self-FK on games, resolved by
 * Analytics' mods_spawned later.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const store = await getStore();
  const src = await store.getGame(gameId);
  if (!src) return new Response("not found", { status: 404 });

  const newId = crypto.randomUUID();
  const now = Date.now();
  await store.insertGame({
    game_id: newId,
    cartridge_id: src.cartridge_id,
    owner_id: DEMO.tutor.id,
    modded_from_id: src.game_id,
    title: `${src.title ?? src.topic} (mod)`,
    topic: src.topic,
    misconception: src.misconception,
    instance_data_json: src.instance_data_json, // copied starting point
    visibility: "private",
    status: "draft",
    target_student_id: null,
    schema_version_at_creation: src.schema_version_at_creation,
    created_at: now,
    updated_at: now,
  });
  return Response.json(await store.getGame(newId));
}
