/**
 * SSE stream route for FlowPanel realtime.
 *
 * This MUST be a separate route from tRPC — the tRPC fetch adapter
 * JSON-wraps every response, which breaks the text/event-stream content type.
 *
 * The handler authenticates via config.security.auth.getSession(req),
 * fans out resource events from the broker, and ships heartbeats so
 * idle proxies (Vercel, Cloudflare) don't close the connection.
 */

import { createFlowPanelStreamHandler } from "@flowpanel/core";
import { flowpanel } from "@/src/flowpanel";

export const { GET } = createFlowPanelStreamHandler(flowpanel);

// SSE is incompatible with static generation and with the Edge runtime's
// streaming model (also: the pg `listen:` hook needs the Node runtime).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
