import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [resolve(root, "src/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
  outfile: resolve(dist, "app.js"),
});

const js = result.outputFiles[0].text;

// The app commits to one visual world — the AI Goddesses warm palette — in both
// light and dark viewers, so lock the scheme instead of letting controls invert.
const BASE_CSS = `
  * { box-sizing: border-box; }
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #F6F1E9; }
  body { font-family: 'Assistant','Segoe UI',system-ui,-apple-system,sans-serif; }
  button { font-family: inherit; }
  input, textarea { font-family: inherit; }
  ::-webkit-scrollbar { height: 8px; width: 8px; }
  ::-webkit-scrollbar-thumb { background: #E2D7C6; border-radius: 999px; }
`;

// Body-only fragment: the Artifact host supplies <!doctype>, <head> and <body>.
const fragment = `<title>לוח הקצב שלנו — יומן קצב ולוח משימות</title>
<style>${BASE_CSS}</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(resolve(dist, "artifact.html"), fragment, "utf8");

// Full standalone page for opening straight off disk.
const page = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>לוח הקצב שלנו — יומן קצב ולוח משימות</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(resolve(dist, "index.html"), page, "utf8");

console.log(`built dist/index.html and dist/artifact.html (${(js.length / 1024).toFixed(0)} kb js)`);
