import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "../..");
const REPO = "dssnet/attache";
const REPO_URL = "https://github.com/dssnet/attache";

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  available: boolean;
}

let cachedUpdate: UpdateInfo | null = null;
let upgradeInProgress = false;

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function getCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = getCurrentVersion();

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) {
      return cachedUpdate ?? { currentVersion, latestVersion: currentVersion, available: false };
    }

    const release: { tag_name: string } = await res.json();
    const latestVersion = release.tag_name.replace(/^v/, "");
    const available = `v${currentVersion}` !== release.tag_name;

    cachedUpdate = { currentVersion, latestVersion, available };
    return cachedUpdate;
  } catch {
    return cachedUpdate ?? { currentVersion, latestVersion: currentVersion, available: false };
  }
}

export function getCachedUpdate(): UpdateInfo | null {
  return cachedUpdate;
}

export async function performUpgrade(
  onProgress: (step: string) => void,
): Promise<void> {
  if (upgradeInProgress) {
    throw new Error("Upgrade already in progress");
  }

  upgradeInProgress = true;

  try {
    const currentVersion = getCurrentVersion();

    onProgress("Fetching latest version...");
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) {
      throw new Error(`Failed to fetch latest release: ${res.status} ${res.statusText}`);
    }

    const release: { tag_name: string } = await res.json();
    const tag = release.tag_name;

    if (tag === `v${currentVersion}`) {
      throw new Error("Already up to date");
    }

    onProgress("Removing current installation...");
    const removeProc = Bun.spawn(["bun", "remove", "-g", "attache"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await removeProc.exited;

    onProgress(`Installing Attaché ${tag}...`);
    const installProc = Bun.spawn(["bun", "install", "-g", `${REPO_URL}#${tag}`], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const installExit = await installProc.exited;
    if (installExit !== 0) {
      throw new Error("Installation failed");
    }

    onProgress("Running migrations...");
    const migrateProc = Bun.spawn(["attache", "migrate"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await migrateProc.exited;

    // Update systemd service if needed
    try {
      const { serviceExists, renderServiceUnit, currentServiceUnit, writeServiceUnit, daemonReload } = await import("../cli/service.ts");
      if (serviceExists()) {
        const newUnit = renderServiceUnit();
        const oldUnit = currentServiceUnit();
        if (newUnit && newUnit !== oldUnit) {
          onProgress("Updating systemd service...");
          writeServiceUnit(newUnit);
          daemonReload();
        }
      }
    } catch {
      // Service module may not be available
    }

    onProgress("Upgrade complete. Restarting...");
  } finally {
    upgradeInProgress = false;
  }
}

// Periodic update checking
let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicCheck(onUpdate: (info: UpdateInfo) => void) {
  // Initial check after 30s delay
  setTimeout(async () => {
    const info = await checkForUpdate();
    if (info.available) onUpdate(info);
  }, 30_000);

  checkInterval = setInterval(async () => {
    const info = await checkForUpdate();
    if (info.available) onUpdate(info);
  }, CHECK_INTERVAL_MS);
}

export function stopPeriodicCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
