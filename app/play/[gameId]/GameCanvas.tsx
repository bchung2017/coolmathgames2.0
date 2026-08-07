"use client";

import { useEffect, useRef, useState } from "react";
import { loadEngine } from "@/src/games/registry.client";
import type { PlayResult } from "@/src/games/types";

/**
 * Client mount point for a cartridge engine. React owns nothing about the game —
 * it hands the engine a <div> and the validated instance, and reports the
 * PlaySession back to the store when the engine finishes.
 */
export default function GameCanvas({
  gameId,
  cartridgeId,
  instance,
}: {
  gameId: string;
  cartridgeId: string;
  instance: unknown;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let teardown: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const engine = await loadEngine(cartridgeId);
      if (!engine) {
        setError(`No engine for cartridge "${cartridgeId}"`);
        return;
      }
      if (cancelled || !hostRef.current) return;
      teardown = engine.mount(hostRef.current, instance, async (r) => {
        setResult(r);
        // Anon play: player_id stays null (§5). A logged-in Student player_id
        // would come from the JWT / share link once auth lands.
        await fetch(`/api/games/${gameId}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ player_id: null, score: r.score, completed: true, detail: r.detail }),
        }).catch(() => {});
      });
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [gameId, cartridgeId, instance]);

  if (error) return <p className="mod red">{error}</p>;

  return (
    <div>
      <div className="play-stage" ref={hostRef} hidden={!!result} />
      {result && (
        <div>
          <p className="play-done">
            Nice! You balanced {result.score} of {result.total}.
          </p>
          <p style={{ marginTop: 12 }}>
            <a className="btn" href="/">
              Back to Arcade
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
