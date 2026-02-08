import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";
import { handleWebSocket } from "./websocket.ts";
import { mcpManager } from "./mcp.ts";

/**
 * Validates the Origin header for WebSocket upgrade requests.
 * Allows same-host connections and localhost variants.
 */
function isOriginAllowed(req: Request, hostname: string, port: number): boolean {
  const origin = req.headers.get("origin");
  // Allow requests with no origin (e.g. non-browser clients)
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;
    const originPort = originUrl.port || (originUrl.protocol === "https:" ? "443" : "80");

    // Allow localhost variants on any port (safe — already local)
    const localhosts = ["localhost", "127.0.0.1", "::1"];
    if (localhosts.includes(originHost)) {
      return true;
    }

    // Allow same hostname + port
    if (originHost === hostname && originPort === String(port)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Main entry point for Attaché
async function main() {
  const config = loadConfig();

  // Initialize MCP servers (each connection failure is isolated)
  if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
    console.log(`Connecting to ${Object.keys(config.mcpServers).length} MCP server(s)...`);
    await mcpManager.initialize(config.mcpServers);
  }

  console.log(`Starting ${config.assistant.name}...`);
  console.log(`Using model provider: ${config.models.default}`);

  // Create and start the server
  const app = createServer();
  const wsHandler = handleWebSocket(config);

  const server = Bun.serve({
    fetch(req, server) {
      // Handle WebSocket upgrade
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (!isOriginAllowed(req, config.server.host, config.server.port)) {
          console.warn(`WebSocket origin rejected: ${req.headers.get("origin")}`);
          return new Response("Forbidden: origin not allowed", { status: 403 });
        }

        const upgraded = server.upgrade(req, {
          data: {
            authenticated: false,
            clientId: crypto.randomUUID(),
          },
        });
        if (upgraded) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Handle regular HTTP requests
      return app.fetch(req, { env: {} });
    },
    websocket: wsHandler,
    port: config.server.port,
    hostname: config.server.host,
  });

  console.log(`\n✨ ${config.assistant.name} is ready!`);
  console.log(`Server running at http://${server.hostname}:${server.port}`);
  console.log(`WebSocket available at ws://${server.hostname}:${server.port}/ws`);
}

main().catch((error) => {
  console.error("Failed to start Attaché:", error);
  process.exit(1);
});
