import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

let cachedConfigPath: string | null = null;

export interface ProviderConfig {
  type: "claude" | "openai" | "custom-openai";
  apiKey: string;
  apiUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface McpOAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
}

export interface McpServerConfig {
  type: "sse" | "stdio";
  description?: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  oauth?: McpOAuthConfig;
}

export interface Config {
  models: {
    default: string;
    providers: Record<string, ProviderConfig>;
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
  mcpServers?: Record<string, McpServerConfig>;
  debug?: {
    logTokens?: boolean;
  };
}

/**
 * Substitutes environment variables in the format ${VAR_NAME}
 */
function substituteEnvVars(obj: any): any {
  if (typeof obj === "string") {
    return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || "";
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }

  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }

  return obj;
}

/**
 * Gets the config file path
 * Looks in current directory first, then ~/.attache
 */
function getConfigPath(): string {
  if (cachedConfigPath) {
    return cachedConfigPath;
  }

  const configPaths = [
    join(process.cwd(), "config.json"),
    join(homedir(), ".attache", "config.json"),
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      cachedConfigPath = path;
      return path;
    }
  }

  throw new Error(
    `Config file not found. Searched in:\n${configPaths.map((p) => `  - ${p}`).join("\n")}`,
  );
}

/**
 * Loads configuration from config.json
 * Looks in current directory first, then ~/.attache
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  const configText = readFileSync(configPath, "utf-8");
  const rawConfig = JSON.parse(configText);
  const config = substituteEnvVars(rawConfig) as Config;

  return config;
}

/**
 * Deep merges source into target, preserving nested objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null) {
      delete result[key];
    } else if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Saves configuration to config.json
 * Note: Environment variables in the config should remain as ${VAR_NAME}
 */
export function saveConfig(config: Partial<Config>): void {
  const configPath = getConfigPath();

  // Load current config without env substitution
  const currentConfigText = readFileSync(configPath, "utf-8");
  const currentConfig = JSON.parse(currentConfigText);

  // Deep merge to preserve nested fields like env vars in providers
  const updatedConfig = deepMerge(currentConfig, config);

  // Save back to file
  writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), "utf-8");
  console.log(`Config saved to: ${configPath}`);
}
