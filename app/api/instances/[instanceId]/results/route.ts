import { getStore } from "@/src/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/instances/:instanceId/results — outcomes (Instance detail screen).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await params;
  const store = await getStore();
  return Response.json(await store.resultsForInstance(instanceId));
}

// POST /api/instances/:instanceId/results — record a play-through (from /play).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    student_id?: string;
    score?: number;
    detail?: unknown;
  };
  const store = await getStore();
  await store.insertResult({
    result_id: crypto.randomUUID(),
    instance_id: instanceId,
    student_id: body.student_id?.trim() || "anon",
    score: Number(body.score ?? 0),
    detail: body.detail == null ? null : JSON.stringify(body.detail),
    played_at: Date.now(),
  });
  return Response.json({ ok: true });
}
