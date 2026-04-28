import type { CreateTRPCReact } from "@trpc/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/app/api/trpc/[trpc]/route";

// Explicit annotation avoids TS2742 under strict mode — tRPC's inferred
// type references an internal module name that isn't portable across
// project roots.
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();
