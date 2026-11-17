import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "out");
const excluded = new Set([
  ".git", ".github", ".next", "node_modules", "out", "app",
  "components", "lib", "scripts", "public", "backend", "veter-ai-api",
  "package.json", "package-lock.json", "tsconfig.json", "next.config.ts",
  "postcss.config.mjs", ".gitignore", "README.md", "index.html",
]);

await mkdir(publicDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name) || entry.name.startsWith("next-env")) continue;
  const source = path.join(root, entry.name);
  const options = { recursive: true, force: true };
  await cp(source, path.join(publicDir, entry.name), options);
  // Render publishes `out/`; copy legacy pages there after Next.js export too,
  // so a fresh build includes them without relying on a previous build cache.
  await cp(source, path.join(outputDir, entry.name), options);
}
console.log("Legacy VETER pages and assets copied into public/ and out/.");
