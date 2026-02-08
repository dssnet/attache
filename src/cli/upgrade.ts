import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "../..");

const REPO = "dssnet/attache";
const REPO_URL = "https://github.com/dssnet/attache";

console.log("\n  Upgrading Attaché...\n");

// Get current installed version
let currentVersion: string | null = null;
try {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8"));
  currentVersion = pkg.version || null;
} catch {}

if (currentVersion) {
  console.log(`  Current version: v${currentVersion}`);
}

// Fetch the latest release tag
console.log("  Fetching latest version...");
const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
if (!res.ok) {
  console.error(`  Failed to fetch latest release: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const release: { tag_name: string } = await res.json();
const tag = release.tag_name;
console.log(`  Latest version: ${tag}\n`);

// Compare versions — skip if already up to date
if (currentVersion && tag === `v${currentVersion}`) {
  console.log("  Already up to date.\n");
  process.exit(0);
}

// Remove existing global install to avoid dependency loop
console.log("  Removing current installation...");
Bun.spawnSync(["bun", "remove", "-g", "attache"], {
  stdout: "ignore",
  stderr: "ignore",
});

// Install from the specific tag
console.log(`  Installing Attaché ${tag}...`);
const proc = Bun.spawnSync(["bun", "install", "-g", `${REPO_URL}#${tag}`], {
  stdout: "inherit",
  stderr: "inherit",
});

if (proc.exitCode !== 0) {
  console.error("  Upgrade failed.");
  process.exit(1);
}

// Restart systemd service if it exists
import { existsSync } from "fs";
import { homedir } from "os";

const servicePath = join(homedir(), ".config", "systemd", "user", "attache.service");
if (existsSync(servicePath)) {
  console.log("\n  Restarting service...");
  const restart = Bun.spawnSync(["systemctl", "--user", "restart", "attache"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (restart.exitCode === 0) {
    console.log("  Service restarted.");
  } else {
    console.log("  Could not restart service. Restart manually with:");
    console.log("    systemctl --user restart attache");
  }
}

console.log("\n  Upgrade complete.\n");
