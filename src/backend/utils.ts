import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const ATTACHE_DIR = join(homedir(), ".attache");

/**
 * Ensures the ~/.attache directory exists
 */
export function ensureAttacheDir() {
  if (!existsSync(ATTACHE_DIR)) {
    mkdirSync(ATTACHE_DIR, { recursive: true });
  }
}

/**
 * Expands ~ to the user's home directory
 */
export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(1));
  }
  return p;
}

/**
 * Restarts the server by exiting the process.
 * In production, systemd (Restart=always) handles the restart.
 * In dev, the restart loop in dev:backend handles it.
 */
export function triggerRestart() {
  setTimeout(() => process.exit(0), 1000);
}

