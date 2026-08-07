import type { FormatServer } from "./types";
import { balanceScale } from "./balance-scale/format";
import type { Store } from "../db/store";

/**
 * Server-side format registry. Formats are DEFINED IN CODE (each is an engine +
 * generate/validate) — that's the accumulated design work, the moat. The DB
 * `formats` table is just a queryable projection of this registry, seeded
 * idempotently on first use.
 */
export const FORMATS_SERVER: Record<string, FormatServer> = {
  [balanceScale.id]: balanceScale as FormatServer,
};

export function getFormatServer(id: string): FormatServer | null {
  return FORMATS_SERVER[id] ?? null;
}

let seeded = false;

/** Upsert the code-defined formats into the store. Idempotent; runs once. */
export async function ensureFormatsSeeded(store: Store): Promise<void> {
  if (seeded) return;
  for (const f of Object.values(FORMATS_SERVER)) {
    await store.upsertFormat({
      format_id: f.id,
      name: f.name,
      concept_class: f.conceptClass,
      spec: JSON.stringify(f.spec),
      created_at: 0, // stable seed timestamp (no Date.now at seed time)
    });
  }
  seeded = true;
}
