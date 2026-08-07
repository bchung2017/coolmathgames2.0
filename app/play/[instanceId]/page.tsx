import type { Metadata } from "next";
import { getStore } from "@/src/db/store";
import { getFormatServer } from "@/src/games/registry.server";
import type { InstanceRow } from "@/src/db/store";
import GameCanvas from "./GameCanvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /play/:instanceId — the anonymous, shareable player surface. Server-rendered
 * so the share link paints fast and can carry OG metadata; the canvas engine
 * boots client-side (GameCanvas).
 */

// Stable demo instance so the Arcade "Play!" links work without generating one.
async function loadInstance(instanceId: string): Promise<InstanceRow | null> {
  const store = await getStore();
  let inst = await store.getInstance(instanceId);
  if (!inst && instanceId.startsWith("demo-")) {
    const fmt = getFormatServer("balance-scale")!;
    const generated = fmt.generate("2-step equations", "drops the sign on negatives");
    await store.insertInstance({
      instance_id: instanceId,
      format_id: fmt.id,
      topic: "2-step equations",
      misconception: "drops the sign on negatives",
      items: JSON.stringify(generated),
      created_at: Date.now(),
    });
    inst = await store.getInstance(instanceId);
  }
  return inst;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}): Promise<Metadata> {
  const { instanceId } = await params;
  const inst = await loadInstance(instanceId);
  const title = inst ? `Play: ${inst.topic}` : "Play";
  return {
    title: `${title} — coolmathgames 2.0`,
    description: inst?.misconception
      ? `A balance-scale level made to untangle: ${inst.misconception}`
      : "A quick math minigame.",
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const inst = await loadInstance(instanceId);

  if (!inst) {
    return (
      <div className="play-wrap">
        <h1 className="wordmark" style={{ fontSize: 32 }}>
          Not found
        </h1>
        <p>That level doesn&apos;t exist (or hasn&apos;t been generated yet).</p>
        <p style={{ marginTop: 12 }}>
          <a className="btn" href="/">
            Back to Arcade
          </a>
        </p>
      </div>
    );
  }

  const instance = JSON.parse(inst.items);

  return (
    <div className="play-wrap">
      <p className="section-head">{inst.topic}</p>
      <GameCanvas instanceId={inst.instance_id} formatId={inst.format_id} instance={instance} />
    </div>
  );
}
