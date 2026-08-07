import type { CartridgeServer } from "./types";
import { balanceScale } from "./balance-scale/format";
import type { Store } from "../db/store";

/**
 * Server-side cartridge registry. Cartridges are DEFINED IN CODE (each is an
 * engine + generate/validate) — that's the accumulated design work, the moat.
 * The DB `cartridges` table is just a queryable projection of this registry,
 * seeded idempotently on first use.
 */
export const CARTRIDGES_SERVER: Record<string, CartridgeServer> = {
  [balanceScale.id]: balanceScale as CartridgeServer,
};

export function getCartridgeServer(id: string): CartridgeServer | null {
  return CARTRIDGES_SERVER[id] ?? null;
}

let seeded = false;

/** Upsert the code-defined cartridges into the store. Idempotent; runs once. */
export async function ensureCartridgesSeeded(store: Store): Promise<void> {
  if (seeded) return;
  for (const c of Object.values(CARTRIDGES_SERVER)) {
    await store.upsertCartridge({
      cartridge_id: c.id,
      name: c.name,
      slug: c.id,
      concept_class: c.conceptClass,
      author_id: null, // official seed cartridges have no User author yet
      schema_json: JSON.stringify(c.schemaJson),
      engine_bundle_url: null, // engine is in-app today (no compiled bundle yet)
      status: "published",
      schema_version: 1,
      created_at: 0, // stable seed timestamp (no Date.now at seed time)
      updated_at: 0,
    });
  }
  seeded = true;
}
