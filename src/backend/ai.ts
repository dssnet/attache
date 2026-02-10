import { streamText, type ModelMessage } from "ai";
import type { Config } from "./config.ts";
import type { Message } from "./context.ts";
import { loadUserProfile } from "./user-profile.ts";
import { createModel } from "./adapters.ts";
import { createMainTools, getToolDefinitions, executeRegistryTool } from "./tools.ts";

/**
 * Generates the system prompt for the AI
 */
function getSystemPrompt(config: Config): string {
  const userProfile = loadUserProfile();

  const now = new Date();
  const dateStr = now.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  let prompt = `You are ${config.assistant.name}, a personal AI assistant.
Current date and time: ${dateStr}, ${timeStr}

Your tools:
- get_active_agents — list running/completed agents
- start_agent — spawn a sub-agent for a task (agents have filesystem, terminal, web access)
- send_to_agent — message an existing agent
- create_download — create a downloadable file from content you generate

## Rules
1. For ANY request beyond casual chat, use tool calls. You have NO direct system access — tools are your only way to act.
2. Always call get_active_agents before starting a new agent. Reuse existing agents via send_to_agent when possible (completed agents auto-resume).
3. Start agents immediately — don't ask the user for permission.
4. Never poll agents after starting them. They call back automatically when done.
5. The user CANNOT see agent messages. Always relay agent results to the user in your own words.
6. When you see "[An agent sent the above information...]", relay the most recent agent message to the user naturally.
7. Use create_download directly when you can generate the file content yourself (e.g. writing a CSV, code, or text). For files that need to be read from disk, start an agent — agents also have create_download and can read files then create downloads.
8. Include download URLs as markdown links: [Download filename](url).

Text-only responses are only appropriate for casual greetings, relaying agent results, or describing your capabilities.`;

  // Add MCP servers info from config
  const mcpServers = config.mcpServers;
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    prompt += `\n\n## Connected MCP Servers\nYour sub-agents have access to tools from the following MCP servers:\n`;
    for (const [name, server] of Object.entries(mcpServers)) {
      const desc = server.description ? ` — ${server.description}` : "";
      prompt += `- **${name}** (${server.type})${desc}\n`;
    }
    prompt += `\nWhen a user's request could benefit from an MCP server's capabilities, start an agent to use those tools.`;
  }

  if (userProfile) {
    prompt += `

## User Profile
The following is what you know about your user. Adapt your communication style and personality accordingly:

${userProfile}`;
  }

  if (config.assistant.first_run) {
    prompt += `

## First Run — Onboarding
This is your first conversation. Ask these questions ONE AT A TIME (wait for each answer):

1. "What's your name?"
2. "What should I call myself? My current name is ${config.assistant.name} — want to change it?"
3. "How should I talk to you? (casual, formal, playful, professional, sarcastic...)"
4. "What personality traits should I have? (witty, calm, enthusiastic, dry humor, encouraging...)"

After all answers, use start_agent to save the user profile, update the name if changed, and mark first-run as complete.`;
  }

  return prompt;
}

/**
 * Stream event types — this is the contract with websocket.ts
 */
export type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "split" }
  | { type: "tool_use"; toolName: string; toolInput: Record<string, any> };

/**
 * Sends a message to the AI and returns a stream of events.
 * Uses Vercel AI SDK streamText with manual tool execution loop.
 */
export async function* streamMessage(
  config: Config,
  messages: Message[],
  userMessage: string,
): AsyncGenerator<StreamEvent, void, unknown> {
  const providerName = config.models.default;
  const provider = config.models.providers[providerName];

  if (!provider) {
    throw new Error(`Provider ${providerName} not found in config`);
  }

  const model = createModel(provider);
  const systemPrompt = getSystemPrompt(config);
  const toolRegistry = createMainTools(config);
  const toolDefs = getToolDefinitions(toolRegistry);

  // Convert Attaché messages to Vercel AI SDK ModelMessage format
  const coreMessages: ModelMessage[] = [
    ...messages.map((msg) => ({
      role: (msg.role === "agent" ? "assistant" : msg.role) as "user" | "assistant",
      content:
        msg.role === "agent"
          ? `[Response from agent ${msg.agentId ?? "unknown"}]\n${msg.content}`
          : msg.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  // Manual tool execution loop
  let hasAgentToolInCycle = false;
  const MAX_ITERATIONS = 20;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      tools: toolDefs,
      temperature: provider.temperature,
    });

    let currentText = "";
    const toolCalls: Array<{ id: string; name: string; input: any }> = [];

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          const delta = (part as any).textDelta ?? (part as any).text ?? "";
          if (config.debug?.logTokens) process.stdout.write(delta);
          if (delta) {
            currentText += delta;
            yield { type: "chunk", text: delta };
          }
          break;
        }

        case "tool-call": {
          const input = (part as any).input ?? (part as any).args ?? {};
          toolCalls.push({
            id: part.toolCallId,
            name: part.toolName,
            input,
          });

          if (config.debug?.logTokens)
            process.stdout.write(`\n[tool_use: ${part.toolName}] ${JSON.stringify(input)}`);
          yield { type: "tool_use", toolName: part.toolName, toolInput: input };

          if (part.toolName === "start_agent") {
            hasAgentToolInCycle = true;
          }
          break;
        }

        case "error": {
          const errorMsg = part.error instanceof Error ? part.error.message : String(part.error);
          console.error("AI stream error:", errorMsg);
          yield { type: "chunk", text: `\n\n**Error:** ${errorMsg}` };
          break;
        }
      }
    }

    // No tool calls — done
    if (toolCalls.length === 0) break;

    // Add assistant message with tool calls to history
    coreMessages.push({
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

    // Execute each tool and add results to history
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
    coreMessages.push({
      role: "tool",
      content: toolResults,
    });

    // Emit split if an agent was started in this cycle
    if (hasAgentToolInCycle) {
      yield { type: "split" };
      hasAgentToolInCycle = false;
    }
  }
}
