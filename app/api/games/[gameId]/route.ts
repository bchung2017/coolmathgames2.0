import { getStore } from "@/src/db/store";
import type { GamePatch } from "@/src/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/games/:gameId — load a generated game (used by /play).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const store = await getStore();
  const row = await store.getGame(gameId);
  return row ? Response.json(row) : new Response("not found", { status: 404 });
}

/**
 * PATCH /api/games/:gameId — update the mutable fields of a game. Powers
 * Publish (status=published, visibility=public), Send-to-student
 * (status=sent_to_student + target_student_id), and rename (title). Ownership,
 * cartridge, and lineage are immutable and cannot be patched here.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    visibility?: string;
    status?: string;
    target_student_id?: string | null;
  };

  const patch: GamePatch = { updated_at: Date.now() };
  if (typeof body.title === "string") patch.title = body.title;
  if (body.visibility === "public" || body.visibility === "private") patch.visibility = body.visibility;
  if (body.status === "draft" || body.status === "published" || body.status === "sent_to_student")
    patch.status = body.status;
  if ("target_student_id" in body) patch.target_student_id = body.target_student_id ?? null;

  const store = await getStore();
  const existing = await store.getGame(gameId);
  if (!existing) return new Response("not found", { status: 404 });
  await store.updateGame(gameId, patch);
  return Response.json(await store.getGame(gameId));
}
