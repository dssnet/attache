import { provide, inject, type Ref, type InjectionKey } from "vue";

export interface Config {
  models: {
    default: string;
    providers: Record<
      string,
      {
        type: string;
        apiUrl: string;
        apiKey: string;
        model: string;
        maxTokens: number;
        temperature: number;
      }
    >;
  };
  assistant: {
    name: string;
    first_run: boolean;
  };
  server: {
    port: number;
    host: string;
    authToken: string;
  };
  tools?: {
    braveSearchApiKey?: string;
    filesystem?: boolean;
    terminal?: boolean;
    workingDir?: string;
    limitWorkingDir?: boolean;
    commandWhitelist?: string[];
  };
  mcpServers?: Record<
    string,
    {
      type: "sse" | "stdio";
      description?: string;
      url?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      headers?: Record<string, string>;
      oauth?: {
        clientId: string;
        clientSecret: string;
        tokenUrl: string;
        scopes?: string[];
      };
    }
  >;
  memory?: {
    type: "bm25" | "vector";
    embedding?: {
      apiUrl: string;
      apiKey: string;
      model: string;
    };
  };
}

export interface McpStatusItem {
  name: string;
  status: string;
  toolCount: number;
  description?: string;
  error?: string;
}

export interface ConfigContext {
  config: Ref<Config | null>;
  configSaving: Ref<boolean>;
  mcpStatus: Ref<McpStatusItem[]>;
  getConfig: () => void;
  updateConfig: (partial: Partial<Config>) => void;
  getMcpStatus: () => void;
  restartServer: () => void;
}

const CONFIG_KEY: InjectionKey<ConfigContext> = Symbol("config");

export function provideConfig(context: ConfigContext) {
  provide(CONFIG_KEY, context);
}

export function useConfig(): ConfigContext {
  const context = inject(CONFIG_KEY);
  if (!context) {
    throw new Error("useConfig() requires provideConfig() in an ancestor component");
  }
  return context;
}
