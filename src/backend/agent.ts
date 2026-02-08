import { streamText, type ModelMessage } from "ai";
import type { Config, ProviderConfig } from "./config.ts";
import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { createModel } from "./adapters.ts";
import { createAgentTools, getToolDefinitions, executeRegistryTool, type AgentToolContext } from "./tools.ts";
import { shouldAutoCompactAgent, compactAgentMessages } from "./compact.ts";
import { homedir } from "node:os";
import { expandHome } from "./utils.ts";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResult {
  success: boolean;
  output: string;
  agentId?: string;
  messagesToMain?: string[];
}

export interface AgentEventCallback {
  onAgentStarted?: (agentId: string, task: string) => void;
  onAgentResumed?: (agentId: string) => void;
  onAgentMessage?: (agentId: string, message: string) => void;
  onAgentCompleted?: (agentId: string, output: string) => void;
  onAgentRemoved?: (agentId: string) => void;
  onSendToMain?: (message: string, agentId: string) => void;
}

interface ActiveAgent {
  id: string;
  incomingMessages: string[];
  task: string;
  status: "running" | "completed";
  lastActivityTime: number;
  messages: string[];
  conversationHistory?: any[];
  systemPrompt?: string;
  providerType?: string;
}

// Global event callback
let agentEventCallback: AgentEventCallback = {};

export function setAgentEventCallback(callback: AgentEventCallback) {
  agentEventCallback = callback;
}

// Global map of active agents
const activeAgents = new Map<string, ActiveAgent>();

// Cleanup interval: 30 minutes in milliseconds
const AGENT_INACTIVITY_TIMEOUT = 30 * 60 * 1000;

// Agent creation cooldown: 1 second
const AGENT_CREATION_COOLDOWN = 1000;
let lastAgentCreationTime = 0;

// Path to agents storage directory
const AGENTS_DIR = join(homedir(), ".attache", "agents");

async function ensureAgentsDir() {
  await mkdir(AGENTS_DIR, { recursive: true });
}

async function saveAgentToDisk(agent: ActiveAgent) {
  await ensureAgentsDir();
  const filePath = join(AGENTS_DIR, `${agent.id}.json`);
  await writeFile(filePath, JSON.stringify(agent, null, 2));
}

async function deleteAgentFromDisk(agentId: string) {
  const filePath = join(AGENTS_DIR, `${agentId}.json`);
  try {
    await unlink(filePath);
  } catch (error) {
    // File might not exist, ignore
  }
}

async function loadAgentsFromDisk() {
  try {
    if (!existsSync(AGENTS_DIR)) {
      return;
    }
    const files = await readdir(AGENTS_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const filePath = join(AGENTS_DIR, file);
          const content = await readFile(filePath, "utf-8");
          const agent: ActiveAgent = JSON.parse(content);
          if (agent.status === "completed") {
            activeAgents.set(agent.id, agent);
            console.log(`Loaded agent from disk: ${agent.id}`);
            if (agentEventCallback.onAgentStarted) {
              agentEventCallback.onAgentStarted(agent.id, agent.task);
            }
            if (agentEventCallback.onAgentMessage) {
              for (const message of agent.messages || []) {
                agentEventCallback.onAgentMessage(agent.id, message);
              }
            }
            if (agentEventCallback.onAgentCompleted) {
              agentEventCallback.onAgentCompleted(agent.id, "");
            }
          } else {
            await deleteAgentFromDisk(agent.id);
          }
        } catch (error) {
          console.error(`Failed to load agent from ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Failed to load agents from disk:", error);
  }
}

// Load agents from disk on startup
loadAgentsFromDisk().catch(error => {
  console.error("Failed to load agents:", error);
});

// Background cleanup process - runs every 5 minutes
setInterval(() => {
  const now = Date.now();
  const agentsToDelete: string[] = [];
  for (const [agentId, agent] of activeAgents.entries()) {
    if (agent.status === "completed" && now - agent.lastActivityTime > AGENT_INACTIVITY_TIMEOUT) {
      agentsToDelete.push(agentId);
    }
  }
  for (const agentId of agentsToDelete) {
    console.log(`Cleaning up inactive agent: ${agentId}`);
    activeAgents.delete(agentId);
    deleteAgentFromDisk(agentId).catch(error => {
      console.error(`Failed to delete agent ${agentId} from disk:`, error);
    });
    if (agentEventCallback.onAgentRemoved) {
      agentEventCallback.onAgentRemoved(agentId);
    }
  }
}, 5 * 60 * 1000);

export function sendToAgent(agentId: string, message: string): boolean {
  const agent = activeAgents.get(agentId);
  if (!agent || agent.status !== "running") {
    return false;
  }
  agent.incomingMessages.push(message);
  agent.lastActivityTime = Date.now();
  return true;
}

export function getActiveAgents(): string[] {
  return Array.from(activeAgents.keys());
}

export function getAllAgentsInfo(): Array<{ id: string; task: string; status: "running" | "completed"; messages: string[] }> {
  return Array.from(activeAgents.values()).map(agent => ({
    id: agent.id,
    task: agent.task,
    status: agent.status,
    messages: agent.messages,
  }));
}

export function getAgentInfo(agentId: string): { id: string; task: string; status: "running" | "completed" } | null {
  const agent = activeAgents.get(agentId);
  if (!agent) return null;
  return { id: agent.id, task: agent.task, status: agent.status };
}

export async function clearAllAgents(): Promise<void> {
  const agentIds = Array.from(activeAgents.keys());
  for (const agentId of agentIds) {
    await deleteAgentFromDisk(agentId);
    if (agentEventCallback.onAgentRemoved) {
      agentEventCallback.onAgentRemoved(agentId);
    }
  }
  activeAgents.clear();
}

function buildAgentSystemPrompt(config: Config, agentId: string): string {
  const fsToolsList = config.tools?.filesystem
    ? `\n- list_directory: List files and directories at a path
- read_file: Read file contents
- write_file: Write content to a file (creates or overwrites)
- create_directory: Create a directory (with parents)
- delete_path: Delete a file or directory
- move_path: Move or rename a file or directory`
    : "";

  const terminalToolsList = config.tools?.terminal
    ? `\n- run_command: Execute a shell command and get stdout/stderr/exit code`
    : "";

  const workingDirInfo = config.tools?.workingDir
    ? `\nYour working directory is: ${resolve(expandHome(config.tools.workingDir))}\nUse this as the default location for downloads, file operations, and as the cwd for commands unless told otherwise. You are not restricted to this directory.\n`
    : "";

  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = currentDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return `You are a sub-agent (ID: ${agentId}). Complete your assigned task using the available tools.
Current date and time: ${dateStr}, ${timeStr}
${workingDirInfo}
Tools: get_config, update_config, restart_server, get_user_profile, save_user_profile, complete_first_run, send_to_main, wait, brave_search, web_fetch${fsToolsList}${terminalToolsList}

Notes: Always call get_user_profile before save_user_profile to merge, not overwrite. The main assistant may send you messages while you work.

## send_to_main Rules
1. Call send_to_main exactly ONCE as your final action with a complete summary of results. The main assistant and user see NOTHING unless you call it.
2. Only send actual results — never narration like "Let me check..." or "I will now...". Finish your work first, then report.
3. Include all relevant findings, confirmations, or errors. Be concise but complete.`;
}

/**
 * Unified agent loop — uses Vercel AI SDK streamText.
 */
async function runAgentLoop(
  provider: ProviderConfig,
  config: Config,
  initialMessages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  messagesToMain: string[],
  agent: ActiveAgent,
): Promise<string> {
  const model = createModel(provider);

  const ctx: AgentToolContext = {
    agentId: agent.id,
    messagesToMain,
    onAgentMessage: agentEventCallback.onAgentMessage,
    onSendToMain: agentEventCallback.onSendToMain,
    agentMessages: agent.messages,
    updateActivityTime: () => { agent.lastActivityTime = Date.now(); },
  };

  const toolRegistry = createAgentTools(config, ctx);
  const toolDefs = getToolDefinitions(toolRegistry);
  let messages: ModelMessage[] = initialMessages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  let finalOutput = "";
  const MAX_ITERATIONS = 20;

  // Outer loop handles incoming messages from main between cycles
  while (true) {
    // Check for incoming messages from main
    if (agent.incomingMessages.length > 0) {
      const incomingMsg = agent.incomingMessages.shift()!;
      messages.push({
        role: "user",
        content: `[Message from main assistant]: ${incomingMsg}`,
      });
    }

    // Inner tool execution loop (stream + execute tools + repeat)
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const result = streamText({
        model,
        system: systemPrompt,
        messages,
        tools: toolDefs,
        temperature: provider.temperature,
      });

      let currentText = "";
      const toolCalls: Array<{ id: string; name: string; input: any }> = [];

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta": {
            const delta = (part as any).textDelta ?? (part as any).text ?? "";
            currentText += delta;
            finalOutput += delta;
            break;
          }
          case "tool-call": {
            const input = (part as any).input ?? (part as any).args ?? {};
            toolCalls.push({
              id: part.toolCallId,
              name: part.toolName,
              input,
            });
            break;
          }
        }
      }

      // Log text output from the agent
      if (currentText.trim()) {
        const message = `💭 ${currentText.trim()}`;
        agent.messages.push(message);
        agent.lastActivityTime = Date.now();
        if (agentEventCallback.onAgentMessage) {
          agentEventCallback.onAgentMessage(agent.id, message);
        }
      }

      // No tool calls — this cycle is done
      if (toolCalls.length === 0) {
        if (currentText) {
          messages.push({ role: "assistant", content: currentText });
        }
        break;
      }

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: [
          ...(currentText ? [{ type: "text" as const, text: currentText }] : []),
          ...toolCalls.map((tc) => ({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.input,
          })),
        ],
      });

      // Execute each tool and add results
      const toolResults: Array<{ type: "tool-result"; toolCallId: string; toolName: string; output: { type: "text"; value: string } }> = [];
      for (const tc of toolCalls) {
        const resultStr = await executeRegistryTool(toolRegistry, tc.name, tc.input);
        toolResults.push({
          type: "tool-result",
          toolCallId: tc.id,
          toolName: tc.name,
          output: { type: "text", value: resultStr },
        });
      }
      messages.push({
        role: "tool",
        content: toolResults,
      });

      // Auto-compact agent conversation if approaching token limit
      if (shouldAutoCompactAgent(messages, provider.maxTokens)) {
        const compactMsg = `🗜️ Auto-compacting conversation (${messages.length} messages)...`;
        agent.messages.push(compactMsg);
        if (agentEventCallback.onAgentMessage) {
          agentEventCallback.onAgentMessage(agent.id, compactMsg);
        }
        try {
          messages = await compactAgentMessages(provider, messages);
        } catch (err) {
          console.error(`Agent ${agent.id} compaction failed:`, err);
          const errMsg = `⚠️ Compaction failed, continuing with truncated history`;
          agent.messages.push(errMsg);
          if (agentEventCallback.onAgentMessage) {
            agentEventCallback.onAgentMessage(agent.id, errMsg);
          }
          // Keep only the first message (task) and the last few messages
          const first = messages[0];
          const recent = messages.slice(-6);
          messages = first && !recent.includes(first) ? [first, ...recent] : recent;
        }
      }
    }

    // After inner loop completes, check if new messages arrived
    if (agent.incomingMessages.length > 0) {
      continue;
    }

    break;
  }

  // Save conversation history for resume
  agent.conversationHistory = messages;
  agent.systemPrompt = systemPrompt;
  agent.providerType = provider.type;

  return finalOutput;
}

/**
 * Runs a sub-agent with the given task
 */
export async function runAgent(
  config: Config,
  task: string
): Promise<AgentResult> {
  const trimmedTask = task.trim();
  if (!trimmedTask || trimmedTask.length < 3 || trimmedTask === ":") {
    throw new Error("Task description is too short or invalid");
  }

  const now = Date.now();
  const timeSinceLastCreation = now - lastAgentCreationTime;
  if (timeSinceLastCreation < AGENT_CREATION_COOLDOWN) {
    const remainingTime = AGENT_CREATION_COOLDOWN - timeSinceLastCreation;
    throw new Error(`Agent creation cooldown active. Please wait ${Math.ceil(remainingTime / 1000)} seconds.`);
  }
  lastAgentCreationTime = now;

  const providerName = config.models.default;
  const provider = config.models.providers[providerName];
  if (!provider) {
    throw new Error(`Provider ${providerName} not found in config`);
  }

  const agentId = `agent_${crypto.randomUUID()}`;
  const agent: ActiveAgent = {
    id: agentId,
    incomingMessages: [],
    task: trimmedTask,
    status: "running",
    lastActivityTime: Date.now(),
    messages: [],
  };
  activeAgents.set(agentId, agent);

  if (agentEventCallback.onAgentStarted) {
    agentEventCallback.onAgentStarted(agentId, trimmedTask);
  }

  const messagesToMain: string[] = [];
  let output = "";

  const systemPrompt = buildAgentSystemPrompt(config, agentId);
  const initialMessages = [{ role: "user", content: trimmedTask }];

  try {
    output = await runAgentLoop(provider, config, initialMessages, systemPrompt, messagesToMain, agent);
  } finally {
    agent.status = "completed";
    agent.lastActivityTime = Date.now();

    if (messagesToMain.length === 0) {
      const autoMessage = `[Agent completed task "${trimmedTask}" but did not send back a report. You can use send_to_agent to ask it for results.]`;
      messagesToMain.push(autoMessage);
      agent.messages.push(autoMessage);
      if (agentEventCallback.onAgentMessage) {
        agentEventCallback.onAgentMessage(agentId, autoMessage);
      }
      try {
        if (agentEventCallback.onSendToMain) {
          agentEventCallback.onSendToMain(autoMessage, agentId);
        }
      } catch (err) {
        console.error(`Failed to auto-send agent ${agentId} output to main:`, err);
      }
    }

    await saveAgentToDisk(agent);

    if (agentEventCallback.onAgentCompleted) {
      agentEventCallback.onAgentCompleted(agentId, output);
    }
  }

  return {
    success: true,
    output,
    agentId,
    messagesToMain: messagesToMain.length > 0 ? messagesToMain : undefined,
  };
}

/**
 * Resumes a completed agent with a new message from main.
 */
export async function resumeAgent(
  config: Config,
  agentId: string,
  message: string
): Promise<AgentResult> {
  const agent = activeAgents.get(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }

  if (!agent.conversationHistory || !agent.systemPrompt) {
    throw new Error("Agent has no conversation history to resume from");
  }

  const providerName = config.models.default;
  const provider = config.models.providers[providerName];
  if (!provider) {
    throw new Error(`Provider ${providerName} not found in config`);
  }

  agent.status = "running";
  agent.lastActivityTime = Date.now();
  agent.incomingMessages = [];

  const resumeMessage = `📩 Message from main: ${message}`;
  agent.messages.push(resumeMessage);
  if (agentEventCallback.onAgentMessage) {
    agentEventCallback.onAgentMessage(agentId, resumeMessage);
  }
  if (agentEventCallback.onAgentResumed) {
    agentEventCallback.onAgentResumed(agentId);
  }

  const messagesToMain: string[] = [];
  let output = "";

  // Restore conversation and append the new message
  const resumedMessages = [
    ...agent.conversationHistory,
    { role: "user", content: `[Message from main assistant]: ${message}` },
  ];

  try {
    output = await runAgentLoop(provider, config, resumedMessages, agent.systemPrompt, messagesToMain, agent);
  } finally {
    agent.status = "completed";
    agent.lastActivityTime = Date.now();

    if (messagesToMain.length === 0) {
      const autoMessage = `[Agent completed follow-up on "${agent.task}" but did not send back a report. You can use send_to_agent to ask it for results.]`;
      messagesToMain.push(autoMessage);
      agent.messages.push(autoMessage);
      if (agentEventCallback.onAgentMessage) {
        agentEventCallback.onAgentMessage(agentId, autoMessage);
      }
      try {
        if (agentEventCallback.onSendToMain) {
          agentEventCallback.onSendToMain(autoMessage, agentId);
        }
      } catch (err) {
        console.error(`Failed to auto-send agent ${agentId} output to main:`, err);
      }
    }

    await saveAgentToDisk(agent);

    if (agentEventCallback.onAgentCompleted) {
      agentEventCallback.onAgentCompleted(agentId, output);
    }
  }

  return {
    success: true,
    output,
    agentId,
    messagesToMain: messagesToMain.length > 0 ? messagesToMain : undefined,
  };
}
