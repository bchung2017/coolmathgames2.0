import { getStore } from "@/src/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/games — the author's generated-games list.
export async function GET() {
  const store = await getStore();
  return Response.json(await store.allGames());
}
