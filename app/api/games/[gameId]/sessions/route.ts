import { getStore } from "@/src/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/games/:gameId/sessions — play outcomes for a game.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const store = await getStore();
  return Response.json(await store.sessionsForGame(gameId));
}

// POST /api/games/:gameId/sessions — record a play-through (from /play).
// player_id is null for anon plays (§5) — no magic "anon" string.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    player_id?: string | null;
    score?: number;
    completed?: boolean;
    detail?: unknown;
    started_at?: number | null;
  };
  const store = await getStore();
  const playerId = body.player_id?.trim() ? body.player_id.trim() : null;
  await store.insertPlaySession({
    session_id: crypto.randomUUID(),
    game_id: gameId,
    player_id: playerId,
    score: Number(body.score ?? 0),
    completed: body.completed ? 1 : 0,
    detail: body.detail == null ? null : JSON.stringify(body.detail),
    started_at: body.started_at ?? null,
    ended_at: Date.now(),
  });
  return Response.json({ ok: true });
}
