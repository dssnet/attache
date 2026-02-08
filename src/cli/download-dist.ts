import { existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "../..");
const DIST_DIR = join(PACKAGE_ROOT, "dist");
const REPO = "dssnet/attache";

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export async function downloadDist(force = false): Promise<void> {
  if (!force && existsSync(join(DIST_DIR, "index.html"))) {
    console.log("Frontend already exists, skipping download.");
    return;
  }

  console.log("Fetching latest release...");
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) {
    throw new Error(`Failed to fetch release info: ${res.status} ${res.statusText}`);
  }

  const release: GitHubRelease = await res.json();
  const asset = release.assets.find((a) => a.name === "dist.tar.gz");
  if (!asset) {
    throw new Error(`No dist.tar.gz found in release ${release.tag_name}`);
  }

  console.log(`Downloading frontend from ${release.tag_name}...`);
  const download = await fetch(asset.browser_download_url);
  if (!download.ok) {
    throw new Error(`Failed to download: ${download.status} ${download.statusText}`);
  }

  // Clean existing dist
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });

  // Extract tarball
  const tarball = await download.arrayBuffer();
  const tarPath = join(PACKAGE_ROOT, "dist.tar.gz");
  await Bun.write(tarPath, tarball);

  const proc = Bun.spawnSync(["tar", "-xzf", tarPath, "-C", PACKAGE_ROOT], {
    cwd: PACKAGE_ROOT,
  });

  // Clean up tarball
  rmSync(tarPath, { force: true });

  if (proc.exitCode !== 0) {
    throw new Error(`Failed to extract dist.tar.gz: ${proc.stderr.toString()}`);
  }

  console.log("Frontend downloaded successfully.");
}

// Run directly as postinstall script
if (import.meta.main) {
  downloadDist().catch((err: unknown) => {
    console.error("Failed to download frontend:", err);
    // Don't exit with error code for postinstall — the server can still work
    // if the user builds the frontend manually
    console.log("You can build the frontend manually with: bun run build:frontend");
  });
}
