import { getStore } from "@/src/db/store";
import { ensureFormatsSeeded } from "@/src/games/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/formats/:formatId — Format detail screen.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ formatId: string }> },
) {
  const { formatId } = await params;
  const store = await getStore();
  await ensureFormatsSeeded(store);
  const row = await store.getFormat(formatId);
  return row ? Response.json(row) : new Response("not found", { status: 404 });
}
