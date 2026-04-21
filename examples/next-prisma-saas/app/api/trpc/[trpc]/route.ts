import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { flowpanel } from "@/src/flowpanel";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: (flowpanel as any).router,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
