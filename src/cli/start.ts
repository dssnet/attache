import { existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "../../dist");
const SERVICE_PATH = join(homedir(), ".config", "systemd", "user", "attache.service");
const isSystemdService = !!process.env.INVOCATION_ID;

// If a systemd service exists and we're NOT already running as that service,
// delegate to systemctl instead of starting directly
if (!isSystemdService && existsSync(SERVICE_PATH)) {
  console.log("  Starting Attaché via systemd...");
  const proc = Bun.spawnSync(["systemctl", "--user", "start", "attache"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    console.error("  Failed to start service. Starting directly instead...\n");
  } else {
    console.log("  Attaché service started.");
    console.log("  View logs: journalctl --user -u attache -f");
    process.exit(0);
  }
}

// Download frontend if missing (e.g. postinstall was blocked)
if (!existsSync(join(DIST_DIR, "index.html"))) {
  console.log("  Frontend not found. Downloading...\n");
  const { downloadDist } = await import("./download-dist.ts");
  await downloadDist();
  console.log("");
}

const { startServer } = await import("../backend/index.ts");
await startServer();
