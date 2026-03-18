import { mkdir, copyFile, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const files = ["index.html", "app.js", "styles.css"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await ensureExists(path.join(root, file));
  await copyFile(path.join(root, file), path.join(dist, file));
}

console.log(`Built Pages assets in ${dist}`);

async function ensureExists(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing required file: ${filePath}`);
  }
}
