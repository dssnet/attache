import { downloadDist } from "./download-dist.ts";

console.log("\n  Upgrading Attache frontend...\n");

try {
  await downloadDist(true);
  console.log("\n  Upgrade complete. Restart the server to use the new version.\n");
} catch (err) {
  console.error("  Upgrade failed:", err);
  process.exit(1);
}
