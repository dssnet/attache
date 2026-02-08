const REPO = "dssnet/attache";
const REPO_URL = "https://github.com/dssnet/attache";

console.log("\n  Upgrading Attaché...\n");

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

console.log("\n  Upgrade complete. Restart the server to use the new version.\n");
