import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderConfig } from "./config.ts";
import type { LanguageModelV3 } from "@ai-sdk/provider";

/**
 * Creates a Vercel AI SDK LanguageModel from a provider config.
 */
export function createModel(provider: ProviderConfig): LanguageModelV3 {
  switch (provider.type) {
    case "claude": {
      const anthropic = createAnthropic({ apiKey: provider.apiKey });
      return anthropic(provider.model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: provider.apiKey });
      return openai(provider.model);
    }
    case "custom-openai": {
      if (!provider.apiUrl) {
        throw new Error("Custom OpenAI provider requires apiUrl");
      }
      const custom = createOpenAICompatible({
        name: "custom-openai",
        apiKey: provider.apiKey,
        baseURL: provider.apiUrl,
      });
      return custom(provider.model);
    }
    default:
      throw new Error(`Unsupported provider type: ${(provider as any).type}`);
  }
}
