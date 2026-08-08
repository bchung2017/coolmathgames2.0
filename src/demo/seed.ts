import type { Store } from "../db/store";
import { getCartridgeServer } from "../games/registry.server";
import { DEMO } from "./identity";

/**
 * Ensure a published, public demo game exists so the Arcade has something to
 * show on a fresh database (and the Arcade "Play!" links resolve). Owned by the
 * demo tutor so it also appears under Catalog → Mine for the tutor demo.
 * Idempotent — guarded on the stable id.
 */
export async function ensureDemoGamesSeeded(store: Store): Promise<void> {
  if (await store.getGame("demo-number-line")) return;
  const cartridge = getCartridgeServer("number-line");
  if (!cartridge) return;
  const generated = cartridge.generate(
    "comparing negative integers",
    "−5 > −2 because 5 > 2 (orders by magnitude, not position)",
  );
  await store.insertGame({
    game_id: "demo-number-line",
    cartridge_id: cartridge.id,
    owner_id: DEMO.tutor.id,
    modded_from_id: null,
    title: "Walk The Line!",
    topic: "comparing negative integers",
    misconception: "−5 > −2 because 5 > 2 (orders by magnitude, not position)",
    instance_data_json: JSON.stringify(generated),
    visibility: "public",
    status: "published",
    target_student_id: null,
    schema_version_at_creation: 1,
    created_at: 0,
    updated_at: 0,
  });
}
