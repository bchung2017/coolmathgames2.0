/**
 * The Postgres schema (namespace) this app's tables live in.
 *
 * The value is interpolated into DDL and into the libpq connection `options`
 * string — places where bind parameters ($1) don't reach — so an unvalidated
 * value is a SQL-injection vector. Accept ONLY a bare SQL identifier; throw
 * loudly otherwise.
 *
 * Defaulting to `public` makes isolation opt-in: unset DB_SCHEMA -> the app
 * behaves exactly like an ordinary single-tenant app.
 */
export function pgSchema(): string {
  const s = process.env.DB_SCHEMA ?? "public";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(
      `Invalid DB_SCHEMA "${s}" — must be a bare SQL identifier ([A-Za-z_][A-Za-z0-9_]*).`,
    );
  }
  return s;
}
