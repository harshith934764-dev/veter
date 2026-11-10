import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "out");
const excluded = new Set([".git", ".github", ".next", "node_modules", "out", "app", "components", "lib", "scripts", "public"]);
await mkdir(out, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name) || entry.name === "index.html" || entry.name.startsWith("next-env")) continue;
  if (["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", ".gitignore", "README.md"].includes(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(out, entry.name), { recursive: true, force: true });
}
console.log("Legacy VETER pages and assets copied into the Next.js static export.");
