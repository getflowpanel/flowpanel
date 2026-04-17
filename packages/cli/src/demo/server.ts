import * as fs from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createSSESimulation, handleTrpcRequest } from "./mock-router";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function serveDemoPanel(
  res: import("node:http").ServerResponse,
  config: Record<string, unknown>,
): void {
  const templatePath = path.join(__dirname, "panel", "template.html");
  let html: string;

  try {
    html = fs.readFileSync(templatePath, "utf8");
  } catch {
    html = `<!DOCTYPE html><html><body><pre>Demo panel not built. Run: pnpm build</pre></body></html>`;
  }

  html = html.replace("__CONFIG_JSON__", JSON.stringify(config));
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

function serveStaticAsset(
  res: import("node:http").ServerResponse,
  filePath: string,
  contentType: string,
): void {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

export function startDemoServer(
  port: number,
  demoConfig: Record<string, unknown>,
): Promise<{ close: () => void }> {
  const sse = createSSESimulation();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Static assets for demo panel
    if (pathname === "/__fp/panel.js") {
      serveStaticAsset(res, path.join(__dirname, "..", "demo-panel.js"), "application/javascript");
      return;
    }

    if (pathname === "/__fp/theme.css") {
      const reactDist = path.join(__dirname, "..", "..", "react", "dist");
      serveStaticAsset(res, path.join(reactDist, "theme", "variables.css"), "text/css");
      return;
    }

    if (pathname === "/__fp/styles.css") {
      const reactDist = path.join(__dirname, "..", "..", "react", "dist");
      serveStaticAsset(res, path.join(reactDist, "styles.css"), "text/css");
      return;
    }

    if (url.pathname.includes("stream.connect")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const interval = setInterval(() => {
        const event = sse.generateEvent();
        res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }, 3000);
      req.on("close", () => clearInterval(interval));
      return;
    }

    if (url.pathname.startsWith("/api/trpc/")) {
      const inputRaw = url.searchParams.get("input");
      let input: Record<string, unknown> = {};
      if (inputRaw) {
        try {
          input = JSON.parse(decodeURIComponent(inputRaw)) as Record<string, unknown>;
        } catch {
          input = {};
        }
      }
      const result = handleTrpcRequest(url.pathname, input);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === "/" || pathname === "/admin") {
      serveDemoPanel(res, demoConfig);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ close: () => server.close() });
    });
  });
}
