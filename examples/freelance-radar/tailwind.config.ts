import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "../../packages/react/src/**/*.{ts,tsx}"],
} satisfies Config;
