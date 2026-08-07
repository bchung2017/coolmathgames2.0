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
  if (await store.getGame("demo-balance-scale")) return;
  const cartridge = getCartridgeServer("balance-scale");
  if (!cartridge) return;
  const generated = cartridge.generate("2-step equations", "drops the sign on negatives");
  await store.insertGame({
    game_id: "demo-balance-scale",
    cartridge_id: cartridge.id,
    owner_id: DEMO.tutor.id,
    modded_from_id: null,
    title: "Tip The Scales!",
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
}
