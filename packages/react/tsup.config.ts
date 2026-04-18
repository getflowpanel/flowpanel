import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom"],
  onSuccess: async () => {
    mkdirSync("dist/theme", { recursive: true });
    copyFileSync("src/theme/variables.css", "dist/theme/variables.css");
  },
});
