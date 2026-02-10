import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ATTACHE_DIR, ensureAttacheDir } from "../backend/utils.ts";
import type { Migration, MigrationState, MigrationRecord, MigrationContext } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = __dirname;
const STATE_FILE = join(ATTACHE_DIR, "migrations.json");

function discoverMigrations(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{4}_.*\.ts$/.test(f))
    .sort()
    .map(f => f.replace(/\.ts$/, ""));
}

function loadState(): MigrationState {
  ensureAttacheDir();
  if (!existsSync(STATE_FILE)) {
    return { executedMigrations: [] };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { executedMigrations: [] };
  }
}

function saveState(state: MigrationState): void {
  ensureAttacheDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function getPendingMigrations(state: MigrationState): string[] {
  const executed = new Set(state.executedMigrations.map(m => m.name));
  return discoverMigrations().filter(name => !executed.has(name));
}

export async function runPendingMigrations(): Promise<{ ran: number; total: number }> {
  const state = loadState();
  const pending = getPendingMigrations(state);

  if (pending.length === 0) {
    return { ran: 0, total: state.executedMigrations.length };
  }

  let version = "unknown";
  try {
    const pkgPath = join(MIGRATIONS_DIR, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    version = pkg.version || "unknown";
  } catch {}

  console.log(`\n  Running ${pending.length} pending migration(s)...\n`);

  for (const name of pending) {
    const filePath = join(MIGRATIONS_DIR, `${name}.ts`);
    const mod = await import(filePath);
    const migration: Migration = mod.default;

    if (!migration || typeof migration.up !== "function") {
      console.error(`  [!] Skipping ${name}: invalid migration (no default export with up())`);
      continue;
    }

    const ctx: MigrationContext = {
      attacheDir: ATTACHE_DIR,
      version,
      readJSON(p: string) {
        try {
          return JSON.parse(readFileSync(p, "utf-8"));
        } catch {
          return null;
        }
      },
      writeJSON(p: string, data: any) {
        writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
      },
      log(message: string) {
        console.log(`    ${message}`);
      },
    };

    console.log(`  [${name}] ${migration.description}`);

    try {
      await migration.up(ctx);

      state.executedMigrations.push({
        name,
        executedAt: new Date().toISOString(),
        version,
      });
      saveState(state);

      console.log(`  [${name}] Done.`);
    } catch (error) {
      console.error(`  [${name}] FAILED:`, error);
      console.error(`\n  Migration stopped. Fix the issue and re-run upgrade.\n`);
      throw error;
    }
  }

  console.log(`\n  All migrations complete.\n`);
  return { ran: pending.length, total: state.executedMigrations.length };
}
