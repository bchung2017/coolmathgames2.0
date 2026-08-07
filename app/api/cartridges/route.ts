import { getStore } from "@/src/db/store";
import { ensureCartridgesSeeded } from "@/src/games/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cartridges — the mechanic library (cartridge gallery).
export async function GET() {
  const store = await getStore();
  await ensureCartridgesSeeded(store);
  return Response.json(await store.allCartridges());
}
