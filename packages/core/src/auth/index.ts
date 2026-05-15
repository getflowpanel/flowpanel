// Pure auth-helper surface — no node:* imports. Safe to bundle into client code.
//
// First-class auth integrations for the most common Next.js providers.
// Each helper returns an AuthConfig that drops directly into defineAdmin.
//
//   import { withClerk, withNextAuth, withLucia } from "@flowpanel/core/auth";
//   import { withClerk } from "flowpanel/auth";   // umbrella re-export
//
// All three are isomorphic — they don't import their underlying SDK at
// module load. The SDK loads lazily inside `session()`, so consumers who
// don't use a given provider pay zero bundle cost.

export { withClerk, type ClerkAuthOptions } from "./clerk.js";
export { withLucia, type LuciaAuthOptions, type LuciaLike } from "./lucia.js";
export { withNextAuth, type NextAuthOptions } from "./nextauth.js";
