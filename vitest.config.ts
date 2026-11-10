import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // next-auth imports "next/server" without an extension, which Node's ESM loader can't
    // resolve; letting Vite process it makes src/lib/auth.ts importable in tests
    server: { deps: { inline: ["next-auth"] } },
  },
})
