import { getStore } from "@/src/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/instances/:instanceId — load a generated instance (used by /play).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await params;
  const store = await getStore();
  const row = await store.getInstance(instanceId);
  return row ? Response.json(row) : new Response("not found", { status: 404 });
}
