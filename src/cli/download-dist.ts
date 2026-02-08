import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
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

function getInstalledVersion(): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8"));
    return pkg.version || null;
  } catch {
    return null;
  }
}

async function fetchRelease(tag?: string): Promise<GitHubRelease> {
  const url = tag
    ? `https://api.github.com/repos/${REPO}/releases/tags/v${tag}`
    : `https://api.github.com/repos/${REPO}/releases/latest`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch release info: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function downloadDist(force = false): Promise<void> {
  if (!force && existsSync(join(DIST_DIR, "index.html"))) {
    console.log("Frontend already exists, skipping download.");
    return;
  }

  // During postinstall, download the dist matching the installed version
  // During upgrade (force=true), this is called after bun install so version is already updated
  const version = getInstalledVersion();
  let release: GitHubRelease;

  if (version) {
    console.log(`Fetching release for v${version}...`);
    try {
      release = await fetchRelease(version);
    } catch {
      console.log(`No release found for v${version}, trying latest...`);
      release = await fetchRelease();
    }
  } else {
    console.log("Fetching latest release...");
    release = await fetchRelease();
  }

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
  try {
    await downloadDist();
  } catch (err) {
    console.error("Failed to download frontend:", err);
    console.log("You can download it manually with: attache upgrade");
  }
}
