import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Config, ProviderConfig } from "../backend/config.ts";

const ATTACHE_DIR = join(homedir(), ".attache");
const CONFIG_PATH = join(ATTACHE_DIR, "config.json");

// --- Prompt helpers ---

function promptRequired(message: string, fallback?: string): string {
  const suffix = fallback ? ` (${fallback})` : "";
  while (true) {
    const answer = prompt(`  ${message}${suffix}:`) ?? "";
    const value = answer.trim() || fallback || "";
    if (value) return value;
    console.log("  This field is required.");
  }
}

function promptOptional(message: string, fallback: string): string {
  const answer = prompt(`  ${message} (${fallback}):`) ?? "";
  return answer.trim() || fallback;
}

function promptYesNo(message: string, fallback: boolean): boolean {
  const hint = fallback ? "Y/n" : "y/N";
  const answer = prompt(`  ${message} (${hint}):`) ?? "";
  const val = answer.trim().toLowerCase();
  if (!val) return fallback;
  return val.startsWith("y");
}

function promptChoice(message: string, choices: { label: string; value: string }[], defaultValue: string): string {
  console.log(`\n  ${message}`);
  for (let i = 0; i < choices.length; i++) {
    const marker = choices[i]!.value === defaultValue ? " (default)" : "";
    console.log(`    ${i + 1}. ${choices[i]!.label}${marker}`);
  }
  const defaultIndex = choices.findIndex((c) => c.value === defaultValue) + 1;
  const answer = promptOptional("Choose", String(defaultIndex));
  const index = parseInt(answer, 10) - 1;
  if (index >= 0 && index < choices.length) {
    return choices[index]!.value;
  }
  return defaultValue;
}

// --- Token generation ---

function generateAuthToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Provider presets ---

const PROVIDER_CHOICES = [
  { label: "Anthropic (Claude)", value: "claude" },
  { label: "OpenAI", value: "openai" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Custom OpenAI-compatible", value: "custom" },
];

const PROVIDER_DEFAULTS: Record<string, { type: ProviderConfig["type"]; apiUrl?: string; model: string }> = {
  claude: { type: "claude", model: "claude-sonnet-4-20250514" },
  openai: { type: "openai", model: "gpt-4o" },
  openrouter: { type: "custom-openai", apiUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4-20250514" },
  custom: { type: "custom-openai", model: "" },
};

function configureProvider(): { name: string; config: ProviderConfig } {
  const providerType = promptChoice("Select your AI provider:", PROVIDER_CHOICES, "claude");
  const preset = PROVIDER_DEFAULTS[providerType]!;

  const apiKey = promptRequired("API key");

  let apiUrl = preset.apiUrl;
  if (preset.type === "custom-openai" && !apiUrl) {
    apiUrl = promptRequired("API base URL (e.g. https://api.example.com/v1)");
  }

  const model = promptRequired("Model name", preset.model || undefined);
  const maxTokens = parseInt(promptOptional("Max tokens", "8192"), 10) || 8192;

  const providerConfig: ProviderConfig = {
    type: preset.type,
    apiKey,
    model,
    maxTokens,
    temperature: 1.0,
  };

  if (apiUrl) {
    providerConfig.apiUrl = apiUrl;
  }

  const name = providerType === "custom"
    ? promptOptional("Provider name (used as config key)", "custom")
    : providerType;

  return { name, config: providerConfig };
}

// --- Systemd service ---

import { renderServiceUnit, writeServiceUnit, daemonReload, SERVICE_PATH } from "./service.ts";

function installSystemdService(): void {
  const unit = renderServiceUnit();
  if (!unit) return;

  writeServiceUnit(unit);
  daemonReload();
  console.log(`  Service file written to ${SERVICE_PATH}`);

  // Enable the service
  const enable = Bun.spawnSync(["systemctl", "--user", "enable", "attache"], {
    stdout: "inherit",
    stderr: "inherit",
  });

  if (enable.exitCode === 0) {
    console.log("  Service enabled. Starting...");
    const start = Bun.spawnSync(["systemctl", "--user", "start", "attache"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    if (start.exitCode === 0) {
      console.log("  Service started.");
      console.log("  View logs: journalctl --user -u attache -f");
    } else {
      console.log("  Could not start service. Start manually with:");
      console.log("    systemctl --user start attache");
    }
  } else {
    console.log("  Could not enable service. You can enable it manually:");
    console.log("    systemctl --user enable --now attache");
  }
}

// --- Main wizard ---

console.log("");
console.log("  ╔═══════════════════════════════════════╗");
console.log("  ║       Attache Setup Wizard            ║");
console.log("  ╚═══════════════════════════════════════╝");
console.log("");

// Check for existing config
if (existsSync(CONFIG_PATH)) {
  const overwrite = promptYesNo("config.json already exists. Overwrite?", false);
  if (!overwrite) {
    console.log("  Setup cancelled. Existing config preserved.");
    process.exit(0);
  }
  console.log("");
}

// Step 1: Provider
console.log("  ── Step 1: AI Provider ──────────────────");
const provider = configureProvider();

// Step 2: Server
console.log("\n  ── Step 2: Server ───────────────────────");
const port = parseInt(promptOptional("Port", "3000"), 10) || 3000;
const host = promptOptional("Host", "127.0.0.1");

// Step 3: Auth token
console.log("\n  ── Step 3: Authentication ───────────────");
const authToken = generateAuthToken();
console.log(`  Generated auth token: ${authToken}`);
console.log("  Save this token — you need it to log in.");

// Step 4: Assistant name
console.log("\n  ── Step 4: Assistant ────────────────────");
const assistantName = promptOptional("Assistant name", "Attache");

// Build config
const config: Config = {
  models: {
    default: provider.name,
    providers: {
      [provider.name]: provider.config,
    },
  },
  assistant: {
    name: assistantName,
    first_run: true,
  },
  server: {
    port,
    host,
    authToken,
  },
  tools: {
    braveSearchApiKey: "",
    filesystem: false,
    terminal: false,
    workingDir: "",
    limitWorkingDir: true,
    commandWhitelist: [],
  },
  debug: {
    logTokens: false,
  },
};

// Write config
mkdirSync(ATTACHE_DIR, { recursive: true });
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

console.log(`\n  Config written to ${CONFIG_PATH}`);

// Step 5: Systemd service (Linux only)
if (process.platform === "linux") {
  console.log("\n  ── Step 5: Systemd Service ──────────────");
  const wantService = promptYesNo("Install as a systemd user service?", false);
  if (wantService) {
    installSystemdService();
  }
}

// Done
console.log("\n  ════════════════════════════════════════");
console.log("  Setup complete!");
console.log("");
console.log("  To start Attache:");
console.log("    attache start");
console.log("");
console.log(`  Then open http://${host}:${port}`);
console.log("  and log in with your auth token.");
console.log("  ════════════════════════════════════════\n");
