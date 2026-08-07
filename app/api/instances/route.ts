import { getStore } from "@/src/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/instances — the author's generated-instances list.
export async function GET() {
  const store = await getStore();
  return Response.json(await store.allInstances());
}
