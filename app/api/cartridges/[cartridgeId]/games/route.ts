import { getStore } from "@/src/db/store";
import { ensureCartridgesSeeded, getCartridgeServer } from "@/src/games/registry.server";
import { DEMO } from "@/src/demo/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/cartridges/:cartridgeId/games — the Authoring / generate flow.
 *
 * This is the ONE route that isn't a store pass-through: it runs the engine
 * (fill the schema for topic + misconception, then VALIDATE) before storing a
 * draft Game. It streams status text back so the Level Editor reads as a chat.
 * Today the fill is a deterministic stub; swapping in the LLM (TECH_SPEC.md
 * §3.6, §4.2) changes only cartridge.generate.
 *
 * Protocol: plain-text status chunks, then a final `[[INSTANCE]]{json}` marker
 * carrying { gameId, preview } for the client to turn into a Preview link.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cartridgeId: string }> },
) {
  const { cartridgeId } = await params;
  const cartridge = getCartridgeServer(cartridgeId);
  if (!cartridge) return new Response(`unknown cartridge "${cartridgeId}"`, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    misconception?: string;
  };
  const topic = body.topic?.trim() || "linear equations";
  const misconception = body.misconception?.trim() || null;

  const store = await getStore();
  await ensureCartridgesSeeded(store);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        send(
          `Got it — targeting ${misconception ? `misconception "${misconception}"` : "the topic"}. `,
        );
        await sleep(280);
        send(`Filling the ${cartridgeId} schema with items + distractors…\n`);
        await sleep(320);

        const instance = cartridge.generate(topic, misconception);
        const invalid = cartridge.validate(instance);
        if (invalid) {
          // The quality gate: a bad fill never ships. (Stub is always valid.)
          send(`\nValidation failed (${invalid}) — regenerating would go here.\n`);
          controller.close();
          return;
        }

        const items = (instance as { items: unknown[] }).items;
        const preview = JSON.stringify(
          {
            cartridge: cartridgeId,
            topic,
            misconception: misconception ?? "(none)",
            items: items.length,
            ramp: (instance as { ramp: string }).ramp,
            status: "VALID ✓ schema ok",
          },
          null,
          2,
        );

        const gameId = crypto.randomUUID();
        const now = Date.now();
        await store.insertGame({
          game_id: gameId,
          cartridge_id: cartridgeId,
          owner_id: DEMO.tutor.id, // the Editor is tutor-only; demo tutor owns it
          modded_from_id: null,
          title: topic,
          topic,
          misconception,
          instance_data_json: JSON.stringify(instance),
          visibility: "private",
          status: "draft",
          target_student_id: null,
          schema_version_at_creation: 1,
          created_at: now,
          updated_at: now,
        });

        send("Level ready! Preview it, or tell me what to change.\n");
        send("[[INSTANCE]]" + JSON.stringify({ gameId, preview }));
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
