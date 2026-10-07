import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Integration tests against the local Supabase stack (npm run db:start). */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
