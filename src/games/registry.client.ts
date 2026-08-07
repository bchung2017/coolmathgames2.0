import type { FormatEngine } from "./types";

/**
 * Client-side engine registry. Engines are loaded lazily (dynamic import) so a
 * play page only ships the one format it renders. Add a format by adding a
 * branch here plus its `engine.ts`.
 */
export async function loadEngine(formatId: string): Promise<FormatEngine | null> {
  switch (formatId) {
    case "balance-scale":
      return (await import("./balance-scale/engine")).balanceScaleEngine as FormatEngine;
    default:
      return null;
  }
}
