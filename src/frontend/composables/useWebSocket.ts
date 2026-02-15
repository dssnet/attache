import { ref, onUnmounted } from "vue";
import type { Config } from "./useConfig";
import { useToast } from "./useToast";

interface Message {
  role: "user" | "assistant" | "agent";
  content: string;
  timestamp: number;
}

type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "send_message"; content: string }
  | { type: "clear_context" }
  | { type: "get_context" }
  | { type: "clear_agents" }
  | { type: "send_to_agent"; agentId: string; message: string }
  | { type: "get_config" }
  | { type: "update_config"; config: Partial<Config> }
  | { type: "get_mcp_status" }
  | { type: "remove_queued"; timestamp: number }
  | { type: "compact_context" }
  | { type: "subscribe_agent"; agentId: string }
  | { type: "unsubscribe_agent"; agentId: string }
  | { type: "stop_generation" }
  | { type: "kill_agent"; agentId: string }
  | { type: "check_update" }
  | { type: "start_upgrade" };

export interface AgentDisplayMessage {
  type: "thinking" | "tool_call" | "send_to_main" | "user_message" | "system";
  content: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: string;
  timestamp: number;
}

interface Agent {
  id: string;
  task: string;
  displayMessages: AgentDisplayMessage[];
  status: "running" | "completed";
}

interface ToolCall {
  toolName: string;
  toolInput: Record<string, any>;
  timestamp: number;
  messageIndex: number; // Index of the message this tool call belongs to
  contentPosition: number; // Position in the message content where this tool call occurred
}

type ServerMessage =
  | { type: "auth_success"; first_run: boolean }
  | { type: "auth_error"; error: string }
  | { type: "context"; messages: Message[]; toolCalls: ToolCall[] }
  | { type: "new_message"; message: Message }
  | { type: "stream_start"; messageId: string }
  | { type: "stream_chunk"; messageId: string; chunk: string }
  | { type: "stream_end"; messageId: string; fullContent: string }
  | {
      type: "tool_use";
      toolName: string;
      toolInput: Record<string, any>;
      messageIndex: number;
      contentPosition: number;
    }
  | { type: "error"; error: string }
  | { type: "context_cleared" }
  | { type: "agent_started"; agentId: string; task: string }
  | { type: "agent_resumed"; agentId: string }
  | { type: "agent_message"; agentId: string; message: AgentDisplayMessage }
  | { type: "agent_completed"; agentId: string; output: string }
  | { type: "agent_removed"; agentId: string }
  | {
      type: "queue_update";
      queuedMessages: Array<{ content: string; timestamp: number }>;
    }
  | { type: "config"; config: Config }
  | { type: "config_updated"; success: boolean }
  | {
      type: "mcp_status";
      servers: Array<{
        name: string;
        status: string;
        toolCount: number;
        error?: string;
      }>;
    }
  | { type: "agent_detail"; agentId: string; displayMessages: AgentDisplayMessage[] }
  | { type: "compact_start" }
  | { type: "compact_complete" }
  | { type: "update_available"; currentVersion: string; latestVersion: string; available: boolean }
  | { type: "upgrade_progress"; step: string }
  | { type: "upgrade_complete" }
  | { type: "upgrade_error"; error: string }
  | { type: "ping" };

export function useWebSocket() {
  const ws = ref<WebSocket | null>(null);
  const connected = ref(false);
  const authenticated = ref(false);
  const messages = ref<Message[]>([]);
  const agents = ref<Map<string, Agent>>(new Map());
  const loading = ref(false);
  const compacting = ref(false);
  const streamingMessages = new Map<string, string>();
  const queuedMessages = ref<Array<{ content: string; timestamp: number }>>([]);
  const toolCalls = ref<ToolCall[]>([]);
  const config = ref<Config | null>(null);
  const configSaving = ref(false);
  const mcpStatus = ref<
    Array<{ name: string; status: string; toolCount: number; error?: string }>
  >([]);
  const updateAvailable = ref(false);
  const latestVersion = ref<string | null>(null);
  const upgrading = ref(false);
  const upgradeStep = ref<string | null>(null);
  const checkingUpdate = ref(false);

  const toast = useToast();

  let reconnectTimeout: number | null = null;
  let reconnectAttempts = 0;
  let connectionToastId: number | null = null;

  // Heartbeat: if no message arrives within this window, assume the
  // connection is dead (zombie socket behind a proxy) and force reconnect.
  const HEARTBEAT_TIMEOUT_MS = 45_000; // slightly longer than server's 30s ping interval
  let heartbeatTimer: number | null = null;

  function resetHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      console.log("Heartbeat timeout — no data received, forcing reconnect");
      if (ws.value) {
        ws.value.close();
      }
    }, HEARTBEAT_TIMEOUT_MS) as unknown as number;
  }

  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function connect(authToken: string, onLogout: () => void) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
      console.log("WebSocket connected");
      connected.value = true;
      reconnectAttempts = 0;
      if (connectionToastId !== null) {
        toast.dismiss(connectionToastId);
        connectionToastId = null;
      }
      resetHeartbeat();

      // Authenticate
      send({ type: "auth", token: authToken });
    };

    ws.value.onmessage = (event) => {
      resetHeartbeat();
      const message: ServerMessage = JSON.parse(event.data);
      handleServerMessage(message, onLogout);
    };

    ws.value.onerror = (event) => {
      console.error("WebSocket error:", event);
    };

    ws.value.onclose = () => {
      console.log("WebSocket closed");
      connected.value = false;
      authenticated.value = false;
      clearHeartbeat();

      // Show persistent toast while disconnected
      if (connectionToastId === null) {
        connectionToastId = toast.warning("Connection lost. Reconnecting…", 0);
      }

      // Always attempt to reconnect with exponential backoff (capped at 30s)
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(
        `Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`,
      );

      reconnectTimeout = setTimeout(() => {
        connect(authToken, onLogout);
      }, delay) as unknown as number;
    };
  }

  function handleServerMessage(message: ServerMessage, onLogout: () => void) {
    switch (message.type) {
      case "auth_success":
        authenticated.value = true;
        // Request initial context and config
        send({ type: "get_context" });
        send({ type: "get_config" });
        break;

      case "auth_error":
        toast.error(message.error);
        authenticated.value = false;
        onLogout();
        break;

      case "context":
        messages.value = message.messages;
        toolCalls.value = message.toolCalls || [];
        break;

      case "new_message":
        messages.value.push(message.message);
        // Don't clear loading here - wait for stream_end
        break;

      case "stream_start":
        // Initialize streaming message
        loading.value = true;
        streamingMessages.set(message.messageId, "");
        messages.value.push({
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        });
        break;

      case "stream_chunk":
        // Append chunk to streaming message
        const currentContent = streamingMessages.get(message.messageId) || "";
        streamingMessages.set(
          message.messageId,
          currentContent + message.chunk,
        );

        // Update the last message (the streaming one)
        const lastMessage = messages.value[messages.value.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.content = streamingMessages.get(message.messageId) || "";
        }
        break;

      case "stream_end":
        // Clean up streaming state
        streamingMessages.delete(message.messageId);
        loading.value = false;

        // Ensure the final content is set
        const finalMessage = messages.value[messages.value.length - 1];
        if (finalMessage && finalMessage.role === "assistant") {
          finalMessage.content = message.fullContent;
        }
        break;

      case "error":
        toast.error(message.error);
        loading.value = false;
        break;

      case "context_cleared":
        messages.value = [];
        streamingMessages.clear();
        toolCalls.value = [];
        break;

      case "agent_started":
        console.log("Agent started:", message.agentId, message.task);
        agents.value.set(message.agentId, {
          id: message.agentId,
          task: message.task,
          displayMessages: [],
          status: "running",
        });
        agents.value = new Map(agents.value); // Trigger reactivity
        // Hide loading indicator when agent starts - we're no longer waiting for a direct response
        loading.value = false;
        break;

      case "agent_resumed": {
        console.log("Agent resumed:", message.agentId);
        const resumedAgent = agents.value.get(message.agentId);
        if (resumedAgent) {
          resumedAgent.status = "running";
          agents.value = new Map(agents.value); // Trigger reactivity
        }
        loading.value = false;
        break;
      }

      case "agent_message": {
        const msgAgent = agents.value.get(message.agentId);
        if (msgAgent) {
          msgAgent.displayMessages.push(message.message);
          agents.value = new Map(agents.value); // Trigger reactivity
        }
        break;
      }

      case "agent_detail": {
        const detailAgent = agents.value.get(message.agentId);
        if (detailAgent) {
          detailAgent.displayMessages = message.displayMessages;
          agents.value = new Map(agents.value); // Trigger reactivity
        }
        break;
      }

      case "agent_completed":
        console.log("Agent completed:", message.agentId);
        const completedAgent = agents.value.get(message.agentId);
        if (completedAgent) {
          completedAgent.status = "completed";
          agents.value = new Map(agents.value); // Trigger reactivity
          // Agents persist for 30 minutes on backend and can be reused
        }
        break;

      case "agent_removed":
        console.log("Agent removed:", message.agentId);
        agents.value.delete(message.agentId);
        agents.value = new Map(agents.value); // Trigger reactivity
        break;

      case "queue_update":
        queuedMessages.value = message.queuedMessages;
        break;

      case "config":
        config.value = message.config;
        break;

      case "config_updated":
        configSaving.value = false;
        if (message.success) {
          // Reload config after successful update
          send({ type: "get_config" });
        }
        break;

      case "mcp_status":
        mcpStatus.value = message.servers;
        break;

      case "compact_start":
        compacting.value = true;
        break;

      case "compact_complete":
        compacting.value = false;
        break;

      case "tool_use":
        console.log("Tool use:", message.toolName, message.toolInput);
        // Use the messageIndex and contentPosition from the server
        toolCalls.value = [
          ...toolCalls.value,
          {
            toolName: message.toolName,
            toolInput: message.toolInput,
            timestamp: Date.now(),
            messageIndex: message.messageIndex,
            contentPosition: message.contentPosition,
          },
        ];
        break;

      case "update_available":
        updateAvailable.value = message.available;
        latestVersion.value = message.latestVersion;
        checkingUpdate.value = false;
        break;

      case "upgrade_progress":
        upgrading.value = true;
        upgradeStep.value = message.step;
        break;

      case "upgrade_complete":
        upgrading.value = false;
        upgradeStep.value = null;
        toast.success("Upgrade complete! Reconnecting...");
        break;

      case "upgrade_error":
        upgrading.value = false;
        upgradeStep.value = null;
        toast.error(`Upgrade failed: ${message.error}`);
        break;
    }
  }

  function send(message: ClientMessage) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
    } else {
      toast.error("Not connected");
    }
  }

  function sendMessage(content: string) {
    if (!authenticated.value) {
      toast.error("Not authenticated");
      return;
    }

    loading.value = true;

    send({ type: "send_message", content });
  }

  function clearContext() {
    send({ type: "clear_context" });
  }

  function clearAgents() {
    send({ type: "clear_agents" });
  }

  function sendToAgent(agentId: string, message: string) {
    send({ type: "send_to_agent", agentId, message });
  }

  function getConfig() {
    send({ type: "get_config" });
  }

  function updateConfig(partial: Partial<Config>) {
    configSaving.value = true;
    send({ type: "update_config", config: partial });
  }

  function getMcpStatus() {
    send({ type: "get_mcp_status" });
  }

  function removeQueuedMessage(timestamp: number) {
    send({ type: "remove_queued", timestamp });
  }

  function compactContext() {
    send({ type: "compact_context" });
  }

  function subscribeAgent(agentId: string) {
    send({ type: "subscribe_agent", agentId });
  }

  function unsubscribeAgent(agentId: string) {
    send({ type: "unsubscribe_agent", agentId });
  }

  function killAgent(agentId: string) {
    send({ type: "kill_agent", agentId });
  }

  function stopGeneration() {
    send({ type: "stop_generation" });
  }

  function restartServer() {
    send({ type: "restart_server" });
  }

  function checkUpdate() {
    checkingUpdate.value = true;
    send({ type: "check_update" });
  }

  function startUpgrade() {
    send({ type: "start_upgrade" });
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    clearHeartbeat();
    // Prevent onclose from triggering a reconnect
    if (ws.value) {
      ws.value.onclose = null;
      ws.value.close();
      ws.value = null;
    }
    connected.value = false;
    authenticated.value = false;
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    authenticated,
    messages,
    agents,
    loading,
    compacting,
    queuedMessages,
    toolCalls,
    config,
    configSaving,
    mcpStatus,
    connect,
    sendMessage,
    clearContext,
    clearAgents,
    sendToAgent,
    getConfig,
    updateConfig,
    getMcpStatus,
    removeQueuedMessage,
    compactContext,
    subscribeAgent,
    unsubscribeAgent,
    killAgent,
    stopGeneration,
    restartServer,
    updateAvailable,
    latestVersion,
    upgrading,
    upgradeStep,
    checkingUpdate,
    checkUpdate,
    startUpgrade,
    disconnect,
  };
}
