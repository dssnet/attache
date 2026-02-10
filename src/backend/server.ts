import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { readdir, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "../../dist");
const DOWNLOADS_DIR = join(homedir(), ".attache", "downloads");

const DOWNLOAD_MAX_AGE = 60 * 60 * 1000; // 1 hour

export async function cleanupDownloads() {
  if (!existsSync(DOWNLOADS_DIR)) return;
  try {
    const entries = await readdir(DOWNLOADS_DIR);
    const now = Date.now();
    for (const entry of entries) {
      const entryPath = join(DOWNLOADS_DIR, entry);
      const info = await stat(entryPath);
      if (info.isDirectory() && now - info.mtimeMs > DOWNLOAD_MAX_AGE) {
        await rm(entryPath, { recursive: true });
      }
    }
  } catch (error) {
    console.error("Download cleanup error:", error);
  }
}

export function createServer() {
  const app = new Hono();

  // Serve downloadable files created by the AI
  app.get("/api/downloads/:id/:filename", async (c) => {
    const { id, filename } = c.req.param();
    const filePath = join(DOWNLOADS_DIR, id, filename);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.notFound();
    }
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(await file.arrayBuffer());
  });

  // Serve static files from dist directory (resolved relative to package, not CWD)
  app.use("/*", serveStatic({ root: DIST_DIR }));

  return app;
}
