import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SERVICE_PATH = join(homedir(), ".config", "systemd", "user", "attache.service");
const isSystemdService = !!process.env.INVOCATION_ID;

// If a systemd service exists and we're NOT already running as that service,
// delegate to systemctl instead of starting directly
if (!isSystemdService && existsSync(SERVICE_PATH)) {
  // Check if already running — restart instead of start
  const isActive = Bun.spawnSync(["systemctl", "--user", "is-active", "attache"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const action = isActive.stdout.toString().trim() === "active" ? "restart" : "start";
  const label = action === "restart" ? "Restarting" : "Starting";

  console.log(`  ${label} Attaché via systemd...`);
  const proc = Bun.spawnSync(["systemctl", "--user", action, "attache"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    console.error(`  Failed to ${action} service. Starting directly instead...\n`);
  } else {
    console.log(`  Attaché service ${action === "restart" ? "restarted" : "started"}.`);
    console.log("  View logs: journalctl --user -u attache -f");
    process.exit(0);
  }
}

// Ensure frontend is downloaded and matches the current version
const { downloadDist } = await import("./download-dist.ts");
await downloadDist();

const { startServer } = await import("../backend/index.ts");
await startServer();
