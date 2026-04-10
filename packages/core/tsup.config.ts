import { defineConfig } from "tsup";

export default defineConfig({
	entry: { index: "src/index.ts", "trpc/index": "src/trpc/index.ts" },
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	splitting: false,
});
