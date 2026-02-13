import { join } from "path";
import type { Migration } from "./types.ts";

const migration: Migration = {
  description: "Add default memory config (type: bm25) if missing",
  up(ctx) {
    const configPath = join(ctx.attacheDir, "config.json");
    const config = ctx.readJSON(configPath);
    if (!config) {
      ctx.log("No config.json found, skipping");
      return;
    }

    if (config.memory) {
      ctx.log("memory config already exists, skipping");
      return;
    }

    config.memory = { type: "bm25" };
    ctx.writeJSON(configPath, config);
    ctx.log("Added memory.type = bm25");
  },
};

export default migration;
