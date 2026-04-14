import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/main/index.ts",
      fileName: "main",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
  resolve: {
    conditions: ["node"],
  },
});
