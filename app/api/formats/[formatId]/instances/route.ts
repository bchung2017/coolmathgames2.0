import { getStore } from "@/src/db/store";
import { ensureFormatsSeeded, getFormatServer } from "@/src/games/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/formats/:formatId/instances — the Authoring / generate flow.
 *
 * This is the ONE route that isn't a store pass-through: it runs the engine
 * (fill the schema for topic + misconception, then VALIDATE) before storing.
 * It streams status text back so the Level Editor reads as a chat. Today the
 * fill is a deterministic stub; swapping in an LLM changes only format.generate.
 *
 * Protocol: plain-text status chunks, then a final `[[INSTANCE]]{json}` marker
 * carrying { instanceId, preview } for the client to turn into a Preview link.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ formatId: string }> },
) {
  const { formatId } = await params;
  const format = getFormatServer(formatId);
  if (!format) return new Response(`unknown format "${formatId}"`, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    misconception?: string;
  };
  const topic = body.topic?.trim() || "linear equations";
  const misconception = body.misconception?.trim() || null;

  const store = await getStore();
  await ensureFormatsSeeded(store);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        send(
          `Got it — targeting ${misconception ? `misconception "${misconception}"` : "the topic"}. `,
        );
        await sleep(280);
        send("Filling the balance-scale schema with items + distractors…\n");
        await sleep(320);

        const instance = format.generate(topic, misconception);
        const invalid = format.validate(instance);
        if (invalid) {
          // The quality gate: a bad fill never ships. (Stub is always valid.)
          send(`\nValidation failed (${invalid}) — regenerating would go here.\n`);
          controller.close();
          return;
        }

        const items = (instance as { items: unknown[] }).items;
        const preview = JSON.stringify(
          {
            format: formatId,
            topic,
            misconception: misconception ?? "(none)",
            items: items.length,
            ramp: (instance as { ramp: string }).ramp,
            status: "VALID ✓ schema ok",
          },
          null,
          2,
        );

        const instanceId = crypto.randomUUID();
        await store.insertInstance({
          instance_id: instanceId,
          format_id: formatId,
          topic,
          misconception,
          items: JSON.stringify(instance),
          created_at: Date.now(),
        });

        send("Level ready! Preview it, or tell me what to change.\n");
        send("[[INSTANCE]]" + JSON.stringify({ instanceId, preview }));
        controller.close();
      } catch (err) {
        send("\nError: " + (err as Error).message);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
