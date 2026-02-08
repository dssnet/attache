import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, "attache.service.template");
const SERVICE_DIR = join(homedir(), ".config", "systemd", "user");
export const SERVICE_PATH = join(SERVICE_DIR, "attache.service");

export function renderServiceUnit(): string | null {
  const attachePath = Bun.which("attache");
  if (!attachePath) {
    console.log("  Could not find attache in PATH. Skipping systemd service.");
    return null;
  }

  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  return template
    .replace("{{ATTACHE_PATH}}", attachePath)
    .replace("{{PATH}}", process.env.PATH || "/usr/bin:/bin");
}

export function writeServiceUnit(unit: string): void {
  mkdirSync(SERVICE_DIR, { recursive: true });
  writeFileSync(SERVICE_PATH, unit, "utf-8");
}

export function currentServiceUnit(): string | null {
  try {
    return readFileSync(SERVICE_PATH, "utf-8");
  } catch {
    return null;
  }
}

export function serviceExists(): boolean {
  return existsSync(SERVICE_PATH);
}

export function daemonReload(): void {
  Bun.spawnSync(["systemctl", "--user", "daemon-reload"], {
    stdout: "ignore",
    stderr: "ignore",
  });
}
