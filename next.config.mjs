/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native / node-only DB drivers out of the bundle — they're required at
  // runtime on the server, never traced into the client or edge bundles.
  serverExternalPackages: ["better-sqlite3", "pg"],
};

export default nextConfig;
