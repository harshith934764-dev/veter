import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const excluded = new Set([
  ".git", ".github", ".next", "node_modules", "out", "app",
  "components", "lib", "scripts", "public", "backend", "veter-ai-api",
  "package.json", "package-lock.json", "tsconfig.json", "next.config.ts",
  "postcss.config.mjs", ".gitignore", "README.md", "index.html",
]);

await mkdir(publicDir, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name) || entry.name.startsWith("next-env")) continue;
  await cp(path.join(root, entry.name), path.join(publicDir, entry.name), {
    recursive: true,
    force: true,
  });
}
console.log("Legacy VETER pages and assets copied into Next.js public/.");
