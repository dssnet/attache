import { generateText, type ModelMessage } from "ai";
import type { Config } from "./config.ts";
import type { ProviderConfig } from "./config.ts";
import type { Message } from "./context.ts";
import { createModel } from "./adapters.ts";

/**
 * Rough token estimate: ~4 characters per token for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimates total tokens across all messages in the context.
 */
export function estimateContextTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

/**
 * Returns true when estimated context tokens exceed 80% of maxTokens.
 */
export function shouldAutoCompact(messages: Message[], maxTokens: number): boolean {
  if (messages.length < 4) return false;
  return estimateContextTokens(messages) > maxTokens * 0.8;
}

const COMPACT_PROMPT = `You are a conversation summarizer. Condense the following conversation into a concise summary that preserves:

- Key facts and information shared
- Decisions made and their reasoning
- User preferences and personal details mentioned
- Ongoing tasks and their current status
- Any important context needed to continue the conversation naturally

Write the summary as a neutral third-person narrative. Be thorough but concise. Do NOT use bullet points — write flowing paragraphs. Start directly with the summary content, no preamble.`;

/**
 * Compacts the conversation by summarizing it via the AI provider.
 * Returns the summary text.
 */
export async function compactMessages(config: Config, messages: Message[]): Promise<string> {
  const providerName = config.models.default;
  const provider = config.models.providers[providerName];

  if (!provider) {
    throw new Error(`Provider ${providerName} not found in config`);
  }

  const model = createModel(provider);

  const conversationText = messages
    .map((msg) => {
      const role = msg.role === "agent" ? "Agent" : msg.role === "user" ? "User" : "Assistant";
      return `[${role}]: ${msg.content}`;
    })
    .join("\n\n");

  // Truncate to ~80% of maxTokens (in chars, at ~4 chars/token) leaving room for system prompt + output
  const maxChars = Math.floor(provider.maxTokens * 0.8) * 4;
  const truncated = conversationText.length > maxChars
    ? conversationText.slice(0, maxChars / 2) + "\n\n[...middle truncated...]\n\n" + conversationText.slice(-maxChars / 2)
    : conversationText;

  const { text } = await generateText({
    model,
    system: COMPACT_PROMPT,
    messages: [{ role: "user", content: truncated }],
    maxOutputTokens: Math.min(provider.maxTokens, 2048),
    temperature: 0.3,
  });

  return text;
}

/**
 * Extracts text content from a ModelMessage for token estimation.
 */
function extractMessageText(msg: ModelMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part: any) => {
        if (part.type === "text") return part.text || "";
        if (part.type === "tool-call") return JSON.stringify(part.input || {});
        if (part.type === "tool-result") return typeof part.output === "string" ? part.output : (part.output?.value || "");
        return "";
      })
      .join(" ");
  }
  return "";
}

/**
 * Estimates total tokens for agent ModelMessage[] conversation history.
 */
export function estimateAgentTokens(messages: ModelMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(extractMessageText(msg)), 0);
}

/**
 * Returns true when agent conversation tokens exceed 80% of maxTokens.
 */
export function shouldAutoCompactAgent(messages: ModelMessage[], maxTokens: number): boolean {
  if (messages.length < 6) return false;
  return estimateAgentTokens(messages) > maxTokens * 0.8;
}

const AGENT_COMPACT_PROMPT = `You are summarizing an AI agent's work-in-progress conversation. Condense the conversation into a concise summary that preserves:

- The original task the agent was given
- All actions taken so far and their results
- Key findings, file contents, or data discovered
- Current progress and what remains to be done
- Any errors encountered and how they were handled

Write the summary as a factual narrative. Be thorough but concise. Start directly with the summary content, no preamble.`;

/**
 * Compacts an agent's conversation history by summarizing it.
 * Returns a new ModelMessage[] with just the summary as context.
 */
export async function compactAgentMessages(
  provider: ProviderConfig,
  messages: ModelMessage[],
): Promise<ModelMessage[]> {
  const model = createModel(provider);

  const conversationText = messages
    .map((msg) => {
      const role = msg.role === "tool" ? "Tool Result" : msg.role === "user" ? "User" : "Assistant";
      return `[${role}]: ${extractMessageText(msg)}`;
    })
    .join("\n\n");

  // Truncate to ~80% of maxTokens (in chars, at ~4 chars/token) leaving room for system prompt + output
  const maxChars = Math.floor(provider.maxTokens * 0.8) * 4;
  const truncated = conversationText.length > maxChars
    ? conversationText.slice(0, maxChars / 2) + "\n\n[...middle truncated...]\n\n" + conversationText.slice(-maxChars / 2)
    : conversationText;

  const { text } = await generateText({
    model,
    system: AGENT_COMPACT_PROMPT,
    messages: [{ role: "user", content: truncated }],
    maxOutputTokens: Math.min(provider.maxTokens, 2048),
    temperature: 0.3,
  });

  return [
    {
      role: "user",
      content: `[Previous conversation summary]\n${text}\n\nContinue working on the task. Use the summary above as context for what has been done so far.`,
    },
  ];
}
