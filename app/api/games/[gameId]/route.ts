import { getStore } from "@/src/db/store";

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
