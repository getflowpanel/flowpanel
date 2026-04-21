import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    tailwind: "src/tailwind.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom"],
  onSuccess: async () => {
    mkdirSync("dist/theme", { recursive: true });
    copyFileSync("src/theme/variables.css", "dist/theme/variables.css");
    mkdirSync("dist/styles", { recursive: true });
    copyFileSync("src/styles/tokens.css", "dist/styles/tokens.css");
  },
});
