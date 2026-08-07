"use client";

import { useEffect, useRef, useState } from "react";
import { loadEngine } from "@/src/games/registry.client";
import type { PlayResult } from "@/src/games/types";

/**
 * Client mount point for a format engine. React owns nothing about the game —
 * it hands the engine a <div> and the validated instance, and reports the
 * result back to the store when the engine finishes.
 */
export default function GameCanvas({
  instanceId,
  formatId,
  instance,
}: {
  instanceId: string;
  formatId: string;
  instance: unknown;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let teardown: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const engine = await loadEngine(formatId);
      if (!engine) {
        setError(`No engine for format "${formatId}"`);
        return;
      }
      if (cancelled || !hostRef.current) return;
      teardown = engine.mount(hostRef.current, instance, async (r) => {
        setResult(r);
        // student_id would come from the share link / first-run prompt (see UX doc).
        await fetch(`/api/instances/${instanceId}/results`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ student_id: "demo-player", score: r.score, detail: r.detail }),
        }).catch(() => {});
      });
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [instanceId, formatId, instance]);

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
