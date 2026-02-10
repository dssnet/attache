import type { ServerWebSocket } from "bun";
import type { Config } from "./config.ts";
import type { ClientMessage, ServerMessage } from "./types.ts";
import { loadContext, addMessage, clearContext, addToolCall, saveContext } from "./context.ts";
import { streamMessage } from "./ai.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { shouldAutoCompact, compactMessages } from "./compact.ts";
import { setAgentEventCallback, clearAllAgents, getAllAgentsInfo, sendToAgent } from "./agent.ts";

interface WebSocketData {
  authenticated: boolean;
  clientId: string;
}

const clients = new Set<ServerWebSocket<WebSocketData>>();
const alive = new WeakSet<ServerWebSocket<WebSocketData>>();

// Heartbeat: ping all clients every 30s, remove unresponsive ones
const HEARTBEAT_INTERVAL_MS = 30_000;

setInterval(() => {
  for (const client of clients) {
    if (!alive.has(client)) {
      // Client didn't respond to last ping — consider it dead
      console.log(`Heartbeat: removing unresponsive client ${client.data.clientId}`);
      clients.delete(client);
      try { client.close(1000, "heartbeat timeout"); } catch {}
      continue;
    }
    alive.delete(client);
    try { client.ping(); } catch {
      // Send failed — remove dead client
      clients.delete(client);
    }
  }
}, HEARTBEAT_INTERVAL_MS);

// Rate limiting for authentication attempts
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 60_000; // 1 minute
const authAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkAuthRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(clientId);
  if (!entry || now - entry.firstAttempt > AUTH_WINDOW_MS) {
    authAttempts.set(clientId, { count: 1, firstAttempt: now });
    return true;
  }
  entry.count++;
  return entry.count <= AUTH_MAX_ATTEMPTS;
}

function resetAuthRateLimit(clientId: string): void {
  authAttempts.delete(clientId);
}

// Message queue system to prevent responses from being overwritten
const messageQueue: Array<{ content: string; timestamp: number; isFromAgent?: boolean; agentId?: string }> = [];
let isProcessingMessage = false;

/**
 * Get only user messages from the queue (excludes agent messages)
 */
function getUserQueuedMessages(): Array<{ content: string; timestamp: number }> {
  return messageQueue
    .filter(msg => !msg.isFromAgent)
    .map(msg => ({ content: msg.content, timestamp: msg.timestamp }));
}

/**
 * Broadcast queue update to all clients
 */
function broadcastQueueUpdate() {
  broadcast({
    type: "queue_update",
    queuedMessages: getUserQueuedMessages(),
  });
}

/**
 * Streams an AI response, broadcasting chunks/splits/tool_use events to all clients.
 */
async function streamAndBroadcast(config: Config, aiMessage: string) {
  let messageId = crypto.randomUUID();

  broadcast({ type: "stream_start", messageId });

  const context = loadContext();
  let fullContent = "";
  let currentMessageContent = "";
  let currentMessageIndex = context.messages.length;

  for await (const event of streamMessage(config, context.messages, aiMessage)) {
    if (event.type === 'chunk') {
      currentMessageContent += event.text;
      fullContent += event.text;
      broadcast({ type: "stream_chunk", messageId, chunk: event.text });
    } else if (event.type === 'split') {
      addMessage("assistant", currentMessageContent);
      broadcast({ type: "stream_end", messageId, fullContent: currentMessageContent });

      messageId = crypto.randomUUID();
      currentMessageContent = "";
      fullContent = "";
      currentMessageIndex++;

      broadcast({ type: "stream_start", messageId });
    } else if (event.type === 'tool_use') {
      const contentPosition = fullContent.length;
      addToolCall(event.toolName, event.toolInput, currentMessageIndex, contentPosition);
      broadcast({
        type: "tool_use",
        toolName: event.toolName,
        toolInput: event.toolInput,
        messageIndex: currentMessageIndex,
        contentPosition,
      });
    }
  }

  addMessage("assistant", currentMessageContent);
  broadcast({ type: "stream_end", messageId, fullContent: currentMessageContent });
}

/**
 * Processes messages from the queue one at a time
 */
async function processMessageQueue(config: Config) {
  if (isProcessingMessage || messageQueue.length === 0) {
    return;
  }

  isProcessingMessage = true;

  try {
    const queuedMessage = messageQueue.shift();
    if (!queuedMessage) {
      isProcessingMessage = false;
      return;
    }

    broadcastQueueUpdate();

    // Auto-compact if context is approaching token limit
    const providerName = config.models.default;
    const provider = config.models.providers[providerName];
    if (provider) {
      const preContext = loadContext();
      if (shouldAutoCompact(preContext.messages, provider.maxTokens)) {
        try {
          await performCompact(config);
        } catch (err) {
          console.error("Pre-message auto-compact failed:", err);
        }
      }
    }

    if (queuedMessage.isFromAgent) {
      // Agent message — add to context and trigger AI with synthetic prompt
      const agentMessage = addMessage("agent", queuedMessage.content, queuedMessage.agentId);
      const agentMsg = agentMessage.messages[agentMessage.messages.length - 1];
      broadcast({ type: "new_message", message: agentMsg! });

      await streamAndBroadcast(
        config,
        "[An agent sent the above information. Relay it to the user naturally. Do NOT speculate about whether the agent is still working or done — just relay the information.]"
      );
    } else {
      // User message — add to context and stream AI response
      const userMessage = addMessage("user", queuedMessage.content);
      const userMsg = userMessage.messages[userMessage.messages.length - 1];
      broadcast({ type: "new_message", message: userMsg! });

      await streamAndBroadcast(config, queuedMessage.content);
    }

    // Auto-compact after AI response if context grew past threshold
    if (provider) {
      const postContext = loadContext();
      if (shouldAutoCompact(postContext.messages, provider.maxTokens)) {
        try {
          await performCompact(config);
        } catch (err) {
          console.error("Post-message auto-compact failed:", err);
        }
      }
    }
  } catch (error) {
    console.error("Chat error:", error);
    broadcast({
      type: "error",
      error:
        error instanceof Error
          ? error.message
          : "Failed to process message",
    });
  } finally {
    // Mark as not processing
    isProcessingMessage = false;

    // Process next message in queue if any
    if (messageQueue.length > 0) {
      processMessageQueue(config);
    }
  }
}

// Set up agent event callbacks to broadcast to all clients
setAgentEventCallback({
  onAgentStarted: (agentId, task) => {
    broadcast({ type: "agent_started", agentId, task });
  },
  onAgentResumed: (agentId) => {
    broadcast({ type: "agent_resumed", agentId });
  },
  onAgentMessage: (agentId, message) => {
    broadcast({ type: "agent_message", agentId, message });
  },
  onAgentCompleted: (agentId, output) => {
    broadcast({ type: "agent_completed", agentId, output });
  },
  onAgentRemoved: (agentId) => {
    broadcast({ type: "agent_removed", agentId });
  },
  onSendToMain: (message, agentId) => {
    // Validate message is not empty
    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      console.warn("Agent attempted to send empty message to main, ignoring");
      return;
    }

    // Queue agent messages with the isFromAgent flag so they get stored with "agent" role
    messageQueue.push({
      content: trimmedMessage,
      timestamp: Date.now(),
      isFromAgent: true,
      agentId,
    });
    // Process the queue
    const config = loadConfig();
    processMessageQueue(config);
  },
});

/**
 * Compacts the conversation context by summarizing it via the AI.
 * Replaces all messages with a single assistant summary message.
 */
async function performCompact(config: Config) {
  const context = loadContext();
  if (context.messages.length < 4) return;

  broadcast({ type: "compact_start" });

  try {
    const summary = await compactMessages(config, context.messages);
    saveContext({
      messages: [
        {
          role: "assistant",
          content: `[Previous conversation summary]\n${summary}`,
          timestamp: Date.now(),
        },
      ],
      toolCalls: [],
    });

    // Send updated context to all clients
    const newContext = loadContext();
    broadcast({
      type: "context",
      messages: newContext.messages,
      toolCalls: newContext.toolCalls || [],
    });
  } finally {
    broadcast({ type: "compact_complete" });
  }
}

export function handleWebSocket(config: Config) {
  return {
    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      try {
        const data: ClientMessage = JSON.parse(message.toString());
        handleClientMessage(ws, data, config);
      } catch (error) {
        console.error("WebSocket message error:", error);
        sendToClient(ws, {
          type: "error",
          error: "Invalid message format",
        });
      }
    },

    open(ws: ServerWebSocket<WebSocketData>) {
      console.log(`WebSocket connection opened: ${ws.data.clientId}`);
      alive.add(ws);
    },

    pong(ws: ServerWebSocket<WebSocketData>) {
      alive.add(ws);
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      console.log("WebSocket connection closed");
      clients.delete(ws);
    },
  };
}

async function handleClientMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: ClientMessage,
  config: Config
) {
  // Authentication required for all messages except auth
  if (message.type !== "auth" && !ws.data.authenticated) {
    sendToClient(ws, {
      type: "auth_error",
      error: "Not authenticated",
    });
    return;
  }

  switch (message.type) {
    case "auth": {
      if (!checkAuthRateLimit(ws.data.clientId)) {
        sendToClient(ws, {
          type: "auth_error",
          error: "Too many authentication attempts. Try again later.",
        });
        break;
      }

      if (message.token === config.server.authToken) {
        ws.data.authenticated = true;
        resetAuthRateLimit(ws.data.clientId);
        clients.add(ws);
        sendToClient(ws, { type: "auth_success", first_run: config.assistant.first_run });

        // Send current queue state to the new client
        sendToClient(ws, {
          type: "queue_update",
          queuedMessages: getUserQueuedMessages(),
        });

        // Send all existing agents to the new client
        const existingAgents = getAllAgentsInfo();
        for (const agent of existingAgents) {
          sendToClient(ws, { type: "agent_started", agentId: agent.id, task: agent.task });

          // Send all agent display messages
          for (const msg of agent.displayMessages) {
            sendToClient(ws, { type: "agent_message", agentId: agent.id, message: msg });
          }

          // Send completion status if completed
          if (agent.status === "completed") {
            sendToClient(ws, { type: "agent_completed", agentId: agent.id, output: "" });
          }
        }
      } else {
        console.warn(`Failed auth attempt from client ${ws.data.clientId}`);
        sendToClient(ws, {
          type: "auth_error",
          error: "Invalid token",
        });
      }
      break;
    }

    case "get_context": {
      const context = loadContext();
      sendToClient(ws, {
        type: "context",
        messages: context.messages,
        toolCalls: context.toolCalls || [],
      });
      break;
    }

    case "send_message": {
      // Add message to queue
      messageQueue.push({
        content: message.content,
        timestamp: Date.now(),
      });

      // Broadcast queue update after adding message
      broadcastQueueUpdate();

      // Process the queue (will only start if not already processing)
      processMessageQueue(config);
      break;
    }

    case "clear_context": {
      clearContext();
      broadcast({ type: "context_cleared" });
      break;
    }

    case "clear_agents": {
      try {
        await clearAllAgents();
        // Agent removal notifications are sent by clearAllAgents via callbacks
      } catch (error) {
        console.error("Clear agents error:", error);
        sendToClient(ws, {
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to clear agents",
        });
      }
      break;
    }

    case "send_to_agent": {
      const sent = sendToAgent(message.agentId, message.message);
      if (!sent) {
        sendToClient(ws, {
          type: "error",
          error: "Agent not found or no longer active",
        });
      }
      // If successful, the agent will process the message and send responses via agent_message events
      break;
    }

    case "get_config": {
      try {
        const currentConfig = loadConfig();
        sendToClient(ws, {
          type: "config",
          config: currentConfig,
        });
      } catch (error) {
        console.error("Config get error:", error);
        sendToClient(ws, {
          type: "error",
          error:
            error instanceof Error ? error.message : "Failed to get config",
        });
      }
      break;
    }

    case "update_config": {
      try {
        saveConfig(message.config);

        // Re-initialize MCP servers if mcpServers was updated
        if (message.config.mcpServers !== undefined) {
          const { mcpManager } = await import("./mcp.ts");
          const newConfig = loadConfig();
          await mcpManager.reinitialize(newConfig.mcpServers || {});
        }

        sendToClient(ws, {
          type: "config_updated",
          success: true,
        });
      } catch (error) {
        console.error("Config update error:", error);
        sendToClient(ws, {
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to update config",
        });
      }
      break;
    }

    case "get_mcp_status": {
      const { mcpManager } = await import("./mcp.ts");
      sendToClient(ws, {
        type: "mcp_status",
        servers: mcpManager.getStatus(),
      });
      break;
    }

    case "remove_queued": {
      const idx = messageQueue.findIndex(
        (msg) => !msg.isFromAgent && msg.timestamp === message.timestamp,
      );
      if (idx !== -1) {
        messageQueue.splice(idx, 1);
        broadcastQueueUpdate();
      }
      break;
    }

    case "compact_context": {
      try {
        await performCompact(config);
      } catch (error) {
        console.error("Compact error:", error);
        sendToClient(ws, {
          type: "error",
          error: error instanceof Error ? error.message : "Failed to compact context",
        });
      }
      break;
    }
  }
}

function sendToClient(ws: ServerWebSocket<WebSocketData>, message: ServerMessage) {
  const payload = JSON.stringify(message);
  queueMicrotask(() => {
    try {
      ws.send(payload);
    } catch {
      clients.delete(ws);
    }
  });
}

function broadcast(message: ServerMessage) {
  const payload = JSON.stringify(message);
  // Snapshot to avoid mutation-during-iteration issues
  const snapshot = [...clients];
  for (const client of snapshot) {
    if (client.data.authenticated) {
      queueMicrotask(() => {
        try {
          client.send(payload);
        } catch {
          clients.delete(client);
        }
      });
    }
  }
}
