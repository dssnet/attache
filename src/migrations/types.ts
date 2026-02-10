export interface MigrationContext {
  /** Path to ~/.attache */
  attacheDir: string;
  /** Current package version */
  version: string;
  /** Load and parse a JSON file, returns null if missing or invalid */
  readJSON: (path: string) => any | null;
  /** Write an object as formatted JSON */
  writeJSON: (path: string, data: any) => void;
  /** Log a message with migration prefix */
  log: (message: string) => void;
}

export interface Migration {
  /** Human-readable description shown during execution */
  description: string;
  /** The migration function. Should be idempotent when possible. */
  up: (ctx: MigrationContext) => Promise<void> | void;
}

export interface MigrationRecord {
  /** Migration name (filename without .ts extension) */
  name: string;
  /** ISO timestamp when this migration was executed */
  executedAt: string;
  /** Package version at time of execution */
  version: string;
}

export interface MigrationState {
  executedMigrations: MigrationRecord[];
}
