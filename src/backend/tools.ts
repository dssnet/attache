import { tool, jsonSchema } from "ai";
import type { Config, ProviderConfig } from "./config.ts";
import { loadConfig as loadCurrentConfig, saveConfig } from "./config.ts";
import { loadUserProfile, saveUserProfile } from "./user-profile.ts";
import { mcpManager } from "./mcp.ts";
import {
  runAgent,
  resumeAgent,
  sendToAgent,
  getAllAgentsInfo,
  getAgentInfo,
} from "./agent.ts";
import { mkdir, writeFile, readFile, readdir, unlink, stat, rm } from "node:fs/promises";
import { join, resolve, normalize } from "node:path";
import { homedir } from "node:os";
import { expandHome } from "./utils.ts";

const DOWNLOADS_DIR = join(homedir(), ".attache", "downloads");

/**
 * Validates that a resolved path is within the allowed working directory.
 * Throws if limitWorkingDir is enabled and the path escapes workingDir.
 */
function validatePathWithinWorkingDir(targetPath: string, config: Config): void {
  if (!config.tools?.limitWorkingDir) return;
  const workingDir = config.tools?.workingDir;
  if (!workingDir) {
    throw new Error("limitWorkingDir is enabled but no workingDir is configured.");
  }
  const allowedDir = resolve(expandHome(workingDir));
  const resolvedTarget = resolve(targetPath);
  if (!resolvedTarget.startsWith(allowedDir + "/") && resolvedTarget !== allowedDir) {
    throw new Error(`Access denied: path "${resolvedTarget}" is outside the allowed working directory.`);
  }
}

/**
 * Matches a string against a glob pattern supporting * and ? wildcards.
 */
function globMatch(pattern: string, str: string): boolean {
  let pi = 0, si = 0;
  let starPi = -1, starSi = -1;
  while (si < str.length) {
    if (pi < pattern.length && (pattern[pi] === str[si] || pattern[pi] === "?")) {
      pi++;
      si++;
    } else if (pi < pattern.length && pattern[pi] === "*") {
      starPi = pi++;
      starSi = si;
    } else if (starPi >= 0) {
      pi = starPi + 1;
      si = ++starSi;
    } else {
      return false;
    }
  }
  while (pi < pattern.length && pattern[pi] === "*") pi++;
  return pi === pattern.length;
}

/**
 * Validates a command against the configured whitelist.
 * Supports glob patterns (e.g. "echo*", "git*", "npm*").
 * Throws if the command is not allowed.
 */
function validateCommand(command: string, config: Config): void {
  const whitelist = config.tools?.commandWhitelist;
  if (!whitelist || whitelist.length === 0) {
    throw new Error("No commands are whitelisted. Configure tools.commandWhitelist in config.json.");
  }
  if (whitelist.includes("*")) return;
  const cmdName = command.trim().split(/\s+/)[0];
  if (!cmdName) {
    throw new Error("Empty command.");
  }
  const allowed = whitelist.some(pattern => globMatch(pattern, cmdName));
  if (!allowed) {
    throw new Error(`Command "${cmdName}" is not in the whitelist. Allowed: ${whitelist.join(", ")}`);
  }
}

/**
 * Creates a downloadable file and returns the URL path.
 */
async function handleCreateDownload(input: { filename: string; content: string }): Promise<string> {
  const filename = input.filename?.trim();
  const content = input.content ?? "";
  if (!filename) {
    return JSON.stringify({ success: false, error: "filename is required" });
  }
  const id = crypto.randomUUID().slice(0, 8);
  const dir = join(DOWNLOADS_DIR, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), content, "utf-8");
  const url = `/api/downloads/${id}/${encodeURIComponent(filename)}`;
  return JSON.stringify({ success: true, url, filename });
}

// ============================================
// Tool Registry types and helpers
// ============================================

export interface ToolRegistryEntry {
  definition: ReturnType<typeof tool>;
  handler: (args: any) => Promise<string>;
}

export type ToolRegistry = Record<string, ToolRegistryEntry>;

/**
 * Extracts just the tool definitions for passing to streamText({ tools }).
 */
export function getToolDefinitions(registry: ToolRegistry): Record<string, ReturnType<typeof tool>> {
  return Object.fromEntries(
    Object.entries(registry).map(([name, entry]) => [name, entry.definition]),
  );
}

/**
 * Executes a tool call from the registry by name.
 */
export async function executeRegistryTool(
  registry: ToolRegistry,
  toolName: string,
  args: any,
): Promise<string> {
  const entry = registry[toolName];
  if (!entry) {
    return JSON.stringify({ error: `Tool "${toolName}" not found` });
  }
  try {
    const raw = await entry.handler(args);
    return typeof raw === "string" ? raw : JSON.stringify(raw);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ============================================
// MAIN AI TOOLS (used by streamMessage in ai.ts)
// ============================================

/**
 * Creates the main AI tools with config bound.
 */
export function createMainTools(config: Config): ToolRegistry {
  return {
    get_active_agents: {
      definition: tool({
        description:
          "Gets a list of all currently active agents (both running and recently completed). Use this BEFORE starting a new agent to check if an agent with a similar task already exists. If a similar agent exists, use send_to_agent instead of creating a duplicate — completed agents are automatically resumed.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {},
        }),
      }),
      handler: async () => {
        try {
          const agents = getAllAgentsInfo();
          return JSON.stringify({
            success: true,
            agents: agents.map((a) => ({
              id: a.id,
              task: a.task,
              status: a.status,
            })),
          });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    start_agent: {
      definition: tool({
        description:
          "Starts a specialized sub-agent to handle complex tasks that require system access. IMPORTANT: Always call get_active_agents first to avoid creating duplicate agents. Use this for tasks like changing configuration, updating user profile, restarting the server, or any other system-level operations. The agent runs in the background and will automatically callback with its results when done — you do NOT need to poll or check for completion. Returns the agent ID which can be used to send messages to the running agent.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "The task description for the agent to complete",
            },
          },
          required: ["task"],
        }),
      }),
      handler: async (input: any) => {
        try {
          if (typeof input.task !== "string" || !input.task || !input.task.trim()) {
            return JSON.stringify({
              success: false,
              error: "Missing or invalid required field: task (must be a non-empty string)",
            });
          }
          runAgent(config, input.task).catch((error) => {
            console.error("Agent execution error:", error);
          });
          return JSON.stringify({
            success: true,
            message: "Agent started in background",
          });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    create_download: {
      definition: tool({
        description:
          "Creates a file available for download and returns a URL. Use this when the user asks you to generate a file (CSV, JSON, text, code, etc.) for download. Include the returned URL as a markdown link in your response, e.g. [Download filename](url).",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename including extension (e.g. 'data.csv', 'script.py')",
            },
            content: {
              type: "string",
              description: "The file content as text",
            },
          },
          required: ["filename", "content"],
        }),
      }),
      handler: handleCreateDownload,
    },

    send_to_agent: {
      definition: tool({
        description:
          "Sends a message to a sub-agent. For running agents, the message is delivered immediately. For completed agents, the agent is automatically resumed with your message.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            agent_id: {
              type: "string",
              description: "The ID of the agent to send the message to",
            },
            message: {
              type: "string",
              description: "The message to send to the agent",
            },
          },
          required: ["agent_id", "message"],
        }),
      }),
      handler: async (input: any) => {
        try {
          const agentInfo = getAgentInfo(input.agent_id);
          if (!agentInfo) {
            return JSON.stringify({
              success: false,
              error: "Agent not found. It may have been removed. Start a new agent with start_agent instead.",
            });
          }
          if (agentInfo.status === "completed") {
            resumeAgent(config, input.agent_id, input.message).catch((error) => {
              console.error("Agent resume error:", error);
            });
            return JSON.stringify({
              success: true,
              message: "Agent has been resumed with your message. It will send results when done.",
            });
          }
          const sent = sendToAgent(input.agent_id, input.message);
          if (sent) {
            return JSON.stringify({ success: true, message: "Message sent to agent" });
          } else {
            return JSON.stringify({ success: false, error: "Failed to send message to agent." });
          }
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },
  };
}

// ============================================
// AGENT TOOLS (used by runAgent in agent.ts)
// ============================================

export interface AgentToolContext {
  agentId: string;
  messagesToMain: string[];
  onAgentMessage?: (agentId: string, message: string) => void;
  onSendToMain?: (message: string, agentId: string) => void;
  agentMessages: string[];
  updateActivityTime: () => void;
}

/**
 * Creates agent tools with execution context bound.
 */
export function createAgentTools(config: Config, ctx: AgentToolContext): ToolRegistry {
  const registry: ToolRegistry = {
    get_config: {
      definition: tool({
        description: "Reads the current configuration including assistant name, model settings, and server configuration.",
        inputSchema: jsonSchema({ type: "object", properties: {} }),
      }),
      handler: async () => {
        const currentConfig = loadCurrentConfig();
        return JSON.stringify(currentConfig, null, 2);
      },
    },

    update_config: {
      definition: tool({
        description: "Updates the configuration. You can change assistant settings and model settings. Server settings cannot be modified. Only provide the fields you want to update.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            assistant: {
              type: "object",
              properties: { name: { type: "string", description: "The new name for the assistant" } },
            },
            models: {
              type: "object",
              properties: {
                default: { type: "string", description: "The default provider name to use" },
                providers: { type: "object", description: "Provider configurations keyed by name." },
              },
            },
          },
        }),
      }),
      handler: async (input: any) => {
        try {
          const { server, ...allowed } = input;
          saveConfig(allowed);
          return JSON.stringify({ success: true, message: "Configuration updated successfully" });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    restart_server: {
      definition: tool({
        description: "Restarts the server process so that configuration changes (like model switches) take effect. Call this after updating the config if the changes need to be applied immediately.",
        inputSchema: jsonSchema({ type: "object", properties: {} }),
      }),
      handler: async () => {
        setTimeout(() => {
          console.log("Restarting server...");
          process.exit(0);
        }, 1000);
        return JSON.stringify({ success: true, message: "Server will restart in 1 second" });
      },
    },

    get_user_profile: {
      definition: tool({
        description: "Reads the current user profile from USER.md. Returns the markdown content or empty string if no profile exists yet.",
        inputSchema: jsonSchema({ type: "object", properties: {} }),
      }),
      handler: async () => {
        try {
          const profile = loadUserProfile();
          return JSON.stringify({ success: true, content: profile || "" });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    save_user_profile: {
      definition: tool({
        description: "Saves the user profile as a markdown document to USER.md. IMPORTANT: Always call get_user_profile first to read the existing profile so you can merge new information instead of overwriting it.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            content: { type: "string", description: "The full markdown content of the user profile" },
          },
          required: ["content"],
        }),
      }),
      handler: async (input: any) => {
        try {
          saveUserProfile(input.content);
          return JSON.stringify({ success: true, message: "User profile saved successfully" });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    complete_first_run: {
      definition: tool({
        description: "Marks the first-run setup as complete. Call this after the onboarding quiz is finished and the user profile has been saved.",
        inputSchema: jsonSchema({ type: "object", properties: {} }),
      }),
      handler: async () => {
        try {
          saveConfig({ assistant: { first_run: false } } as any);
          return JSON.stringify({ success: true, message: "First run completed" });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    create_download: {
      definition: tool({
        description:
          "Creates a file available for download and returns a URL. Use this when the user asks you to generate a file (CSV, JSON, text, code, etc.) for download. Include the returned URL as a markdown link in your message to main, e.g. [Download filename](url).",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename including extension (e.g. 'data.csv', 'script.py')",
            },
            content: {
              type: "string",
              description: "The file content as text",
            },
          },
          required: ["filename", "content"],
        }),
      }),
      handler: handleCreateDownload,
    },

    send_to_main: {
      definition: tool({
        description: "Sends a message back to the main context. Use this to communicate your findings, results, or ask the user questions through the main assistant.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            message: { type: "string", description: "The message to send to the main context" },
          },
          required: ["message"],
        }),
      }),
      handler: async (input: any) => {
        const message = input.message?.trim();
        if (!message) {
          return JSON.stringify({ success: false, error: "Message cannot be empty" });
        }
        if (ctx.messagesToMain.length > 0 && ctx.messagesToMain[ctx.messagesToMain.length - 1] === message) {
          return JSON.stringify({ success: true, message: "Message already sent to main context" });
        }
        ctx.messagesToMain.push(message);
        ctx.agentMessages.push(message);
        ctx.updateActivityTime();
        if (ctx.onAgentMessage) {
          ctx.onAgentMessage(ctx.agentId, message);
        }
        try {
          if (ctx.onSendToMain) {
            ctx.onSendToMain(message, ctx.agentId);
          }
        } catch (err) {
          console.error(`Failed to send agent ${ctx.agentId} message to main:`, err);
          return JSON.stringify({ success: false, error: "Failed to queue message to main context" });
        }
        return JSON.stringify({ success: true, message: "Message queued to main context" });
      },
    },

    wait: {
      definition: tool({
        description: "Waits/sleeps for a specified number of seconds. Useful for debugging and testing agent behavior.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            seconds: { type: "number", description: "The number of seconds to wait" },
          },
          required: ["seconds"],
        }),
      }),
      handler: async (input: any) => {
        const seconds = input.seconds || 1;
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return JSON.stringify({ success: true, message: `Waited for ${seconds} seconds` });
      },
    },

    brave_search: {
      definition: tool({
        description: "Searches the web using Brave Search API. Returns top results with titles, URLs, and descriptions. Use this to look up current information, answer questions about recent events, or research topics.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to perform" },
            count: { type: "number", description: "Number of results to return (1-20, default 5)" },
          },
          required: ["query"],
        }),
      }),
      handler: async (input: any) => {
        try {
          const currentConfig = loadCurrentConfig();
          const apiKey = currentConfig.tools?.braveSearchApiKey;
          if (!apiKey) {
            return JSON.stringify({ success: false, error: "Brave Search API key not configured. Set tools.braveSearchApiKey in config.json." });
          }
          const count = Math.min(Math.max(input.count || 5, 1), 20);
          const params = new URLSearchParams({ q: input.query, count: count.toString() });
          const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey,
            },
          });
          if (!response.ok) {
            return JSON.stringify({ success: false, error: `Brave API error: ${response.status} ${response.statusText}` });
          }
          const data = await response.json() as any;
          const results = (data.web?.results || []).map((r: any) => ({
            title: r.title, url: r.url, description: r.description,
          }));
          return JSON.stringify({ success: true, query: input.query, results });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },

    web_fetch: {
      definition: tool({
        description: "Fetches content from a URL and returns the text. Useful for reading web pages, API responses, or downloading text content found via brave_search.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to fetch content from" },
            max_length: { type: "number", description: "Maximum number of characters to return (default 50000)" },
          },
          required: ["url"],
        }),
      }),
      handler: async (input: any) => {
        try {
          const url = input.url;
          const maxLength = input.max_length || 50000;
          const response = await fetch(url, {
            signal: AbortSignal.timeout(30000),
            headers: {
              "User-Agent": "Attache/1.0",
              "Accept": "text/html,application/json,text/plain,*/*",
            },
            redirect: "follow",
          });
          if (!response.ok) {
            return JSON.stringify({ success: false, error: `HTTP ${response.status} ${response.statusText}` });
          }
          const contentType = response.headers.get("content-type") || "";
          let text = await response.text();
          if (contentType.includes("text/html")) {
            text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
            text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
            text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");
            text = text.replace(/<br[^>]*\/?>/gi, "\n");
            text = text.replace(/<[^>]+>/g, "");
            text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
            text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
          }
          if (text.length > maxLength) {
            text = text.slice(0, maxLength) + "\n...[truncated]";
          }
          return JSON.stringify({ success: true, url, contentType, content: text });
        } catch (error: any) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    },
  };

  // Add MCP tools
  const mcpTools = mcpManager.getTools();
  Object.assign(registry, mcpTools);

  // Add filesystem tools if enabled
  if (config.tools?.filesystem) {
    Object.assign(registry, {
      list_directory: {
        definition: tool({
          description: "Lists files and directories at the given path. Returns names, types (file/directory), and sizes.",
          inputSchema: jsonSchema({
            type: "object",
            properties: { path: { type: "string", description: "The directory path to list" } },
            required: ["path"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.filesystem) {
              return JSON.stringify({ success: false, error: "Filesystem access is not enabled." });
            }
            const targetPath = resolve(input.path);
            validatePathWithinWorkingDir(targetPath, currentConfig);
            const entries = await readdir(targetPath, { withFileTypes: true });
            const items = await Promise.all(entries.map(async (entry) => {
              const fullPath = join(targetPath, entry.name);
              let size: number | undefined;
              if (entry.isFile()) {
                try { const s = await stat(fullPath); size = s.size; } catch {}
              }
              return { name: entry.name, type: entry.isDirectory() ? "directory" : "file", ...(size !== undefined && { size }) };
            }));
            return JSON.stringify({ success: true, path: targetPath, items });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },

      read_file: {
        definition: tool({
          description: "Reads the contents of a file and returns it as text.",
          inputSchema: jsonSchema({
            type: "object",
            properties: { path: { type: "string", description: "The file path to read" } },
            required: ["path"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.filesystem) {
              return JSON.stringify({ success: false, error: "Filesystem access is not enabled." });
            }
            const targetPath = resolve(input.path);
            validatePathWithinWorkingDir(targetPath, currentConfig);
            const content = await readFile(targetPath, "utf-8");
            return JSON.stringify({ success: true, path: targetPath, content });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },

      write_file: {
        definition: tool({
          description: "Writes content to a file. Creates the file if it doesn't exist, overwrites if it does.",
          inputSchema: jsonSchema({
            type: "object",
            properties: {
              path: { type: "string", description: "The file path to write to" },
              content: { type: "string", description: "The content to write to the file" },
            },
            required: ["path", "content"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.filesystem) {
              return JSON.stringify({ success: false, error: "Filesystem access is not enabled." });
            }
            const targetPath = resolve(input.path);
            validatePathWithinWorkingDir(targetPath, currentConfig);
            const dir = normalize(join(targetPath, ".."));
            await mkdir(dir, { recursive: true });
            await writeFile(targetPath, input.content, "utf-8");
            return JSON.stringify({ success: true, path: targetPath, message: "File written successfully" });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },

      create_directory: {
        definition: tool({
          description: "Creates a directory (and any necessary parent directories).",
          inputSchema: jsonSchema({
            type: "object",
            properties: { path: { type: "string", description: "The directory path to create" } },
            required: ["path"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.filesystem) {
              return JSON.stringify({ success: false, error: "Filesystem access is not enabled." });
            }
            const targetPath = resolve(input.path);
            validatePathWithinWorkingDir(targetPath, currentConfig);
            await mkdir(targetPath, { recursive: true });
            return JSON.stringify({ success: true, path: targetPath, message: "Directory created successfully" });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },

      delete_path: {
        definition: tool({
          description: "Deletes a file or directory (recursively).",
          inputSchema: jsonSchema({
            type: "object",
            properties: { path: { type: "string", description: "The file or directory path to delete" } },
            required: ["path"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.filesystem) {
              return JSON.stringify({ success: false, error: "Filesystem access is not enabled." });
            }
            const targetPath = resolve(input.path);
            validatePathWithinWorkingDir(targetPath, currentConfig);
            await rm(targetPath, { recursive: true, force: true });
            return JSON.stringify({ success: true, path: targetPath, message: "Deleted successfully" });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },

      move_path: {
        definition: tool({
          description: "Moves or renames a file or directory.",
          inputSchema: jsonSchema({
            type: "object",
            properties: {
              source: { type: "string", description: "The source path" },
              destination: { type: "string", description: "The destination path" },
            },
            required: ["source", "destination"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.filesystem) {
              return JSON.stringify({ success: false, error: "Filesystem access is not enabled." });
            }
            const sourcePath = resolve(input.source);
            const destPath = resolve(input.destination);
            validatePathWithinWorkingDir(sourcePath, currentConfig);
            validatePathWithinWorkingDir(destPath, currentConfig);
            const content = await readFile(sourcePath);
            const destDir = normalize(join(destPath, ".."));
            await mkdir(destDir, { recursive: true });
            await writeFile(destPath, content);
            await rm(sourcePath, { recursive: true, force: true });
            return JSON.stringify({ success: true, source: sourcePath, destination: destPath, message: "Moved successfully" });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },
    });
  }

  // Add terminal tools if enabled
  if (config.tools?.terminal) {
    Object.assign(registry, {
      run_command: {
        definition: tool({
          description: "Executes a shell command and returns stdout, stderr, and exit code. Commands run with a 60-second timeout.",
          inputSchema: jsonSchema({
            type: "object",
            properties: {
              command: { type: "string", description: "The shell command to execute" },
              cwd: { type: "string", description: "Working directory to run the command in (optional, defaults to server cwd)" },
            },
            required: ["command"],
          }),
        }),
        handler: async (input: any) => {
          try {
            const currentConfig = loadCurrentConfig();
            if (!currentConfig.tools?.terminal) {
              return JSON.stringify({ success: false, error: "Terminal access is not enabled." });
            }
            const command = input.command;
            validateCommand(command, currentConfig);
            const workingDir = currentConfig.tools?.workingDir ? resolve(expandHome(currentConfig.tools.workingDir)) : undefined;
            const cwd = input.cwd ? resolve(input.cwd) : workingDir;
            let shell = Bun.$`${{ raw: command }}`.quiet().nothrow();
            if (cwd) shell = shell.cwd(cwd);
            const result = await shell;
            const stdout = result.stdout.toString();
            const stderr = result.stderr.toString();
            const exitCode = result.exitCode;
            return JSON.stringify({
              success: exitCode === 0,
              exitCode,
              stdout: stdout.slice(0, 50_000),
              stderr: stderr.slice(0, 50_000),
            });
          } catch (error: any) {
            return JSON.stringify({ success: false, error: error.message });
          }
        },
      },
    });
  }

  // Wrap handlers to log usage to agent activity (except send_to_main which handles its own logging)
  for (const [name, entry] of Object.entries(registry)) {
    if (name === "send_to_main") continue;
    const originalHandler = entry.handler;
    entry.handler = async (args: any) => {
      const toolDesc = `🔧 Tool: ${name}`;
      ctx.agentMessages.push(toolDesc);
      ctx.updateActivityTime();
      if (ctx.onAgentMessage) {
        ctx.onAgentMessage(ctx.agentId, toolDesc);
      }
      return originalHandler(args);
    };
  }

  return registry;
}
