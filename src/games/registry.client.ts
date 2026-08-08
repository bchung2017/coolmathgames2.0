import type { CartridgeEngine } from "./types";

/**
 * Client-side engine registry. Engines are loaded lazily (dynamic import) so a
 * play page only ships the one cartridge it renders. Add a cartridge by adding
 * a branch here plus its `engine.ts`.
 */
export async function loadEngine(cartridgeId: string): Promise<CartridgeEngine | null> {
  switch (cartridgeId) {
    case "number-line":
      return (await import("./number-line/engine")).numberLineEngine as CartridgeEngine;
    default:
      return null;
  }
}
