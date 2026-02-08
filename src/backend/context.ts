import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ATTACHE_DIR, ensureAttacheDir } from "./utils.ts";

export interface Message {
  role: "user" | "assistant" | "agent";
  content: string;
  timestamp: number;
  agentId?: string;
}

export interface ToolCall {
  toolName: string;
  toolInput: Record<string, any>;
  timestamp: number;
  messageIndex: number; // Index of the message this tool call belongs to
  contentPosition: number; // Position in the message content where this tool call occurred
}

export interface Context {
  messages: Message[];
  toolCalls?: ToolCall[];
}

const CONTEXT_FILE = join(ATTACHE_DIR, "context.json");

/**
 * Loads the current context from ~/.attache/context.json
 */
export function loadContext(): Context {
  ensureAttacheDir();

  if (!existsSync(CONTEXT_FILE)) {
    return { messages: [] };
  }

  try {
    const content = readFileSync(CONTEXT_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading context:", error);
    return { messages: [] };
  }
}

/**
 * Saves the context to ~/.attache/context.json
 */
export function saveContext(context: Context): void {
  ensureAttacheDir();

  try {
    writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving context:", error);
    throw error;
  }
}

/**
 * Adds a message to the context
 */
export function addMessage(role: "user" | "assistant" | "agent", content: string, agentId?: string): Context {
  const context = loadContext();
  const message: Message = {
    role,
    content,
    timestamp: Date.now(),
  };
  if (agentId) {
    message.agentId = agentId;
  }
  context.messages.push(message);
  saveContext(context);
  return context;
}

/**
 * Clears the context
 */
export function clearContext(): void {
  saveContext({ messages: [], toolCalls: [] });
}

/**
 * Adds a tool call to the context
 */
export function addToolCall(
  toolName: string,
  toolInput: Record<string, any>,
  messageIndex: number,
  contentPosition: number
): Context {
  const context = loadContext();
  const toolCall: ToolCall = {
    toolName,
    toolInput,
    timestamp: Date.now(),
    messageIndex,
    contentPosition,
  };
  if (!context.toolCalls) {
    context.toolCalls = [];
  }
  context.toolCalls.push(toolCall);
  saveContext(context);
  return context;
}

/**
 * Gets all tool calls from the context
 */
export function getToolCalls(): ToolCall[] {
  const context = loadContext();
  return context.toolCalls || [];
}
