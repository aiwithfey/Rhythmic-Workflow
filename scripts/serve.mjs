import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

// Port 3000 on purpose: it is Supabase's default Site URL, so magic links come
// back here without anything being configured in the dashboard first.
const PORT = Number(process.env.PORT || 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  try {
    // Everything not on disk falls back to the page, so the magic-link
    // redirect lands on the app whatever path it carries.
    const body = await readFile(join(root, file)).catch(() => readFile(join(root, "index.html")));
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "text/html; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found — run `npm run live` first");
  }
}).listen(PORT, () => {
  console.log(`\n  לוח הקצב שלנו → http://localhost:${PORT}\n`);
});
