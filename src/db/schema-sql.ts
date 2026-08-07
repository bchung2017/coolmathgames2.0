import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The DDL from schema.sql — the single source of truth shared by both backends
 * and the migration script. Read from disk so there is one place to change a
 * table definition.
 */
export function schemaSql(): string {
  return readFileSync(join(here, "schema.sql"), "utf8");
}
