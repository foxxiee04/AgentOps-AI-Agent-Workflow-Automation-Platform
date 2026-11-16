import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig uses `jsx: preserve` for Next.js; tests need the automatic React runtime instead.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node"
  }
});
