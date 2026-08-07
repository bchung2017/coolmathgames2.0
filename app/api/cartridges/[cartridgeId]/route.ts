import { getStore } from "@/src/db/store";
import { ensureCartridgesSeeded } from "@/src/games/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cartridges/:cartridgeId — cartridge detail.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cartridgeId: string }> },
) {
  const { cartridgeId } = await params;
  const store = await getStore();
  await ensureCartridgesSeeded(store);
  const row = await store.getCartridge(cartridgeId);
  return row ? Response.json(row) : new Response("not found", { status: 404 });
}
