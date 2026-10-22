import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next.js, so tell vitest to use the automatic JSX runtime.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
