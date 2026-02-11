import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const MEMORIES_DIR = join(homedir(), ".attache", "memories");
const QMD_MODELS_DIR = join(homedir(), ".cache", "qmd", "models");

let qmdAvailable: boolean | null = null;
let vsearchReady = false;


/**
 * Checks if qmd CLI is available on PATH. Caches the result.
 */
async function checkQmdAvailable(): Promise<boolean> {
  if (qmdAvailable !== null) return qmdAvailable;
  try {
    const result = await Bun.$`which qmd`.quiet().nothrow();
    qmdAvailable = result.exitCode === 0;
  } catch {
    qmdAvailable = false;
  }
  return qmdAvailable;
}

/**
 * Checks whether qmd embedding models are already downloaded.
 */
function hasEmbeddingModels(): boolean {
  if (!existsSync(QMD_MODELS_DIR)) return false;
  try {
    const entries = require("node:fs").readdirSync(QMD_MODELS_DIR);
    return entries.some((e: string) => e.endsWith(".gguf"));
  } catch {
    return false;
  }
}

/**
 * Checks whether the vsearch query expansion model is already downloaded.
 */
function hasVsearchModels(): boolean {
  if (!existsSync(QMD_MODELS_DIR)) return false;
  try {
    const entries = require("node:fs").readdirSync(QMD_MODELS_DIR);
    return entries.some((e: string) => e.includes("query-expansion") && e.endsWith(".gguf"));
  } catch {
    return false;
  }
}

/**
 * Initializes the memories directory and registers it as a qmd collection.
 * Downloads embedding models if needed. Safe to call multiple times (idempotent).
 */
export async function initializeMemoryCollection(): Promise<void> {
  await mkdir(MEMORIES_DIR, { recursive: true });

  if (!(await checkQmdAvailable())) {
    console.warn("qmd not found — memory search will use basic fallback.");
    return;
  }

  try {
    await Bun.$`qmd collection add ${MEMORIES_DIR} --name attache-memories`.nothrow();
    await Bun.$`qmd update`.nothrow();

    if (!hasEmbeddingModels()) {
      console.log("Downloading qmd embedding models...");
    }

    const embedResult = await Bun.$`qmd embed`.nothrow();
    if (embedResult.exitCode !== 0) {
      console.warn("qmd embed failed:", embedResult.stderr.toString());
      return;
    }

    vsearchReady = hasVsearchModels();
    console.log("Memory collection initialized (qmd).");
  } catch (err) {
    console.warn("Failed to initialize qmd collection:", err);
  }
}

export interface MemoryInput {
  title: string;
  content: string;
  tags?: string[];
  source?: string;
}

export interface MemorySearchResult {
  path: string;
  title: string;
  score: number;
  snippet: string;
}

/**
 * Slugifies a title for use as a filename.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Saves a memory as a markdown file with YAML frontmatter.
 * Triggers qmd update in the background.
 */
export async function saveMemory(input: MemoryInput): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    await mkdir(MEMORIES_DIR, { recursive: true });

    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10);
    const slug = slugify(input.title);
    let filename = `${datePrefix}-${slug}.md`;
    let filepath = join(MEMORIES_DIR, filename);

    // Avoid collisions
    if (existsSync(filepath)) {
      const suffix = crypto.randomUUID().slice(0, 6);
      filename = `${datePrefix}-${slug}-${suffix}.md`;
      filepath = join(MEMORIES_DIR, filename);
    }

    const tags = input.tags?.length ? `[${input.tags.join(", ")}]` : "[]";
    const source = input.source || "unknown";

    const fileContent = `---
title: ${input.title}
tags: ${tags}
source: ${source}
created: ${now.toISOString()}
---

${input.content}
`;

    await writeFile(filepath, fileContent, "utf-8");

    // Update qmd index and embed for vector search
    if (await checkQmdAvailable()) {
      Bun.$`qmd update && qmd embed`.nothrow().then(() => {}).catch(() => {});
    }

    return { success: true, path: filepath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Parses qmd JSON output into MemorySearchResult array.
 */
function parseQmdResults(output: string): MemorySearchResult[] {
  if (!output) return [];
  try {
    const data = JSON.parse(output);
    const items = Array.isArray(data) ? data : (data.results || []);
    return items.map((item: any) => ({
      path: item.path || item.file || "",
      title: item.title || item.path || "",
      score: item.score ?? 0,
      snippet: item.snippet || item.content || "",
    }));
  } catch {
    return [];
  }
}

/**
 * Searches memories using qmd. Tries vector search (semantic) first,
 * falls back to BM25 keyword search.
 */
export async function searchMemories(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
  if (!(await checkQmdAvailable())) return [];

  // Try vector search first (semantic matching) — skip if models aren't downloaded yet
  if (vsearchReady) {
    try {
      const vResult = await Bun.$`qmd vsearch --json -n ${limit} --collection attache-memories ${query}`.nothrow();
      if (vResult.exitCode === 0) {
        const results = parseQmdResults(vResult.stdout.toString().trim());
        if (results.length > 0) return results;
      }
    } catch {}
  }

  // Fall back to BM25 keyword search
  try {
    const bResult = await Bun.$`qmd search --json -n ${limit} --collection attache-memories ${query}`.nothrow();
    if (bResult.exitCode === 0) {
      return parseQmdResults(bResult.stdout.toString().trim());
    }
  } catch {}

  return [];
}

/**
 * Searches memories via qmd and formats results for system prompt injection.
 * Uses vector search (semantic) → BM25 fallback chain.
 * Returns empty string if no results or qmd unavailable.
 */
export async function searchMemoriesForContext(query: string): Promise<string> {
  try {
    const results = await Promise.race([
      searchMemories(query, 10),
      new Promise<MemorySearchResult[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);

    if (results.length === 0) return "";

    const lines = results.map((r) => `- **${r.title}**: ${r.snippet.slice(0, 150)}`);
    return lines.join("\n");
  } catch {
    return "";
  }
}

/**
 * Deletes a memory file by filename and triggers qmd re-index.
 */
export async function deleteMemory(filename: string): Promise<{ success: boolean; error?: string }> {
  try {
    const filepath = join(MEMORIES_DIR, filename);
    await unlink(filepath);

    if (await checkQmdAvailable()) {
      Bun.$`qmd update`.nothrow().then(() => {}).catch(() => {});
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
