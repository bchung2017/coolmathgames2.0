import type { Metadata } from "next";
import { getStore } from "@/src/db/store";
import { getCartridgeServer } from "@/src/games/registry.server";
import { ensureDemoGamesSeeded } from "@/src/demo/seed";
import type { GameRow } from "@/src/db/store";
import GameCanvas from "./GameCanvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /play/:gameId — the anonymous, shareable player surface. Server-rendered so
 * the share link paints fast and can carry OG metadata; the canvas engine boots
 * client-side (GameCanvas).
 */

// Stable demo game so the Arcade "Play!" links work without generating one.
async function loadGame(gameId: string): Promise<GameRow | null> {
  const store = await getStore();
  if (gameId === "demo-balance-scale") await ensureDemoGamesSeeded(store);
  let game = await store.getGame(gameId);
  if (!game && gameId.startsWith("demo-")) {
    // Other demo-* ids: mint an ad-hoc public demo on first visit.
    const cartridge = getCartridgeServer("balance-scale")!;
    const generated = cartridge.generate("2-step equations", "drops the sign on negatives");
    await store.insertGame({
      game_id: gameId,
      cartridge_id: cartridge.id,
      owner_id: null,
      modded_from_id: null,
      title: "2-step equations",
      topic: "2-step equations",
      misconception: "drops the sign on negatives",
      instance_data_json: JSON.stringify(generated),
      visibility: "public",
      status: "published",
      target_student_id: null,
      schema_version_at_creation: 1,
      created_at: 0,
      updated_at: 0,
    });
    game = await store.getGame(gameId);
  }
  return game;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameId: string }>;
}): Promise<Metadata> {
  const { gameId } = await params;
  const game = await loadGame(gameId);
  const title = game ? `Play: ${game.topic}` : "Play";
  return {
    title: `${title} — coolmathgames 2.0`,
    description: game?.misconception
      ? `A balance-scale level made to untangle: ${game.misconception}`
      : "A quick math minigame.",
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = await loadGame(gameId);

  if (!game) {
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

  const instance = JSON.parse(game.instance_data_json);

  return (
    <div className="play-wrap">
      <p className="section-head">{game.topic}</p>
      <GameCanvas gameId={game.game_id} cartridgeId={game.cartridge_id} instance={instance} />
    </div>
  );
}
