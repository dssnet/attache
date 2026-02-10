import { runPendingMigrations } from "../migrations/runner.ts";

try {
  const result = await runPendingMigrations();
  if (result.ran > 0) {
    console.log(`  Ran ${result.ran} migration(s) successfully.`);
  }
} catch (error) {
  console.error("  Migration failed:", error);
  process.exit(1);
}
