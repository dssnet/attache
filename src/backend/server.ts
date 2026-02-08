import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { join } from "path";
import { homedir } from "os";

const DOWNLOADS_DIR = join(homedir(), ".attache", "downloads");

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

  // Serve static files from dist directory
  app.use("/*", serveStatic({ root: "./dist" }));

  return app;
}
