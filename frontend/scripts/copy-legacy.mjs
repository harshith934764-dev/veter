import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const publicDir = path.resolve(process.cwd(), "public");
await mkdir(publicDir, { recursive: true });

// Keep the existing standalone tools and pages reachable while they are
// progressively rebuilt as React routes. Vite's own index.html remains primary.
const rootFiles = await readdir(repoRoot, { withFileTypes: true });
const allowedExtensions = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt",
  ".webmanifest", ".wasm", ".zip", ".png", ".jpg", ".jpeg",
  ".webp", ".svg", ".ico", ".pdf"
]);
for (const entry of rootFiles) {
  if (!entry.isFile()) continue;
  if (entry.name === "index.html") continue;
  if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
    await cp(path.join(repoRoot, entry.name), path.join(publicDir, entry.name));
  }
}

// These folders contain public browser assets and downloadable releases.
// Backend, training data, source code and development folders are not published.
for (const folder of ["assets", "downloads"]) {
  const source = path.join(repoRoot, folder);
  try {
    await cp(source, path.join(publicDir, folder), { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
console.log("Legacy public pages, assets and downloads copied into the React/Vite build.");
