import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/board.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  clean: true,
  external: ["bullmq", "express", "@bull-board/api", "@bull-board/express", "@flowpanel/core"],
});
