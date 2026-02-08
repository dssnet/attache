// WebSocket message types

export interface Message {
  role: "user" | "assistant" | "agent";
  content: string;
  timestamp: number;
}

export interface ToolCall {
  toolName: string;
  toolInput: Record<string, any>;
  timestamp: number;
  messageIndex: number;
  contentPosition: number;
}

// Client -> Server messages
export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "send_message"; content: string }
  | { type: "clear_context" }
  | { type: "get_context" }
  | { type: "get_config" }
  | { type: "update_config"; config: any }
  | { type: "clear_agents" }
  | { type: "send_to_agent"; agentId: string; message: string }
  | { type: "get_mcp_status" }
  | { type: "remove_queued"; timestamp: number }
  | { type: "compact_context" };

// Server -> Client messages
export type ServerMessage =
  | { type: "auth_success"; first_run: boolean }
  | { type: "auth_error"; error: string }
  | { type: "context"; messages: Message[]; toolCalls: ToolCall[] }
  | { type: "new_message"; message: Message }
  | { type: "stream_start"; messageId: string }
  | { type: "stream_chunk"; messageId: string; chunk: string }
  | { type: "stream_end"; messageId: string; fullContent: string }
  | { type: "tool_use"; toolName: string; toolInput: Record<string, any>; messageIndex: number; contentPosition: number }
  | { type: "error"; error: string }
  | { type: "context_cleared" }
  | { type: "config"; config: any }
  | { type: "config_updated"; success: boolean }
  | { type: "agent_started"; agentId: string; task: string }
  | { type: "agent_resumed"; agentId: string }
  | { type: "agent_message"; agentId: string; message: string }
  | { type: "agent_completed"; agentId: string; output: string }
  | { type: "agent_removed"; agentId: string }
  | { type: "queue_update"; queuedMessages: Array<{ content: string; timestamp: number }> }
  | { type: "mcp_status"; servers: Array<{ name: string; status: string; toolCount: number; description?: string; error?: string }> }
  | { type: "compact_start" }
  | { type: "compact_complete" };
