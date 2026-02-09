import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";
import { handleWebSocket } from "./websocket.ts";
import { mcpManager } from "./mcp.ts";
import { resumeRunningAgents } from "./agent.ts";

// Main entry point for Attaché
export async function startServer() {
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
        const upgradeHeader = req.headers.get("upgrade");
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
          console.warn("WebSocket upgrade rejected: missing or invalid Upgrade header:", upgradeHeader);
          return new Response("WebSocket upgrade required", { status: 426 });
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
        console.error("WebSocket server.upgrade() returned false despite valid headers");
        return new Response("WebSocket upgrade failed", { status: 500 });
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

  // Resume any agents that were running before the server stopped
  resumeRunningAgents(config).catch(err => {
    console.error("Failed to resume agents:", err);
  });
}

// Only auto-start when run directly (not when imported by CLI)
if (import.meta.main) {
  startServer().catch((error: unknown) => {
    console.error("Failed to start Attaché:", error);
    process.exit(1);
  });
}
