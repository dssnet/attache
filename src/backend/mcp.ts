import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool, jsonSchema } from "ai";
import type { ToolRegistry } from "./tools.ts";
import type { McpServerConfig, McpOAuthConfig } from "./config.ts";

interface McpToolDefinition {
  serverName: string;
  name: string;
  qualifiedName: string;
  description: string;
  inputSchema: Record<string, any>;
}

interface McpConnection {
  name: string;
  config: McpServerConfig;
  client: Client;
  transport: any;
  tools: McpToolDefinition[];
  status: "connecting" | "connected" | "error" | "disconnected";
  error?: string;
}

interface OAuthToken {
  accessToken: string;
  expiresAt: number;
}

const CONNECTION_TIMEOUT = 15000;

/**
 * Fetches an OAuth access token using client credentials flow
 */
async function fetchOAuthToken(oauth: McpOAuthConfig): Promise<OAuthToken> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
  });
  if (oauth.scopes?.length) {
    params.set("scope", oauth.scopes.join(" "));
  }

  const response = await fetch(oauth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

class McpManager {
  private connections: Map<string, McpConnection> = new Map();
  private oauthTokens: Map<string, OAuthToken> = new Map();

  async initialize(servers: Record<string, McpServerConfig>): Promise<void> {
    const connectPromises = Object.entries(servers).map(([name, config]) =>
      this.connectServer(name, config).catch((error) => {
        console.error(`MCP server "${name}" failed to initialize:`, error.message);
      })
    );
    await Promise.all(connectPromises);
  }

  async connectServer(name: string, config: McpServerConfig): Promise<void> {
    // Disconnect existing connection if any
    if (this.connections.has(name)) {
      await this.disconnectServer(name);
    }

    const connection: McpConnection = {
      name,
      config,
      client: null as any,
      transport: null as any,
      tools: [],
      status: "connecting",
    };
    this.connections.set(name, connection);

    try {
      let transport: any;

      if (config.type === "stdio") {
        transport = new StdioClientTransport({
          command: config.command!,
          args: config.args || [],
          env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
        });
      } else {
        // SSE type: build request headers
        const headers: Record<string, string> = { ...config.headers };

        // Handle OAuth - fetch token and add to headers
        if (config.oauth) {
          let token = this.oauthTokens.get(name);
          if (!token || token.expiresAt < Date.now() + 60000) {
            token = await fetchOAuthToken(config.oauth);
            this.oauthTokens.set(name, token);
          }
          headers["Authorization"] = `Bearer ${token.accessToken}`;
        }

        const requestInit: RequestInit = {};
        if (Object.keys(headers).length > 0) {
          requestInit.headers = headers;
        }

        // Try Streamable HTTP first, fall back to SSE
        try {
          transport = new StreamableHTTPClientTransport(
            new URL(config.url!),
            Object.keys(requestInit).length > 0 ? { requestInit } : undefined,
          );
          // Test connection with a temporary client
          const testClient = new Client(
            { name: "attache", version: "0.1.0" },
            { capabilities: {} },
          );
          await Promise.race([
            testClient.connect(transport),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Connection timeout")), CONNECTION_TIMEOUT)
            ),
          ]);
          // Streamable HTTP worked, use this client
          connection.client = testClient;
          connection.transport = transport;
        } catch (streamableError: any) {
          // If we get a 4xx error, try legacy SSE
          const is4xx = streamableError?.code >= 400 && streamableError?.code < 500;
          const isTimeout = streamableError?.message?.includes("timeout");
          if (!is4xx && !isTimeout) {
            // Try SSE as fallback for any other error
          }

          try {
            // Close the failed transport
            try { await transport?.close?.(); } catch {}

            transport = new SSEClientTransport(
              new URL(config.url!),
              Object.keys(requestInit).length > 0 ? { requestInit } : undefined,
            );
            const sseClient = new Client(
              { name: "attache", version: "0.1.0" },
              { capabilities: {} },
            );
            await Promise.race([
              sseClient.connect(transport),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Connection timeout")), CONNECTION_TIMEOUT)
              ),
            ]);
            connection.client = sseClient;
            connection.transport = transport;
          } catch (sseError: any) {
            throw new Error(
              `Both Streamable HTTP and SSE failed. HTTP: ${streamableError?.message}. SSE: ${sseError?.message}`
            );
          }
        }
      }

      // For stdio, we still need to create a client and connect
      if (config.type === "stdio") {
        const client = new Client(
          { name: "attache", version: "0.1.0" },
          { capabilities: {} },
        );
        await Promise.race([
          client.connect(transport),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), CONNECTION_TIMEOUT)
          ),
        ]);
        connection.client = client;
        connection.transport = transport;
      }

      // Discover tools
      const toolsResult = await connection.client.listTools();
      connection.tools = toolsResult.tools.map((tool) => ({
        serverName: name,
        name: tool.name,
        qualifiedName: `mcp__${name}__${tool.name}`,
        description: tool.description || "",
        inputSchema: (tool.inputSchema as Record<string, any>) || { type: "object", properties: {} },
      }));

      connection.status = "connected";
      console.log(
        `MCP server "${name}" connected with ${connection.tools.length} tools: ${connection.tools.map((t) => t.name).join(", ")}`
      );
    } catch (error: any) {
      connection.status = "error";
      connection.error = error.message;
      console.error(`MCP server "${name}" failed to connect:`, error.message);
    }
  }

  async disconnectServer(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) return;

    try {
      await connection.transport?.close?.();
    } catch {
      // Ignore close errors
    }

    connection.status = "disconnected";
    this.connections.delete(name);
    this.oauthTokens.delete(name);
  }

  async disconnectAll(): Promise<void> {
    const names = [...this.connections.keys()];
    await Promise.all(names.map((name) => this.disconnectServer(name)));
  }

  async reinitialize(servers: Record<string, McpServerConfig>): Promise<void> {
    await this.disconnectAll();
    if (Object.keys(servers).length > 0) {
      await this.initialize(servers);
    }
  }

  getTools(): ToolRegistry {
    const registry: ToolRegistry = {};
    for (const connection of this.connections.values()) {
      if (connection.status !== "connected") continue;
      for (const mcpTool of connection.tools) {
        registry[mcpTool.qualifiedName] = {
          definition: tool({
            description: `[MCP: ${connection.name}] ${mcpTool.description}`,
            inputSchema: jsonSchema(mcpTool.inputSchema),
          }),
          handler: async (args: Record<string, any>) => {
            return await this.executeTool(mcpTool.qualifiedName, args);
          },
        };
      }
    }
    return registry;
  }

  isMcpTool(toolName: string): boolean {
    return toolName.startsWith("mcp__");
  }

  async executeTool(qualifiedName: string, args: Record<string, any>): Promise<string> {
    // Parse "mcp__serverName__toolName" (toolName may contain __)
    const withoutPrefix = qualifiedName.slice(5); // remove "mcp__"
    const separatorIndex = withoutPrefix.indexOf("__");
    if (separatorIndex === -1) {
      return JSON.stringify({ success: false, error: `Invalid MCP tool name: ${qualifiedName}` });
    }
    const serverName = withoutPrefix.slice(0, separatorIndex);
    const toolName = withoutPrefix.slice(separatorIndex + 2);

    const connection = this.connections.get(serverName);
    if (!connection || connection.status !== "connected") {
      return JSON.stringify({
        success: false,
        error: `MCP server "${serverName}" is not connected`,
      });
    }

    try {
      const result = await connection.client.callTool({ name: toolName, arguments: args });
      // MCP tool results are content blocks (text, image, resource)
      const content = (result.content as any[]) || [];
      const textContent = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return textContent || JSON.stringify(content);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `MCP tool "${toolName}" on "${serverName}" failed: ${error.message}`,
      });
    }
  }

  getStatus(): Array<{ name: string; status: string; toolCount: number; description?: string; error?: string }> {
    return [...this.connections.entries()].map(([name, conn]) => ({
      name,
      status: conn.status,
      toolCount: conn.tools.length,
      description: conn.config.description,
      error: conn.error,
    }));
  }
}

export const mcpManager = new McpManager();
