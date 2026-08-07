import { getStore } from "@/src/db/store";
import { pgSchema } from "@/src/db/schema-name";
import { ensureFormatsSeeded } from "@/src/games/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — a real connectivity + isolation probe.
 *
 * Reports which backend the RUNNING server actually chose (the thing you want
 * to confirm after wiring DATABASE_URL on Render) and, on Postgres, which schema
 * it's namespaced into. It runs a live query (seed + count) so a bad connection
 * string or wrong pooler surfaces here as ok:false instead of silently falling
 * back. Exposes no secrets.
 */
export async function GET() {
  const usingPg = !!process.env.DATABASE_URL;
  try {
    const store = await getStore();
    await ensureFormatsSeeded(store); // exercises write…
    const formats = await store.allFormats(); // …and read
    return Response.json({
      ok: true,
      backend: store.backend, // "postgres" once DATABASE_URL is set, else "sqlite"
      schema: usingPg ? pgSchema() : null,
      formats: formats.length,
    });
  } catch (e) {
    return Response.json(
      { ok: false, backend: usingPg ? "postgres" : "sqlite", error: (e as Error).message },
      { status: 500 },
    );
  }
}
