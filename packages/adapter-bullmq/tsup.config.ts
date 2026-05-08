import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  clean: true,
  external: ["bullmq", "express", "@bull-board/api", "@bull-board/express", "@flowpanel/core"],
});
