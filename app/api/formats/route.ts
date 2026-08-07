import { getStore } from "@/src/db/store";
import { ensureFormatsSeeded } from "@/src/games/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/formats — the mechanic library (Format gallery screen).
export async function GET() {
  const store = await getStore();
  await ensureFormatsSeeded(store);
  return Response.json(await store.allFormats());
}
