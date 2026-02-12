import { Database } from "bun:sqlite";
import { join, relative } from "path";
import { existsSync, mkdirSync } from "fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { ATTACHE_DIR } from "./utils.ts";
import type { Config } from "./config.ts";

const MEMORIES_DIR = join(ATTACHE_DIR, "memories");
const DB_PATH = join(ATTACHE_DIR, "memory.db");

let db: Database | null = null;

export interface ParsedMemory {
  filepath: string; // relative to MEMORIES_DIR
  title: string;
  content: string;
  tags: string[];
}

export interface MemorySearchResult {
  filepath: string;
  title: string;
  content: string;
  tags: string[];
  score?: number;
}

/**
 * Parses a memory markdown file with YAML frontmatter.
 */
function parseMemoryFile(raw: string): { title: string; content: string; tags: string[] } {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { title: "", content: raw.trim(), tags: [] };
  }

  const frontmatter = frontmatterMatch[1] ?? "";
  const content = (frontmatterMatch[2] ?? "").trim();

  let title = "";
  let tags: string[] = [];

  for (const line of frontmatter.split("\n")) {
    const titleMatch = line.match(/^title:\s*(.+)$/);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim().replace(/^["']|["']$/g, "");
    }
    const tagsMatch = line.match(/^tags:\s*\[(.+)\]$/);
    if (tagsMatch?.[1]) {
      tags = tagsMatch[1].split(",").map(t => t.trim().replace(/^["']|["']$/g, ""));
    }
  }

  return { title, content, tags };
}

/**
 * Initializes the memory database and creates tables.
 */
export function initMemoryDb(config: Config): void {
  if (!config.memory) return;

  // Ensure directories exist
  if (!existsSync(ATTACHE_DIR)) {
    mkdirSync(ATTACHE_DIR, { recursive: true });
  }
  if (!existsSync(MEMORIES_DIR)) {
    mkdirSync(MEMORIES_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");

  // Always create both table schemas (idempotent)
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS bm25 USING fts5(filepath, title, content, tags)`);
  db.exec(`CREATE TABLE IF NOT EXISTS vector (
    filepath TEXT PRIMARY KEY,
    title TEXT,
    embedding BLOB
  )`);
}

/**
 * Scans the memories directory and indexes any files missing from the active table.
 * Removes entries for files that no longer exist on disk.
 */
export async function syncMemoryIndex(config: Config): Promise<number> {
  if (!db || !config.memory) return 0;

  const type = config.memory.type;

  // Get all .md files in memories directory
  let files: string[] = [];
  try {
    const entries = await readdir(MEMORIES_DIR);
    files = entries.filter(f => f.endsWith(".md"));
  } catch {
    return 0;
  }

  const diskFilepaths = new Set(files);

  // Get indexed filepaths from the active table
  let indexedFilepaths: Set<string>;
  if (type === "bm25") {
    const rows = db.query("SELECT filepath FROM bm25").all() as { filepath: string }[];
    indexedFilepaths = new Set(rows.map(r => r.filepath));
  } else {
    const rows = db.query("SELECT filepath FROM vector").all() as { filepath: string }[];
    indexedFilepaths = new Set(rows.map(r => r.filepath));
  }

  // Remove entries for deleted files
  for (const indexed of indexedFilepaths) {
    if (!diskFilepaths.has(indexed)) {
      if (type === "bm25") {
        db.run("DELETE FROM bm25 WHERE filepath = ?", [indexed]);
      } else {
        db.run("DELETE FROM vector WHERE filepath = ?", [indexed]);
      }
    }
  }

  // Index missing files
  let synced = 0;
  for (const file of files) {
    if (indexedFilepaths.has(file)) continue;

    try {
      const raw = await readFile(join(MEMORIES_DIR, file), "utf-8");
      const parsed = parseMemoryFile(raw);

      if (type === "bm25") {
        db.run(
          "INSERT INTO bm25 (filepath, title, content, tags) VALUES (?, ?, ?, ?)",
          [file, parsed.title, parsed.content, parsed.tags.join(", ")]
        );
      } else {
        // Vector type: compute embedding and store
        const embedding = await getEmbedding(
          `${parsed.title}\n${parsed.content}`,
          config
        );
        if (embedding) {
          const buffer = Buffer.from(new Float32Array(embedding).buffer);
          db.run(
            "INSERT OR REPLACE INTO vector (filepath, title, embedding) VALUES (?, ?, ?)",
            [file, parsed.title, buffer]
          );
        }
      }
      synced++;
    } catch (err) {
      console.error(`Failed to index memory file ${file}:`, err);
    }
  }

  return synced;
}

/**
 * Searches memories using the configured search type.
 */
export async function searchMemories(query: string, config: Config): Promise<MemorySearchResult[]> {
  if (!db || !config.memory) return [];

  const type = config.memory.type;

  if (type === "bm25") {
    return searchBm25(query);
  } else {
    return searchVector(query, config);
  }
}

/**
 * BM25 full-text search using FTS5.
 */
function searchBm25(query: string): MemorySearchResult[] {
  if (!db) return [];

  try {
    // Escape special FTS5 characters and create a prefix query
    const sanitized = query.replace(/['"*()]/g, " ").trim();
    if (!sanitized) return [];

    const rows = db.query(
      `SELECT filepath, title, content, tags, rank
       FROM bm25 WHERE bm25 MATCH ?
       ORDER BY rank
       LIMIT 10`
    ).all(sanitized) as Array<{ filepath: string; title: string; content: string; tags: string; rank: number }>;

    return rows.map(r => ({
      filepath: r.filepath,
      title: r.title,
      content: r.content,
      tags: r.tags ? r.tags.split(", ").filter(Boolean) : [],
      score: -r.rank, // FTS5 rank is negative (lower = better), invert for display
    }));
  } catch (err) {
    console.error("BM25 search error:", err);
    return [];
  }
}

/**
 * Vector similarity search using cosine similarity.
 */
async function searchVector(query: string, config: Config): Promise<MemorySearchResult[]> {
  if (!db) return [];

  const queryEmbedding = await getEmbedding(query, config);
  if (!queryEmbedding) return [];

  // Load all vectors and compute similarity in JS
  const rows = db.query("SELECT filepath, title, embedding FROM vector").all() as Array<{
    filepath: string;
    title: string;
    embedding: Buffer;
  }>;

  const scored: Array<{ filepath: string; title: string; score: number }> = [];
  for (const row of rows) {
    const storedEmbedding = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
    const score = cosineSimilarity(queryEmbedding, storedEmbedding);
    scored.push({ filepath: row.filepath, title: row.title, score });
  }

  // Sort by similarity (highest first) and take top 10
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 10).filter(s => s.score > 0.1);

  // Load full content for top results
  const results: MemorySearchResult[] = [];
  for (const item of top) {
    try {
      const raw = await readFile(join(MEMORIES_DIR, item.filepath), "utf-8");
      const parsed = parseMemoryFile(raw);
      results.push({
        filepath: item.filepath,
        title: item.title,
        content: parsed.content,
        tags: parsed.tags,
        score: item.score,
      });
    } catch {
      // File may have been deleted between search and read
    }
  }

  return results;
}

/**
 * Computes cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[] | Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i]!, bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Calls the configured embedding API to get a vector for text.
 * Uses OpenAI-compatible /v1/embeddings endpoint.
 */
async function getEmbedding(text: string, config: Config): Promise<number[] | null> {
  if (!config.memory?.embedding) {
    console.error("Vector memory type requires embedding config (apiUrl, apiKey, model)");
    return null;
  }

  const { apiUrl, apiKey, model } = config.memory.embedding;
  if (!apiUrl || !apiKey || !model) {
    console.error("Incomplete embedding config: apiUrl, apiKey, and model are all required");
    return null;
  }

  try {
    const url = apiUrl.endsWith("/v1/embeddings") ? apiUrl : `${apiUrl.replace(/\/+$/, "")}/v1/embeddings`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      console.error(`Embedding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error("Embedding API call failed:", err);
    return null;
  }
}

/**
 * Creates a slug from text for use in filenames.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Saves a new memory file and indexes it.
 */
export async function saveMemoryFile(
  title: string,
  content: string,
  tags: string[],
  config: Config,
): Promise<{ filepath: string; success: boolean }> {
  // Ensure memories directory exists
  await mkdir(MEMORIES_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const filename = `${date}-${slug}.md`;

  const frontmatter = [
    "---",
    `title: ${title}`,
    `tags: [${tags.join(", ")}]`,
    `source: assistant`,
    `created: ${new Date().toISOString()}`,
    "---",
    "",
    content,
  ].join("\n");

  const filepath = join(MEMORIES_DIR, filename);
  await writeFile(filepath, frontmatter, "utf-8");

  // Index the new file
  if (db && config.memory) {
    try {
      if (config.memory.type === "bm25") {
        db.run(
          "INSERT INTO bm25 (filepath, title, content, tags) VALUES (?, ?, ?, ?)",
          [filename, title, content, tags.join(", ")]
        );
      } else {
        const embedding = await getEmbedding(`${title}\n${content}`, config);
        if (embedding) {
          const buffer = Buffer.from(new Float32Array(embedding).buffer);
          db.run(
            "INSERT OR REPLACE INTO vector (filepath, title, embedding) VALUES (?, ?, ?)",
            [filename, title, buffer]
          );
        }
      }
    } catch (err) {
      console.error(`Failed to index new memory ${filename}:`, err);
    }
  }

  return { filepath: filename, success: true };
}

/**
 * Returns whether the memory system is initialized and ready.
 */
export function isMemoryReady(): boolean {
  return db !== null;
}
